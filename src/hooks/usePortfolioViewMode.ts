/**
 * Per-user persistent portfolio view-mode preference: "gross" vs "mine"
 * (my attributable share of value/debt/rent/cashflow).
 *
 * Persisted on profiles.portfolio_view_mode and mirrored to localStorage
 * for fast first paint.
 */
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';

export type PortfolioViewMode = 'gross' | 'mine';

const LS_KEY = 'portfolio_view_mode';

function readLocal(): PortfolioViewMode {
  if (typeof window === 'undefined') return 'gross';
  const v = window.localStorage.getItem(LS_KEY);
  return v === 'mine' ? 'mine' : 'gross';
}

export function usePortfolioViewMode() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['portfolio_view_mode'],
    queryFn: async (): Promise<{ mode: PortfolioViewMode; userId: string | null; fullName: string | null; email: string | null }> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id || null;
      if (!uid) return { mode: readLocal(), userId: null, fullName: null, email: null };
      const { data, error } = await supabaseAny
        .from('profiles')
        .select('portfolio_view_mode, full_name, email')
        .eq('user_id', uid)
        .maybeSingle();
      if (error) {
        return { mode: readLocal(), userId: uid, fullName: null, email: auth.user?.email || null };
      }
      const mode = (data?.portfolio_view_mode === 'mine' ? 'mine' : 'gross') as PortfolioViewMode;
      return {
        mode,
        userId: uid,
        fullName: data?.full_name ?? null,
        email: data?.email ?? auth.user?.email ?? null,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Mirror to localStorage for fast first paint.
  useEffect(() => {
    if (query.data?.mode && typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY, query.data.mode);
    }
  }, [query.data?.mode]);

  const setMode = useMutation({
    mutationFn: async (mode: PortfolioViewMode) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (typeof window !== 'undefined') window.localStorage.setItem(LS_KEY, mode);
      if (!uid) return mode;
      const { error } = await supabaseAny
        .from('profiles')
        .update({ portfolio_view_mode: mode })
        .eq('user_id', uid);
      if (error) throw error;
      return mode;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio_view_mode'] });
      qc.invalidateQueries({ queryKey: ['portfolio_kpis_v2'] });
    },
  });

  return {
    mode: query.data?.mode ?? readLocal(),
    userId: query.data?.userId ?? null,
    fullName: query.data?.fullName ?? null,
    email: query.data?.email ?? null,
    isLoading: query.isLoading,
    setMode: (m: PortfolioViewMode) => setMode.mutate(m),
    isSaving: setMode.isPending,
  };
}
