import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrg } from '@/hooks/useUserOrg';
import { toast } from 'sonner';

export interface AcquisitionAnalysis {
  id: string;
  org_id: string;
  address: string;
  postcode: string | null;
  asking_price: number | null;
  estimated_rental: number | null;
  property_type: string | null;
  beds: number | null;
  notes: string | null;
  overall_score: number | null;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid' | null;
  strengths: string[];
  weaknesses: string[];
  financial_analysis: {
    gross_yield?: number | null;
    net_yield?: number | null;
    monthly_cashflow?: number | null;
    annual_roi?: number | null;
    price_per_bed?: number | null;
    sdlt_estimate?: number | null;
    total_acquisition_cost?: number | null;
  };
  portfolio_fit_analysis: {
    diversification_impact?: string;
    geographic_concentration_risk?: string;
    type_concentration_risk?: string;
    lender_diversification_note?: string;
    portfolio_yield_impact?: string;
  };
  area_analysis: {
    rental_demand?: string;
    area_comparison?: string;
    growth_outlook?: string;
  };
  risk_factors: Array<{ factor: string; severity: string; detail: string }>;
  ai_summary: string | null;
  model_used: string | null;
  created_at: string;
}

export interface AcquisitionInput {
  address: string;
  postcode?: string;
  asking_price?: number;
  estimated_rental?: number;
  property_type?: string;
  beds?: number;
  notes?: string;
}

export function useAcquisitionAnalyses() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['acquisition-analyses', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acquisition_analyses')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AcquisitionAnalysis[];
    },
    enabled: !!orgId,
  });
}

export function useAcquisitionDetail(id: string | undefined) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['acquisition-analysis', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acquisition_analyses')
        .select('*')
        .eq('id', id!)
        .eq('org_id', orgId!)
        .single();

      if (error) throw error;
      return data as unknown as AcquisitionAnalysis;
    },
    enabled: !!id && !!orgId,
  });
}

export function useRunAcquisitionAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AcquisitionInput) => {
      const { data, error } = await supabase.functions.invoke('analyse-acquisition', {
        body: input,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as { success: boolean; analysis: AcquisitionAnalysis } & AcquisitionAnalysis;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acquisition-analyses'] });
      toast.success('Acquisition analysis complete');
    },
    onError: (error: Error) => {
      if (error.message.includes('Rate limit')) {
        toast.error('Rate limit exceeded. Please try again in a moment.');
      } else if (error.message.includes('credits')) {
        toast.error('AI credits exhausted. Please add credits to continue.');
      } else if (error.message.includes('subscription')) {
        toast.error('Active subscription required for AI analysis.');
      } else {
        toast.error('Failed to analyse acquisition. Please try again.');
      }
    },
  });
}
