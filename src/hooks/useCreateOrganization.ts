import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { setCurrentOrgId } from '@/hooks/useUserOrg';
import { toast } from "sonner";

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Use SECURITY DEFINER RPC that atomically creates the org and owner
      // membership. Direct client-side INSERT into memberships is no longer
      // permitted by RLS (would otherwise allow cross-org takeover).
      const { data: org, error } = await supabaseAny.rpc('create_organization', {
        p_name: name,
      });

      if (error) throw error;
      if (!org) throw new Error('Failed to create organization');

      // Switch to the new org
      setCurrentOrgId(org.id);

      return org;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['user-org'] });
      queryClient.invalidateQueries();
      toast.success('Organization created');
    },
    onError: (error) => {
      toast.error('Failed to create organization', { description: error.message });
    },
  });
}
