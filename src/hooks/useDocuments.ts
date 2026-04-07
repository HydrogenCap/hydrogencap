import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { ActivityLoggers } from './useActivityLog';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { showMutationError, showMutationSuccess } from '@/lib/errorToast';
import { resolveManagedDocumentUrls } from './useDocumentManagement';

type Document = Database['public']['Tables']['documents']['Row'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

export function useDocuments(propertyId?: string, options?: { page?: number; pageSize?: number }) {
  const page = options?.page;
  const pageSize = options?.pageSize ?? 25;

  return useQuery({
    queryKey: ['documents', propertyId, page, pageSize],
    queryFn: async () => {
      let query = (supabase as any)
        .from('documents')
        .select('id, org_id, property_id, company_id, tenant_id, tenancy_id, compliance_item_id, contractor_job_id, file_url, original_file_name, display_name, final_file_name, doc_type, category, tags, file_type, file_size_bytes, mime_type, description, document_date, expiry_date, review_status, is_confidential, visible_to_shareholders, visible_to_tenants, version, is_current_version, uploaded_by, created_at, updated_at, deleted_at', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      if (page) {
        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      const items = await resolveManagedDocumentUrls((data ?? []) as Document[]);
      const total = count ?? items.length;
      return {
        items,
        total,
        page: page ?? 1,
        pageSize: page ? pageSize : total || 1,
        totalPages: page ? Math.ceil(total / pageSize) : 1,
      };
    },
  });
}

export function useInboxDocuments() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('inbox-documents')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'documents',
        filter: 'review_status=eq.pending',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['documents', 'inbox'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['documents', 'inbox'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('documents')
        .select('id, org_id, property_id, company_id, tenant_id, tenancy_id, compliance_item_id, contractor_job_id, file_url, original_file_name, display_name, final_file_name, doc_type, category, tags, file_type, file_size_bytes, mime_type, description, document_date, expiry_date, review_status, extraction_status, ai_suggested_doc_type, ai_doc_type_confidence, ai_suggested_property_id, ai_property_confidence, validation_errors, ai_extracted_data, is_confidential, visible_to_shareholders, visible_to_tenants, version, is_current_version, uploaded_by, created_at, updated_at, deleted_at')
        .eq('review_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return resolveManagedDocumentUrls((data ?? []) as Document[]);
    },
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (document: Omit<DocumentInsert, 'org_id'>) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await (supabase as any)
        .from('documents')
        .insert({ ...document, org_id: orgId, uploaded_by: document.uploaded_by ?? user?.id ?? null })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.property_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', data.property_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['documents', undefined] });
      queryClient.invalidateQueries({ queryKey: ['documents', 'inbox'] });
      ActivityLoggers.documentUploaded(
        data.property_id,
        data.original_file_name,
        data.doc_type || undefined
      );
      showMutationSuccess('Document created');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to create document');
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, wasAccepted, ...document }: DocumentUpdate & { id: string; wasAccepted?: boolean }) => {
      const { data, error } = await (supabase as any)
        .from('documents')
        .update(document)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Log if document was just accepted
      if (wasAccepted !== true && document.review_status === 'accepted') {
        ActivityLoggers.documentAccepted(
          data.property_id,
          data.original_file_name,
          data.doc_type || 'Document'
        );
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      if (data.review_status === 'accepted') {
        queryClient.invalidateQueries({ queryKey: ['documents', 'inbox'] });
      }
      showMutationSuccess('Document updated');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update document');
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showMutationSuccess('Document deleted');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to delete document');
    },
  });
}

export function useBulkAcceptDocuments() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (documentIds: string[]) => {
      const { error } = await (supabase as any)
        .from('documents')
        .update({ 
          review_status: 'accepted',
        })
        .in('id', documentIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showMutationSuccess('Documents accepted');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to accept documents');
    },
  });
}
