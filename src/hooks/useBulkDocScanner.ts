import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { usePropertiesV2 } from './usePropertiesV2';
import { toast } from 'sonner';
import { createSignedStorageUrl } from '@/lib/storagePaths';

function invalidateComplianceCaches(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['compliance-matrix-v2'] });
  qc.invalidateQueries({ queryKey: ['compliance-documents-v2'] });
  qc.invalidateQueries({ queryKey: ['portfolio-compliance-score-v2'] });
  qc.invalidateQueries({ queryKey: ['compliance-requirements-v2'] });
}

export interface ScannedDocument {
  file: File;
  storagePath: string;
  documentId: string | null;
  classification: {
    documentType: string | null;
    confidence: number;
    extractedData: {
      address?: string;
      postcode?: string;
      expiryDate?: string;
      issueDate?: string;
      certificateNumber?: string;
      rating?: string;
    };
  };
  matchedPropertyId: string | null;
  userOverrides: {
    documentType?: string;
    propertyId?: string;
    expiryDate?: string;
    issueDate?: string;
    certificateNumber?: string;
  };
  status: 'uploading' | 'classifying' | 'ready' | 'confirmed' | 'rejected' | 'filed' | 'error';
  error?: string;
}

const MAX_FILES = 50;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const CONCURRENCY = 3;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unknown error';

function extractPostcode(text: string): string | null {
  const match = text.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  return match ? match[0].replace(/\s/g, '').toLowerCase() : null;
}

export function useBulkDocScanner() {
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFiling, setIsFiling] = useState(false);
  const { data: properties } = usePropertiesV2();
  const abortRef = useRef(false);
  const queryClient = useQueryClient();

  const updateDoc = useCallback((idx: number, patch: Partial<ScannedDocument>) => {
    setDocuments(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }, []);

  const matchProperty = useCallback((address?: string) => {
    if (!address || !properties?.length) return null;
    const norm = address.toLowerCase().replace(/[,.\s]+/g, ' ').trim();
    const extractedPc = extractPostcode(norm);

    for (const p of properties) {
      const propPc = p.postcode?.replace(/\s/g, '').toLowerCase() || '';
      if (propPc && extractedPc && propPc === extractedPc) return p.id;
      const propAddr = p.address_line_1?.toLowerCase() || '';
      if (propAddr && (norm.includes(propAddr) || propAddr.includes(norm))) return p.id;
    }
    return null;
  }, [properties]);

  const uploadAndClassify = useCallback(async (file: File, idx: number, orgId: string) => {
    if (abortRef.current) return;

    // 1. Upload to storage
    updateDoc(idx, { status: 'uploading' });
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `${orgId}/inbox/${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, { contentType: file.type });

    if (uploadErr) {
      updateDoc(idx, { status: 'error', error: `Upload failed: ${uploadErr.message}` });
      return;
    }

    // 2. Create document record
    const { data: { user } } = await supabase.auth.getUser();
    const { data: docRecord, error: docErr } = await supabaseAny
      .from('documents')
      .insert({
        org_id: orgId,
        original_file_name: file.name,
        file_url: storagePath,
        file_type: file.type.split('/')[1] || 'pdf',
        mime_type: file.type,
        file_size_bytes: file.size,
        uploaded_by: user?.id || null,
        review_status: 'pending',
        extraction_status: 'pending',
        category: 'other',
      })
      .select('id')
      .single();

    if (docErr || !docRecord) {
      updateDoc(idx, { status: 'error', error: `Record creation failed: ${docErr?.message}` });
      return;
    }

    updateDoc(idx, { storagePath, documentId: docRecord.id, status: 'classifying' });

    // 3. Call process-document for AI classification
    try {
      const signedUrl = await createSignedStorageUrl('documents', storagePath, 3600);
      const propsForAI = (properties || []).map(p => ({
        id: p.id,
        address_line: p.address_line_1 || '',
        postcode: p.postcode || null,
        title_number: null,
      }));

      const { data: _result, error: fnErr } = await supabase.functions.invoke('process-document', {
        body: {
          documentId: docRecord.id,
          fileUrl: signedUrl,
          properties: propsForAI.length > 0 ? propsForAI : [{ id: '00000000-0000-0000-0000-000000000000', address_line: 'N/A', postcode: null, title_number: null }],
        },
      });

      if (fnErr) throw fnErr;

      // 4. Re-fetch the document to get AI results
      const { data: updated } = await supabaseAny
        .from('documents')
        .select('ai_suggested_doc_type, ai_doc_type_confidence, ai_suggested_property_id, ai_property_confidence, extracted_data, extracted_address_text, extracted_issue_date, extracted_reference_number, expiry_date')
        .eq('id', docRecord.id)
        .single();

      const extractedData = (updated?.extracted_data as Record<string, unknown>) || {};
      const matchedPropId = updated?.ai_suggested_property_id || matchProperty(updated?.extracted_address_text || undefined);

      updateDoc(idx, {
        status: 'ready',
        classification: {
          documentType: updated?.ai_suggested_doc_type || null,
          confidence: updated?.ai_doc_type_confidence || 0,
          extractedData: {
            address: (updated?.extracted_address_text as string) || undefined,
            postcode: (extractedData.postcode as string) || undefined,
            expiryDate: (updated?.expiry_date as string) || (extractedData.expiry_date as string) || undefined,
            issueDate: (updated?.extracted_issue_date as string) || (extractedData.issue_date as string) || undefined,
            certificateNumber: (updated?.extracted_reference_number as string) || (extractedData.certificate_number as string) || undefined,
            rating: (extractedData.epc_rating as string) || undefined,
          },
        },
        matchedPropertyId: matchedPropId,
      });
    } catch (error: unknown) {
      console.error('Failed to classify document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to classify document');
      // Still mark as ready with low confidence — user can manually classify
      updateDoc(idx, {
        status: 'ready',
        classification: {
          documentType: null,
          confidence: 0,
          extractedData: {},
        },
        error: `Classification failed: ${getErrorMessage(error)}`,
      });
    }
  }, [properties, matchProperty, updateDoc]);

  const processFiles = useCallback(async (files: File[]) => {
    if (files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed at once`);
      return;
    }

    const validFiles = files.filter(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: unsupported file type`);
        return false;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name}: exceeds 20MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    abortRef.current = false;
    setIsProcessing(true);

    const orgId = await fetchUserOrgId();
    const initialDocs: ScannedDocument[] = validFiles.map(f => ({
      file: f,
      storagePath: '',
      documentId: null,
      classification: { documentType: null, confidence: 0, extractedData: {} },
      matchedPropertyId: null,
      userOverrides: {},
      status: 'uploading' as const,
    }));

    setDocuments(prev => [...prev, ...initialDocs]);
    const startIdx = documents.length;

    // Process with concurrency limit
    const queue = validFiles.map((f, i) => ({ file: f, idx: startIdx + i }));
    const workers = Array(Math.min(CONCURRENCY, queue.length)).fill(null).map(async () => {
      while (queue.length > 0 && !abortRef.current) {
        const item = queue.shift()!;
        await uploadAndClassify(item.file, item.idx, orgId);
      }
    });

    await Promise.all(workers);
    setIsProcessing(false);
    // process-document-v2 auto-creates compliance_documents_v2 records on extraction;
    // refresh compliance views so newly-classified documents appear immediately.
    invalidateComplianceCaches(queryClient);
    toast.success(`Processed ${validFiles.length} files`);
  }, [documents.length, uploadAndClassify, queryClient]);

  const setOverride = useCallback((idx: number, overrides: Partial<ScannedDocument['userOverrides']>) => {
    setDocuments(prev => prev.map((d, i) =>
      i === idx ? { ...d, userOverrides: { ...d.userOverrides, ...overrides } } : d
    ));
  }, []);

  const confirmDoc = useCallback((idx: number) => updateDoc(idx, { status: 'confirmed' }), [updateDoc]);
  const rejectDoc = useCallback((idx: number) => updateDoc(idx, { status: 'rejected' }), [updateDoc]);

  const fileConfirmedDocuments = useCallback(async () => {
    const confirmed = documents.filter(d => d.status === 'confirmed');
    if (confirmed.length === 0) {
      toast.error('No documents confirmed for filing');
      return;
    }

    setIsFiling(true);
    const orgId = await fetchUserOrgId();
    let filedCount = 0;
    const propertySet = new Set<string>();

    for (const doc of confirmed) {
      const idx = documents.indexOf(doc);
      const propId = doc.userOverrides.propertyId || doc.matchedPropertyId;
      const docType = doc.userOverrides.documentType || doc.classification.documentType;
      const issueDate = doc.userOverrides.issueDate || doc.classification.extractedData.issueDate || new Date().toISOString().split('T')[0];
      const expiryDate = doc.userOverrides.expiryDate || doc.classification.extractedData.expiryDate;
      const certNumber = doc.userOverrides.certificateNumber || doc.classification.extractedData.certificateNumber;

      if (!propId || !docType) {
        updateDoc(idx, { status: 'error', error: 'Missing property or document type' });
        continue;
      }

      try {
        // Skip if process-document-v2 has already auto-filed this document
        // (it creates a compliance_documents_v2 record during extraction)
        const { data: existing } = await supabaseAny
          .from('compliance_documents_v2')
          .select('id')
          .eq('property_id', propId)
          .eq('document_type', docType)
          .eq('is_current', true)
          .maybeSingle();

        const status = expiryDate && new Date(expiryDate) < new Date() ? 'expired'
          : expiryDate && new Date(expiryDate) < new Date(Date.now() + 30 * 86400000) ? 'critical'
          : expiryDate && new Date(expiryDate) < new Date(Date.now() + 90 * 86400000) ? 'expiring_soon'
          : 'valid';

        if (existing?.id) {
          // Update existing current record with confirmed values rather than creating a duplicate
          const { error: updErr } = await supabaseAny
            .from('compliance_documents_v2')
            .update({
              issue_date: issueDate,
              expiry_date: expiryDate || null,
              certificate_number: certNumber || null,
              file_url: doc.storagePath || null,
              file_name: doc.file.name,
              status,
              ai_extracted: true,
              ai_confidence_score: doc.classification.confidence,
            })
            .eq('id', existing.id);
          if (updErr) throw updErr;
        } else {
          const { error: compErr } = await supabaseAny
            .from('compliance_documents_v2')
            .insert({
              org_id: orgId,
              property_id: propId,
              document_type: docType,
              issue_date: issueDate,
              expiry_date: expiryDate || null,
              certificate_number: certNumber || null,
              file_url: doc.storagePath || null,
              file_name: doc.file.name,
              status,
              ai_extracted: true,
              ai_confidence_score: doc.classification.confidence,
              is_current: true,
            });
          if (compErr) throw compErr;
        }

        // Update document record
        if (doc.documentId) {
          await supabaseAny
            .from('documents')
            .update({
              property_id: propId,
              review_status: 'approved',
              doc_type: docType,
            })
            .eq('id', doc.documentId);
        }

        updateDoc(idx, { status: 'filed' });
        filedCount++;
        propertySet.add(propId);
      } catch (error: unknown) {
        updateDoc(idx, { status: 'error', error: `Filing failed: ${getErrorMessage(error)}` });
      }
    }

    setIsFiling(false);
    toast.success(`Filed ${filedCount} documents to ${propertySet.size} properties`);
  }, [documents, updateDoc]);

  const clearAll = useCallback(() => {
    abortRef.current = true;
    setDocuments([]);
    setIsProcessing(false);
  }, []);

  return {
    documents,
    isProcessing,
    isFiling,
    processFiles,
    setOverride,
    confirmDoc,
    rejectDoc,
    fileConfirmedDocuments,
    clearAll,
    properties: properties || [],
  };
}
