import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserOrg } from '@/hooks/useUserOrg';

export interface Organization {
  id: string;
  name: string;
  property_types?: string[];
  region_focus?: string;
  estimated_portfolio_size?: string;
}

export function useOrganization() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabaseAny
        .from('organizations')
        .select('id, name, property_types, region_focus, estimated_portfolio_size')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      return data as Organization;
    },
    enabled: !!orgId,
  });
}

interface UpdateOrgParams {
  orgId: string;
  name?: string;
  property_types?: string[];
  region_focus?: string;
  estimated_portfolio_size?: string;
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ orgId, ...updates }: UpdateOrgParams) => {
      const { data, error } = await supabaseAny
        .from('organizations')
        .update({
          ...updates,
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
      toast({ title: 'Organization updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update organization', description: error.message, variant: 'destructive' });
    },
  });
}
