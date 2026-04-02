import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import type { CommentAuthorType } from '@/lib/maintenanceTypes';

type MaintenanceCommentInsert = Database['public']['Tables']['maintenance_comments']['Insert'];

export interface MaintenanceComment {
  id: string;
  org_id: string;
  maintenance_request_id: string;
  author_type: CommentAuthorType;
  author_name: string;
  comment: string;
  photo_urls: string[] | null;
  is_internal: boolean;
  created_at: string;
}

export function useMaintenanceComments(requestId: string | undefined) {
  return useQuery({
    queryKey: ['maintenance_comments', requestId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('maintenance_comments')
        .select('*')
        .eq('maintenance_request_id', requestId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as MaintenanceComment[];
    },
    enabled: !!requestId,
  });
}

export function useAddMaintenanceComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (comment: {
      maintenance_request_id: string;
      author_type: CommentAuthorType;
      author_name: string;
      comment: string;
      is_internal?: boolean;
      photo_urls?: string[] | null;
    }) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const payload: MaintenanceCommentInsert = { ...comment, org_id: orgId };
      const { data, error } = await (supabase as any)
        .from('maintenance_comments')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_comments', vars.maintenance_request_id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_overview'] });
    },
  });
}
