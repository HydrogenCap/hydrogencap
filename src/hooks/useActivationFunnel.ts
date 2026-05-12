import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActivationStage {
  count: number;
  median_hours: number | null;
  p75_hours: number | null;
}

export interface ActivationFunnelData {
  total_orgs: number;
  first_property: ActivationStage;
  first_cert: ActivationStage;
  first_payment: ActivationStage;
  funnel: {
    signed_up: number;
    has_property: number;
    has_cert: number;
    has_payment: number;
  };
}

export async function fetchActivationFunnel(): Promise<ActivationFunnelData> {
  const { data, error } = await supabase.functions.invoke('admin-stats', {
    body: { action: 'activation_funnel' },
  });
  if (error) throw error;
  return data as ActivationFunnelData;
}

export function useActivationFunnel() {
  return useQuery({
    queryKey: ['admin', 'activation-funnel'],
    queryFn: fetchActivationFunnel,
    staleTime: 5 * 60 * 1000,
  });
}
