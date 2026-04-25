import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/hooks/useEdgeFunction';
import { useUserOrg } from '@/hooks/useUserOrg';
import { useToast } from '@/hooks/use-toast';

export interface MonthlyProjection {
  month: number;
  date: string;
  gross_rent: number;
  void_loss: number;
  net_rent: number;
  mortgage_payment: number;
  maintenance: number;
  management: number;
  insurance: number;
  other_costs: number;
  net_cashflow: number;
  cumulative_cashflow: number;
  property_value: number;
  mortgage_balance: number;
  equity: number;
}

export interface ForecastScenarios {
  base: MonthlyProjection[];
  pessimistic: MonthlyProjection[];
  optimistic: MonthlyProjection[];
}

export interface FinancialForecast {
  id: string;
  org_id: string;
  forecast_type: 'cashflow' | 'stress_test' | 'rate_scenario';
  name: string;
  parameters: {
    rent_growth_pct: number;
    void_rate_pct: number;
    maintenance_pct: number;
    rate_change_bps: number;
  };
  results: MonthlyProjection[];
  scenarios: ForecastScenarios | null;
  ai_commentary: string | null;
  model_used: string | null;
  created_at: string;
}

export interface RunForecastParams {
  forecast_type: 'cashflow' | 'stress_test' | 'rate_scenario';
  time_horizon_months: 12 | 24 | 60;
  assumptions: {
    rent_growth_pct: number;
    void_rate_pct: number;
    maintenance_pct: number;
    rate_change_bps: number;
  };
  name?: string;
}

export function useFinancialForecasts() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['financial-forecasts', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabaseAny
        .from('financial_forecasts')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as FinancialForecast[];
    },
    enabled: !!orgId,
  });
}

export function useRunForecast() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (params: RunForecastParams) =>
      invokeEdgeFunction<FinancialForecast>('financial-forecast', params as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-forecasts'] });
      toast({ title: 'Forecast generated successfully' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to generate forecast',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useForecastDetail(id: string | undefined) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['financial-forecast', id],
    queryFn: async () => {
      if (!id || !orgId) return null;

      const { data, error } = await supabaseAny
        .from('financial_forecasts')
        .select('*')
        .eq('id', id)
        .eq('org_id', orgId)
        .single();

      if (error) throw error;
      return data as unknown as FinancialForecast;
    },
    enabled: !!id && !!orgId,
  });
}
