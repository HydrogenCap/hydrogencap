import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedInsuranceFields {
  insurer_name?: string;
  policy_number?: string;
  policy_type?: string;
  start_date?: string;
  end_date?: string;
}

export interface InsuranceScanResult {
  id: string;
  fileName: string;
  status: 'uploading' | 'scanning' | 'done' | 'failed';
  error?: string;
  extracted?: ExtractedInsuranceFields;
}

export interface PropertyRef {
  id: string;
  address_line: string;
  postcode?: string | null;
}

// ─── Map AI doc_type → insurance policy_type ─────────────────────────────────

function mapDocType(docType: string): string | undefined {
  switch (docType) {
    case 'building_insurance': return 'buildings';
    case 'public_liability_insurance': return 'landlord';
    default: return undefined;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInsuranceDocScan() {
  const [scans, setScans] = useState<InsuranceScanResult[]>([]);

  const update = useCallback((id: string, patch: Partial<InsuranceScanResult>) => {
    setScans(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  /**
   * Upload and AI-scan multiple files.
   * `properties` should be the full list of org properties so the edge
   * function can match the document's address to a property.
   */
  const scan = useCallback(async (files: File[], properties: PropertyRef[]) => {
    if (!files.length) return;

    const orgId = await fetchUserOrgId();
    if (!orgId) return;

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    // Register all files in state immediately so UI can show spinners
    const entries: InsuranceScanResult[] = files.map(f => ({
      id: crypto.randomUUID(),
      fileName: f.name,
      status: 'uploading' as const,
    }));
    setScans(prev => [...prev, ...entries]);

    // Ensure the edge fn gets at least one property entry
    const propRefs: PropertyRef[] = properties.length > 0
      ? properties
      : [{ id: crypto.randomUUID(), address_line: 'Unknown', postcode: null }];

    await Promise.all(files.map(async (file, i) => {
      const scanId = entries[i].id;

      try {
        // 1 ── Upload file to Supabase Storage
        // Path must start with orgId to satisfy the bucket RLS policy
        const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
        const storagePath = `${orgId}/insurance/${scanId}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('compliance-documents')
          .upload(storagePath, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });
        if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

        // 2 ── Create a document record (edge fn validates ownership via this)
        const { data: docRow, error: docErr } = await (supabase as any)
          .from('documents')
          .insert({
            org_id: orgId,
            uploaded_by: userId,
            original_file_name: file.name,
            file_url: storagePath,
            doc_type: 'building_insurance',
            extraction_status: 'pending',
            review_status: 'pending',
            mime_type: file.type || 'application/octet-stream',
            file_size_bytes: file.size,
          })
          .select('id')
          .single();
        if (docErr || !docRow) throw new Error('Failed to create document record');

        // 3 ── Get a short-lived signed URL (5 min) for the edge fn to fetch
        const { data: signed } = await supabase.storage
          .from('compliance-documents')
          .createSignedUrl(storagePath, 300);
        if (!signed?.signedUrl) throw new Error('Failed to create signed URL');

        update(scanId, { status: 'scanning' });

        // 4 ── Call process-document edge function
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('process-document', {
          body: {
            documentId: docRow.id,
            fileUrl: signed.signedUrl,
            properties: propRefs.map(p => ({
              id: p.id,
              address_line: p.address_line,
              postcode: p.postcode ?? null,
            })),
          },
        });
        if (fnErr) throw new Error(fnErr.message || 'Edge function error');

        // 5 ── Map AI extraction → form fields
        const ex = fnData?.extraction;
        const extracted: ExtractedInsuranceFields = {};

        if (ex?.extracted_certifier_company) extracted.insurer_name = ex.extracted_certifier_company;
        if (ex?.extracted_reference_number) extracted.policy_number = ex.extracted_reference_number;
        if (ex?.extracted_issue_date) extracted.start_date = ex.extracted_issue_date;
        if (ex?.extracted_expiry_date) extracted.end_date = ex.extracted_expiry_date;
        const mappedType = mapDocType(ex?.doc_type || '');
        if (mappedType) extracted.policy_type = mappedType;

        update(scanId, { status: 'done', extracted });
      } catch (err) {
        update(scanId, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Scan failed',
        });
      }
    }));
  }, [update]);

  const clear = useCallback(() => setScans([]), []);

  return { scans, scan, clear };
}
