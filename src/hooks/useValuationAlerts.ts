import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useUserOrg } from './useUserOrg';
import { showMutationError } from '@/lib/errorToast';

export interface ValuationAlert {
  id: string;
  org_id: string;
  property_id: string;
  alert_type: string;
  title: string;
  message: string;
  recorded_value_gbp: number | null;
  estimated_value_gbp: number | null;
  change_percent: number | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface ValuationAlertWithAddress extends ValuationAlert {
  property_address: string;
}

export function useValuationAlerts(includeDismissed = false) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['valuation_alerts', orgId, includeDismissed],
    enabled: !!orgId,
    queryFn: async () => {
      let query = supabaseAny
        .from('valuation_alerts')
        .select('*, properties_v2!inner(address_line_1, postcode)')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });
      if (!includeDismissed) {
        query = query.eq('is_dismissed', false);
      }
      const { data, error } = await query;
      if (error) throw error;
      type WithNested = ValuationAlert & {
        properties_v2?: { address_line_1?: string; postcode?: string } | null;
      };
      return ((data || []) as WithNested[]).map((d) => ({
        ...d,
        property_address: `${d.properties_v2?.address_line_1}, ${d.properties_v2?.postcode}`,
      })) as ValuationAlertWithAddress[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useUndismissedAlertCount() {
  const { data: alerts } = useValuationAlerts(false);
  return alerts?.length ?? 0;
}

export function useDismissValuationAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny
        .from('valuation_alerts')
        .update({ is_dismissed: true, is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['valuation_alerts'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to dismiss alert');
    },
  });
}
