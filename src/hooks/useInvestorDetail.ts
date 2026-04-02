import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useUserOrg } from '@/hooks/useUserOrg';
import { useToast } from '@/hooks/use-toast';

type InvestorCommitmentInsert = Database['public']['Tables']['investor_commitments']['Insert'];
type InvestorDistributionInsert = Database['public']['Tables']['investor_distributions']['Insert'];

export function useInvestorCommitments(investorId: string | undefined) {
  return useQuery({
    queryKey: ['investor-commitment-detail', investorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('investor_commitment_detail')
        .select('*')
        .eq('investor_id', investorId!);
      if (error) throw error;
      return data;
    },
    enabled: !!investorId,
  });
}

export function useInvestorDistributions(investorId: string | undefined) {
  return useQuery({
    queryKey: ['investor-distributions', investorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('investor_distributions')
        .select('*')
        .eq('investor_id', investorId!)
        .order('distribution_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!investorId,
  });
}

export function useInvestorReturnMetrics(investorId: string | undefined) {
  return useQuery({
    queryKey: ['investor-return-metrics', investorId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('investor_return_metrics')
        .select('*')
        .eq('investor_id', investorId!);
      if (error) throw error;
      return data;
    },
    enabled: !!investorId,
  });
}

export function useCreateCommitment() {
  const queryClient = useQueryClient();
  const { data: orgId } = useUserOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      investor_id: string;
      entity_id: string;
      commitment_type: string;
      committed_amount: number;
      drawn_amount: number;
      equity_percentage?: number | null;
      commitment_date: string;
      maturity_date?: string | null;
      coupon_rate?: number | null;
      payment_frequency?: string | null;
      status?: string;
      documentation_url?: string | null;
      notes?: string | null;
    }) => {
      const payload: InvestorCommitmentInsert = { ...data, org_id: orgId! };
      const { data: result, error } = await (supabase as any)
        .from('investor_commitments')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-commitment-detail'] });
      queryClient.invalidateQueries({ queryKey: ['investor-portfolio-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['investor-return-metrics'] });
      toast({ title: 'Commitment added' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error adding commitment', description: err.message, variant: 'destructive' });
    },
  });
}

export function useCreateDistribution() {
  const queryClient = useQueryClient();
  const { data: orgId } = useUserOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      investor_id: string;
      commitment_id: string;
      entity_id: string;
      distribution_type: string;
      amount: number;
      distribution_date: string;
      tax_deducted?: number | null;
      period_from?: string | null;
      period_to?: string | null;
      payment_reference?: string | null;
      payment_method?: string | null;
      status?: string;
      notes?: string | null;
    }) => {
      const payload: InvestorDistributionInsert = { ...data, org_id: orgId! };
      const { data: result, error } = await (supabase as any)
        .from('investor_distributions')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investor-distributions'] });
      queryClient.invalidateQueries({ queryKey: ['investor-portfolio-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['investor-return-metrics'] });
      toast({ title: 'Distribution recorded' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error recording distribution', description: err.message, variant: 'destructive' });
    },
  });
}
