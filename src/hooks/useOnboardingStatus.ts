import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useOnboardingStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['onboarding-status', user?.id],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('profiles')
        .select('onboarding_completed, onboarding_step')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return {
        completed: data.onboarding_completed as boolean,
        step: data.onboarding_step as number || 0,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
