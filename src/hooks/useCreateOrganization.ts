import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { setCurrentOrgId } from '@/hooks/useUserOrg';

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Create the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create owner membership
      const { error: memberError } = await supabase
        .from('memberships')
        .insert({
          user_id: userData.user.id,
          org_id: org.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      // Switch to the new org
      setCurrentOrgId(org.id);

      return org;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['user-org'] });
      queryClient.invalidateQueries();
      toast({ title: 'Organization created' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to create organization',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
