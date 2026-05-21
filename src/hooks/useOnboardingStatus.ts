import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useOnboardingStatus() {
  const { user, loading } = useAuth();

  return useQuery({
    queryKey: ['onboarding-status', user?.id],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data.onboarding_completed as boolean;
    },
    enabled: !!user && !loading,
    staleTime: 5 * 60 * 1000,
  });
}
