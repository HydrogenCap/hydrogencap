import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from './useEdgeFunction';
import { fetchUserOrgId } from './useUserOrg';
import { showMutationError, showMutationSuccess } from '@/lib/errorToast';

export interface DocumentExtraction {
  id: string;
  document_id: string;
  org_id: string;
  extraction_version: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review';
  doc_type: string | null;
  doc_type_confidence: number | null;
  extracted_fields: Record<string, string | null>;
  field_confidences: Record<string, number>;
  pages_processed: number;
  total_pages: number;
  processing_time_ms: number | null;
  model_used: string | null;
  needs_human_review: boolean;
  review_reasons: string[];
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch extractions that need human review for the current org.
 */
export function useExtractionReviewQueue() {
  return useQuery({
    queryKey: ['document-extractions', 'review-queue'],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabaseAny
        .from('document_extractions')
        .select('*')
        .eq('org_id', orgId)
        .eq('needs_human_review', true)
        .in('status', ['needs_review', 'completed'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as DocumentExtraction[];
    },
  });
}

/**
 * Fetch all extractions for a specific document.
 */
export function useDocumentExtractions(documentId?: string) {
  return useQuery({
    queryKey: ['document-extractions', documentId],
    queryFn: async () => {
      if (!documentId) return [];

      const { data, error } = await supabaseAny
        .from('document_extractions')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as DocumentExtraction[];
    },
    enabled: !!documentId,
  });
}

/**
 * Trigger the V2 extraction pipeline for a document.
 */
export function useProcessDocumentV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      document_url: string;
      document_id: string;
      property_id?: string;
      org_id: string;
    }) => {
      return invokeEdgeFunction<{
        success: boolean;
        extraction_id: string;
        status: string;
        doc_type: string;
        doc_type_confidence: number;
        extracted_fields: Record<string, string | null>;
        field_confidences: Record<string, number>;
        needs_human_review: boolean;
        review_reasons: string[];
      }>('process-document-v2', params);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['document-extractions'] });
      if (data.needs_human_review) {
        showMutationSuccess('Document processed - needs review');
      } else {
        showMutationSuccess('Document processed successfully');
      }
    },
    onError: (error) => {
      showMutationError(error, 'Failed to process document');
    },
  });
}

/**
 * Approve an extraction: accept extracted fields and mark as reviewed.
 */
export function useApproveExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ extractionId, editedFields }: {
      extractionId: string;
      editedFields?: Record<string, string | null>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updatePayload: Record<string, unknown> = {
        status: 'completed',
        needs_human_review: false,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };

      if (editedFields) {
        updatePayload.extracted_fields = editedFields;
      }

      const { data, error } = await supabaseAny
        .from('document_extractions')
        .update(updatePayload)
        .eq('id', extractionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-extractions'] });
      showMutationSuccess('Extraction approved');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to approve extraction');
    },
  });
}

/**
 * Reject an extraction: mark as failed so it drops out of the review queue.
 */
export function useRejectExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (extractionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabaseAny
        .from('document_extractions')
        .update({
          status: 'failed',
          needs_human_review: false,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', extractionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-extractions'] });
      showMutationSuccess('Extraction rejected');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to reject extraction');
    },
  });
}
