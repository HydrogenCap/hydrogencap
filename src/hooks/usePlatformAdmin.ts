import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePlatformAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['platform-role', user?.id],
    queryFn: async () => {
      if (!user) return 'user';
      const { data } = await (supabase as any)
        .from('profiles')
        .select('platform_role')
        .eq('user_id', user.id)
        .single();
      return data?.platform_role || 'user';
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
}

export function useIsAdmin() {
  const { data: role } = usePlatformAdmin();
  return role === 'admin' || role === 'super_admin';
}
