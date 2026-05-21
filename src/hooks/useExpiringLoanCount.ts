import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';

/**
 * Count of active loan facilities whose fixed-rate period ends within
 * `windowDays`. Used by the dashboard banner + sidebar Lending badge.
 */
export function useExpiringLoanCount(windowDays = 180) {
  const { data } = useQuery({
    queryKey: ['expiring-loan-count', windowDays],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + windowDays);
      const { count, error } = await supabaseAny
        .from('loan_facilities')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .not('rate_expiry_date', 'is', null)
        .gte('rate_expiry_date', new Date().toISOString().split('T')[0])
        .lte('rate_expiry_date', cutoff.toISOString().split('T')[0]);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 5 * 60_000,
  });

  return data ?? 0;
}
