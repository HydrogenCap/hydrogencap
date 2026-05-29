import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useUserOrg } from '@/hooks/useUserOrg';
import { toast } from "sonner";

export interface Organization {
  id: string;
  name: string;
}

export function useOrganization() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabaseAny
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      return data as Organization;
    },
    enabled: !!orgId,
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, name }: { orgId: string; name: string }) => {
      const { data, error } = await supabaseAny
        .from('organizations')
        .update({
          name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orgId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['user-organizations'] });
      toast.success('Organization updated');
    },
    onError: (error) => {
      toast.error('Failed to update organization', { description: error.message });
    },
  });
}
