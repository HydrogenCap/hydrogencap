import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { toV2DocumentType } from '@/hooks/useComplianceIntake';

export interface DiagnosticDoc {
  id: string;
  file_name: string;
  doc_type: string | null;
  expiry_date: string | null;
  extraction_status: string | null;
}

export interface MissingCellDiagnostic {
  /** Accepted docs in the Inbox for this property whose mapped v2 type matches but
   *  never landed in compliance_documents_v2 — classification/filing issue. */
  unfiledDocs: DiagnosticDoc[];
  /** Pending (still extracting / awaiting review) docs for this property of the
   *  matching v2 type — the cert exists, AI just hasn't finished. */
  pendingDocs: DiagnosticDoc[];
}

export interface MissingDiagnostics {
  /** Keyed by `${property_id}:${v2_doc_type}` */
  byCell: Map<string, MissingCellDiagnostic>;
  /** Accepted docs of a matching v2 type with NO property_id assigned (org-level orphan). */
  orphanByType: Map<string, DiagnosticDoc[]>;
}

interface DocRow {
  id: string;
  property_id: string | null;
  doc_type: string | null;
  ai_suggested_doc_type: string | null;
  review_status: string | null;
  extraction_status: string | null;
  original_file_name: string | null;
  final_file_name: string | null;
  expiry_date: string | null;
}

interface FiledRow {
  property_id: string;
  document_type: string;
}

const EMPTY: MissingDiagnostics = { byCell: new Map(), orphanByType: new Map() };

export function useMissingComplianceDiagnostics(orgId?: string) {
  return useQuery({
    queryKey: ['missing-compliance-diagnostics', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<MissingDiagnostics> => {
      if (!orgId) return EMPTY;

      const [docsRes, filedRes] = await Promise.all([
        supabaseAny
          .from('documents')
          .select('id, property_id, doc_type, ai_suggested_doc_type, review_status, extraction_status, original_file_name, final_file_name, expiry_date')
          .eq('org_id', orgId)
          .in('review_status', ['accepted', 'pending']),
        supabaseAny
          .from('compliance_documents_v2')
          .select('property_id, document_type')
          .eq('org_id', orgId)
          .eq('is_current', true),
      ]);

      if (docsRes.error) throw docsRes.error;
      if (filedRes.error) throw filedRes.error;

      const docs = (docsRes.data || []) as DocRow[];
      const filed = (filedRes.data || []) as FiledRow[];
      const filedSet = new Set(filed.map(r => `${r.property_id}:${r.document_type}`));

      const byCell = new Map<string, MissingCellDiagnostic>();
      const orphanByType = new Map<string, DiagnosticDoc[]>();
      const cell = (k: string) => {
        let v = byCell.get(k);
        if (!v) { v = { unfiledDocs: [], pendingDocs: [] }; byCell.set(k, v); }
        return v;
      };

      for (const d of docs) {
        const slug = d.doc_type || d.ai_suggested_doc_type;
        if (!slug) continue;
        const v2 = toV2DocumentType(slug);
        if (v2 === 'other') continue;
        const meta: DiagnosticDoc = {
          id: d.id,
          file_name: d.final_file_name || d.original_file_name || 'Unnamed document',
          doc_type: slug,
          expiry_date: d.expiry_date,
          extraction_status: d.extraction_status,
        };
        if (!d.property_id) {
          if (d.review_status === 'accepted') {
            const arr = orphanByType.get(v2) || [];
            arr.push(meta);
            orphanByType.set(v2, arr);
          }
          continue;
        }
        const key = `${d.property_id}:${v2}`;
        if (d.review_status === 'pending') {
          cell(key).pendingDocs.push(meta);
        } else if (d.review_status === 'accepted' && !filedSet.has(key)) {
          cell(key).unfiledDocs.push(meta);
        }
      }

      return { byCell, orphanByType };
    },
  });
}

export function diagnosticTotal(d?: MissingCellDiagnostic | null): number {
  if (!d) return 0;
  return d.unfiledDocs.length + d.pendingDocs.length;
}
