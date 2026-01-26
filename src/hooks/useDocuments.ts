import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { ActivityLoggers } from './useActivityLog';

type Document = Database['public']['Tables']['documents']['Row'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

async function getUserOrgId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  
  if (error || !data) return null;
  return data.org_id;
}

export function useDocuments(propertyId?: string) {
  return useQuery({
    queryKey: ['documents', propertyId],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Document[];
    },
  });
}

export function useInboxDocuments() {
  return useQuery({
    queryKey: ['documents', 'inbox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('review_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Document[];
    },
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (document: Omit<DocumentInsert, 'org_id'>) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('documents')
        .insert({ ...document, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      // Log activity
      ActivityLoggers.documentUploaded(
        data.property_id,
        data.original_file_name,
        data.doc_type || undefined
      );
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, wasAccepted, ...document }: DocumentUpdate & { id: string; wasAccepted?: boolean }) => {
      const { data, error } = await supabase
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useBulkAcceptDocuments() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (documentIds: string[]) => {
      const { error } = await supabase
        .from('documents')
        .update({ 
          review_status: 'accepted',
        })
        .in('id', documentIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
    },
  });
}
