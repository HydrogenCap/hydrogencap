import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrg } from '@/hooks/useUserOrg';
import { useToast } from '@/hooks/use-toast';

export function useInvestorCommitments(investorId: string | undefined) {
  return useQuery({
    queryKey: ['investor-commitment-detail', investorId],
    queryFn: async () => {
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data: result, error } = await supabase
        .from('investor_commitments')
        .insert([{ ...data, org_id: orgId! } as any])
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
      const { data: result, error } = await supabase
        .from('investor_distributions')
        .insert([{ ...data, org_id: orgId! } as any])
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
