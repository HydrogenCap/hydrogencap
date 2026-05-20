import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

export interface SavedView {
  id: string;
  org_id: string;
  user_id: string;
  scope: string;
  name: string;
  filters_json: Record<string, unknown>;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Saved filter/sort presets for any list page. Identified by a string `scope`
 * (e.g. "properties", "compliance", "tasks"). Each user sees their own views
 * plus any shared views in their organisation.
 */
export function useSavedViews(scope: string) {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();

  return useQuery({
    queryKey: ['saved_views', scope, activeOrgId, user?.id],
    enabled: !!user?.id && !!activeOrgId,
    queryFn: async (): Promise<SavedView[]> => {
      const { data, error } = await (supabase as any)
        .from('saved_views')
        .select('*')
        .eq('scope', scope)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SavedView[];
    },
  });
}

export function useCreateSavedView() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();

  return useMutation({
    mutationFn: async (input: {
      scope: string;
      name: string;
      filters: Record<string, unknown>;
      is_shared?: boolean;
    }) => {
      if (!user?.id || !activeOrgId) throw new Error('Not signed in');
      const { data, error } = await (supabase as any)
        .from('saved_views')
        .insert({
          scope: input.scope,
          name: input.name,
          filters_json: input.filters,
          is_shared: input.is_shared ?? false,
          user_id: user.id,
          org_id: activeOrgId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SavedView;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['saved_views', row.scope] });
    },
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('saved_views').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved_views'] }),
  });
}
