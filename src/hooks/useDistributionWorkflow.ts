import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserOrg } from '@/hooks/useUserOrg';
import type { AllocationResult } from '@/lib/distribution-calculator';

export interface DistributionRun {
  id: string;
  org_id: string;
  period: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'review' | 'approved' | 'processing' | 'completed' | 'cancelled';
  total_distributable: number;
  total_distributed: number;
  retained_amount: number;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface DistributionLineItem {
  id: string;
  distribution_run_id: string;
  investor_id: string;
  entity_id: string | null;
  property_ids: string[] | null;
  ownership_pct: number;
  gross_amount: number;
  withholding_tax: number;
  net_amount: number;
  payment_method: string | null;
  payment_reference: string | null;
  payment_status: 'pending' | 'paid' | 'failed';
  paid_at: string | null;
  created_at: string;
  investor?: { investor_name: string; email: string | null } | null;
}

export function useDistributionRuns() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['distribution-runs', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_runs')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DistributionRun[];
    },
    enabled: !!orgId,
  });
}

export function useDistributionLineItems(runId: string | null) {
  return useQuery({
    queryKey: ['distribution-line-items', runId],
    queryFn: async () => {
      if (!runId) return [];
      const { data, error } = await supabase
        .from('distribution_line_items')
        .select(`
          *,
          investor:investors!distribution_line_items_investor_id_fkey ( investor_name, email )
        `)
        .eq('distribution_run_id', runId)
        .order('ownership_pct', { ascending: false });

      if (error) throw error;
      return (data || []) as DistributionLineItem[];
    },
    enabled: !!runId,
  });
}

export function useCreateDistributionRun() {
  const qc = useQueryClient();
  const { data: orgId } = useUserOrg();

  return useMutation({
    mutationFn: async (payload: {
      period: string;
      period_start: string;
      period_end: string;
      total_distributable: number;
      total_distributed: number;
      retained_amount: number;
      notes?: string;
      allocations: AllocationResult[];
    }) => {
      const { allocations, ...runData } = payload;

      const { data: run, error } = await supabase
        .from('distribution_runs')
        .insert({ ...runData, org_id: orgId!, status: 'draft' })
        .select()
        .single();

      if (error) throw error;

      if (allocations.length > 0) {
        const lineItems = allocations.map(a => ({
          distribution_run_id: run.id,
          investor_id: a.investorId,
          entity_id: a.entityId || null,
          property_ids: a.propertyIds.length > 0 ? a.propertyIds : null,
          ownership_pct: a.ownershipPct,
          gross_amount: a.grossAmount,
          withholding_tax: a.withholdingTax,
          net_amount: a.netAmount,
          payment_status: 'pending',
        }));

        const { error: lineError } = await supabase
          .from('distribution_line_items')
          .insert(lineItems);

        if (lineError) throw lineError;
      }

      return run;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-runs'] });
      toast.success('Distribution run created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveDistribution() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('distribution_runs')
        .update({
          status: 'approved',
          approved_by: auth.user?.id || null,
          approved_at: new Date().toISOString(),
        })
        .eq('id', runId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-runs'] });
      toast.success('Distribution approved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkPayment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      reference,
      method,
    }: {
      id: string;
      reference?: string;
      method?: string;
    }) => {
      const { error } = await supabase
        .from('distribution_line_items')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          payment_reference: reference || null,
          payment_method: method || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-line-items'] });
      qc.invalidateQueries({ queryKey: ['distribution-runs'] });
      toast.success('Payment marked as paid');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkAllPayments() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from('distribution_line_items')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('distribution_run_id', runId)
        .eq('payment_status', 'pending');

      if (error) throw error;

      // Mark the run as completed
      const { error: runError } = await supabase
        .from('distribution_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);

      if (runError) throw runError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-line-items'] });
      qc.invalidateQueries({ queryKey: ['distribution-runs'] });
      toast.success('All payments marked as paid');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelDistribution() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from('distribution_runs')
        .update({ status: 'cancelled' })
        .eq('id', runId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-runs'] });
      toast.success('Distribution cancelled');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCalculateDistribution() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['calculate-distribution-financials', orgId],
    queryFn: async () => {
      // This hook provides entity/investor financial data for the wizard
      // The actual calculation is done client-side via distribution-calculator.ts
      const { data: entities } = await supabase
        .from('legal_entities')
        .select('id, entity_name')
        .eq('org_id', orgId!);

      const { data: investors } = await supabase
        .from('investors')
        .select('id, investor_name, email')
        .eq('org_id', orgId!);

      return {
        entities: entities || [],
        investors: investors || [],
      };
    },
    enabled: !!orgId,
  });
}
