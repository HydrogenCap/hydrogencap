import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useUserOrg } from '../useUserOrg';
import { type RentTrendPoint } from './types';

export function useRentTrend(months = 12) {
  const { data: orgId } = useUserOrg();
  return useQuery({
    queryKey: ['rent_trend', orgId, months],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months + 1);
      cutoff.setDate(1);
      const { data, error } = await supabaseAny
        .from('rent_schedule')
        .select('due_date, rent_amount, additional_charges, amount_paid, status')
        .eq('org_id', orgId!)
        .gte('due_date', cutoff.toISOString().split('T')[0])
        .order('due_date');
      if (error) throw error;
      const map = new Map<string, { due: number; paid: number; outstanding: number }>();
      for (const row of data || []) {
        const month = (row.due_date as string).slice(0, 7);
        const existing = map.get(month) ?? { due: 0, paid: 0, outstanding: 0 };
        const due = (row.rent_amount ?? 0) + (row.additional_charges ?? 0);
        const isArrears = row.status === 'overdue' || row.status === 'partial';
        map.set(month, {
          due: existing.due + due,
          paid: existing.paid + (row.amount_paid ?? 0),
          outstanding: existing.outstanding + (isArrears ? Math.max(0, due - (row.amount_paid ?? 0)) : 0),
        });
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]): RentTrendPoint => ({
          month,
          label: new Date(month + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
          ...v,
        }));
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}
