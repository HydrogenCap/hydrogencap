import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type PortfolioBand = '1' | '2-5' | '6-20' | '21+';

interface WelcomeProfile {
  user_id: string;
  welcome_seen_at: string | null;
  portfolio_size_band: PortfolioBand | null;
}

/**
 * Drives the first-login Welcome Overlay. `shouldShow` is true ONLY when the
 * current user's profile row has `welcome_seen_at IS NULL`. The overlay self-
 * dismisses by calling `markSeen`. `setBand` records the user's reported
 * portfolio size for analytics / activation segmentation.
 */
export function useWelcomeOverlay() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['welcome-profile', user?.id],
    queryFn: async (): Promise<WelcomeProfile | null> => {
      if (!user) return null;
      const { data, error } = await supabaseAny
        .from('profiles')
        .select('user_id, welcome_seen_at, portfolio_size_band')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as WelcomeProfile | null) ?? null;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const markSeenMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabaseAny
        .from('profiles')
        .update({ welcome_seen_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcome-profile'] });
    },
  });

  const setBandMutation = useMutation({
    mutationFn: async (band: PortfolioBand) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabaseAny
        .from('profiles')
        .update({ portfolio_size_band: band })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcome-profile'] });
    },
  });

  const profile = profileQuery.data;
  // Only show once the profile has loaded and the timestamp is null.
  const shouldShow = !!user && !profileQuery.isLoading && !!profile && profile.welcome_seen_at === null;

  return {
    shouldShow,
    isLoading: profileQuery.isLoading,
    band: profile?.portfolio_size_band ?? null,
    markSeen: () => markSeenMutation.mutateAsync(),
    setBand: (band: PortfolioBand) => setBandMutation.mutateAsync(band),
  };
}

export type { PortfolioBand };
