import { useState, useCallback, useRef } from 'react';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { usePropertiesV2 } from './usePropertiesV2';
import { createSignedStorageUrl } from '@/lib/storagePaths';
import { classifyFilename, type FilenameClassification } from '@/lib/documents/filenameClassifier';
import { toast } from 'sonner';

export type QueueItemStatus =
  | 'queued'
  | 'uploading'
  | 'classifying'
  | 'extracting'
  | 'done'
  | 'error';

export interface QueueItem {
  id: string;
  file: File;
  /** Original path inside a dropped folder (e.g. "Property A/EICR.pdf"). Empty for flat drops. */
  /** Original path inside a dropped folder (e.g. "Property A/EICR.pdf"). Empty for flat drops. */
  relativePath?: string;
  thumbnailUrl: string | null;
  storagePath: string;
  documentId: string | null;
  status: QueueItemStatus;
  error: string | null;
  /** Tentative classification from filename heuristics — set BEFORE upload. */
  filenameHint?: FilenameClassification;
  classification: {
    documentType: string | null;
    confidence: number;
    category: string | null;
  };
  extraction: {
    address: string | null;
    postcode: string | null;
    expiryDate: string | null;
    issueDate: string | null;
    certificateNumber: string | null;
    rating: string | null;
    fieldConfidences: Record<string, number>;
  };
  matchedPropertyId: string | null;
  selectedPropertyId: string | null;
  retryCount: number;
}

export interface BulkUploadStats {
  total: number;
  classified: number;
  extracted: number;
  needsReview: number;
  failed: number;
  byDocType: Record<string, number>;
}

const MAX_CONCURRENT = 3;
const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ACCEPTED_EXT_FALLBACK = /\.(pdf|jpe?g|png|heic|heif|docx)$/i;

let nextId = 0;
function generateId(): string {
  return `bulk-${Date.now()}-${nextId++}`;
}

function createThumbnail(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function extractPostcode(text: string): string | null {
  const match = text.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  return match ? match[0].replace(/\s/g, '').toLowerCase() : null;
}

export function useBulkDocumentUpload() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const abortRef = useRef(false);
  const { data: properties } = usePropertiesV2();

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const matchProperty = useCallback((address?: string | null) => {
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

  const processItem = useCallback(async (item: QueueItem, orgId: string) => {
    if (abortRef.current) return;

    // Step 1: Upload to Supabase Storage
    updateItem(item.id, { status: 'uploading' });
    const safeName = `${Date.now()}_${item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `${orgId}/inbox/${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, item.file, { contentType: item.file.type });

    if (uploadErr) {
      updateItem(item.id, { status: 'error', error: `Upload failed: ${uploadErr.message}` });
      return;
    }

    // Create document record. Persist the filename hint set BEFORE the AI runs
    // so it's visible alongside ai_suggested_doc_type in the batch review queue.
    const { data: { user } } = await supabase.auth.getUser();
    const { data: docRecord, error: docErr } = await supabaseAny
      .from('documents')
      .insert({
        org_id: orgId,
        original_file_name: item.file.name,
        file_url: storagePath,
        file_type: item.file.type.split('/')[1] || 'pdf',
        mime_type: item.file.type,
        file_size_bytes: item.file.size,
        uploaded_by: user?.id || null,
        review_status: 'pending',
        extraction_status: 'pending',
        category: 'other',
        filename_category_hint: item.filenameHint?.category ?? null,
      })
      .select('id')
      .single();

    if (docErr || !docRecord) {
      updateItem(item.id, { status: 'error', error: `Record creation failed: ${docErr?.message}` });
      return;
    }

    updateItem(item.id, { storagePath, documentId: docRecord.id });

    // Step 2: Call categorise-documents edge function
    updateItem(item.id, { status: 'classifying' });
    try {
      const { data: _catResult, error: catErr } = await supabase.functions.invoke('categorise-documents', {
        body: { dryRun: false, documentIds: [docRecord.id] },
      });

      if (catErr) throw catErr;

      // Fetch updated categorisation
      const { data: catDoc } = await supabaseAny
        .from('documents')
        .select('ai_suggested_doc_type, ai_doc_type_confidence, category, display_name')
        .eq('id', docRecord.id)
        .single();

      updateItem(item.id, {
        classification: {
          documentType: catDoc?.ai_suggested_doc_type || null,
          confidence: catDoc?.ai_doc_type_confidence || 0,
          category: catDoc?.category || null,
        },
      });
    } catch (catError) {
      console.error('Categorisation failed:', catError);
      // Continue to extraction even if categorisation fails
    }

    // Step 3: Call process-document-v2 edge function for extraction
    updateItem(item.id, { status: 'extracting' });
    try {
      const signedUrl = await createSignedStorageUrl('documents', storagePath, 3600);

      const { data: extResult, error: extErr } = await supabase.functions.invoke('process-document-v2', {
        body: {
          document_url: signedUrl,
          document_id: docRecord.id,
          org_id: orgId,
        },
      });

      if (extErr) throw extErr;

      const fields = extResult?.fields || {};
      const matchedPropId = matchProperty(fields.address?.value);

      // Re-fetch document with all AI data
      const { data: finalDoc } = await supabaseAny
        .from('documents')
        .select('ai_suggested_doc_type, ai_doc_type_confidence, ai_suggested_property_id, category, extracted_address_text, extracted_issue_date, extracted_reference_number, expiry_date, extracted_data')
        .eq('id', docRecord.id)
        .single();

      const extractedData = (finalDoc?.extracted_data as Record<string, unknown>) || {};
      const fieldConfidences: Record<string, number> = {};
      if (extResult?.fields) {
        for (const [key, val] of Object.entries(extResult.fields)) {
          if (val && typeof val === 'object' && 'confidence' in val) {
            fieldConfidences[key] = (val as { confidence: number }).confidence;
          }
        }
      }

      updateItem(item.id, {
        status: 'done',
        classification: {
          documentType: finalDoc?.ai_suggested_doc_type || null,
          confidence: finalDoc?.ai_doc_type_confidence || 0,
          category: finalDoc?.category || null,
        },
        extraction: {
          address: finalDoc?.extracted_address_text || fields.address?.value || null,
          postcode: (extractedData.postcode as string) || fields.postcode?.value || null,
          expiryDate: finalDoc?.expiry_date || (extractedData.expiry_date as string) || fields.expiry_date?.value || null,
          issueDate: finalDoc?.extracted_issue_date || (extractedData.issue_date as string) || fields.issue_date?.value || null,
          certificateNumber: finalDoc?.extracted_reference_number || (extractedData.certificate_number as string) || fields.reference_number?.value || null,
          rating: (extractedData.epc_rating as string) || fields.epc_rating?.value || null,
          fieldConfidences,
        },
        matchedPropertyId: finalDoc?.ai_suggested_property_id || matchedPropId,
      });
    } catch (extError) {
      console.error('Extraction failed:', extError);
      // Mark document as failed in the DB so it doesn't stay stuck
      await supabaseAny.from('documents').update({ extraction_status: 'failed' }).eq('id', docRecord.id);
      updateItem(item.id, {
        status: 'error',
        error: `Extraction failed: ${extError instanceof Error ? extError.message : 'Unknown error'}`,
      });
    }
  }, [updateItem, matchProperty]);

  const addFiles = useCallback(async (files: File[]): Promise<QueueItem[]> => {
    const currentCount = queue.length;
    const remaining = MAX_FILES - currentCount;

    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return [];
    }

    const filesToAdd = files.slice(0, remaining);
    if (filesToAdd.length < files.length) {
      toast.warning(`Only adding ${filesToAdd.length} of ${files.length} files (limit: ${MAX_FILES})`);
    }

    const validFiles: File[] = [];
    for (const file of filesToAdd) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        toast.error(`${file.name}: unsupported type. Use PDF, JPG, or PNG.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: exceeds 10MB limit`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return [];

    const newItems: QueueItem[] = await Promise.all(
      validFiles.map(async (file) => ({
        id: generateId(),
        file,
        thumbnailUrl: await createThumbnail(file),
        storagePath: '',
        documentId: null,
        status: 'queued' as const,
        error: null,
        classification: { documentType: null, confidence: 0, category: null },
        extraction: {
          address: null,
          postcode: null,
          expiryDate: null,
          issueDate: null,
          certificateNumber: null,
          rating: null,
          fieldConfidences: {},
        },
        matchedPropertyId: null,
        selectedPropertyId: null,
        retryCount: 0,
      }))
    );

    setQueue(prev => [...prev, ...newItems]);
    setIsComplete(false);
    return newItems;
  }, [queue.length]);

  const processAll = useCallback(async () => {
    const queued = queue.filter(item => item.status === 'queued');
    if (queued.length === 0) {
      toast.info('No queued files to process');
      return;
    }

    abortRef.current = false;
    setIsProcessing(true);
    setIsComplete(false);

    const orgId = await fetchUserOrgId();
    const pending = [...queued];

    const workers = Array(Math.min(MAX_CONCURRENT, pending.length)).fill(null).map(async () => {
      while (pending.length > 0 && !abortRef.current) {
        const item = pending.shift()!;
        await processItem(item, orgId);
      }
    });

    await Promise.all(workers);
    setIsProcessing(false);
    setIsComplete(true);
    toast.success(`Processed ${queued.length} files`);
  }, [queue, processItem]);

  const retryItem = useCallback(async (id: string) => {
    const item = queue.find(q => q.id === id);
    if (!item || item.status !== 'error') return;

    updateItem(id, { status: 'queued', error: null, retryCount: item.retryCount + 1 });

    const orgId = await fetchUserOrgId();
    updateItem(id, { status: 'uploading' });
    await processItem({ ...item, status: 'uploading', error: null }, orgId);
  }, [queue, updateItem, processItem]);

  const removeItem = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const setPropertyForItem = useCallback((id: string, propertyId: string) => {
    updateItem(id, { selectedPropertyId: propertyId });
  }, [updateItem]);

  const clearQueue = useCallback(() => {
    abortRef.current = true;
    setQueue([]);
    setIsProcessing(false);
    setIsComplete(false);
  }, []);

  const stats: BulkUploadStats = {
    total: queue.length,
    classified: queue.filter(q => q.classification.documentType !== null).length,
    extracted: queue.filter(q => q.status === 'done').length,
    needsReview: queue.filter(q =>
      q.status === 'done' && (q.classification.confidence < 0.7 || !q.matchedPropertyId)
    ).length,
    failed: queue.filter(q => q.status === 'error').length,
    byDocType: queue.reduce((acc, q) => {
      const type = q.classification.documentType || 'unclassified';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  const progress = queue.length > 0
    ? Math.round((queue.filter(q => q.status === 'done' || q.status === 'error').length / queue.length) * 100)
    : 0;

  return {
    queue,
    isProcessing,
    isComplete,
    progress,
    stats,
    properties: properties || [],
    addFiles,
    processAll,
    retryItem,
    removeItem,
    setPropertyForItem,
    clearQueue,
  };
}
