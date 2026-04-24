import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrg } from '@/hooks/useUserOrg';

export type AppRole = 'owner' | 'admin' | 'member' | 'accountant' | 'viewer';

export function useUserRole() {
  const { user } = useAuth();
  const { data: orgId } = useUserOrg();

  const { data: role, isLoading } = useQuery({
    queryKey: ['user-role', user?.id, orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('memberships')
        .select('role')
        .eq('user_id', user!.id)
        .eq('org_id', orgId!)
        .single();
      if (error) throw error;
      return data.role as AppRole;
    },
    enabled: !!user && !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    role: role ?? 'viewer' as AppRole,
    isOwner: role === 'owner',
    isAdmin: role === 'owner' || role === 'admin',
    isViewer: role === 'viewer',
    isLoading,
  };
}
