import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserOrg } from '@/hooks/useUserOrg';

export interface Distribution {
  id: string;
  org_id: string;
  entity_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  total_rental_income: number;
  total_expenses: number;
  total_mortgage_costs: number;
  net_distributable: number;
  total_distributed: number;
  retained_earnings: number;
  status: string;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  entity?: { id: string; entity_name: string } | null;
  allocations?: DistributionAllocation[];
}

export interface DistributionAllocation {
  id: string;
  distribution_id: string;
  shareholder_id: string;
  shareholder_name: string;
  ownership_percent: number;
  amount: number;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
}

export function useDistributions() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['distributions', orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('distributions')
        .select(`
          *,
          entity:legal_entities!distributions_entity_id_fkey ( id, entity_name )
        `)
        .eq('org_id', orgId!)
        .order('period_start', { ascending: false });

      if (error) throw error;
      return (data || []) as Distribution[];
    },
    enabled: !!orgId,
  });
}

export function useDistributionAllocations(distributionId: string | null) {
  return useQuery({
    queryKey: ['distribution-allocations', distributionId],
    queryFn: async () => {
      if (!distributionId) return [];
      const { data, error } = await (supabase as any)
        .from('distribution_allocations')
        .select('*')
        .eq('distribution_id', distributionId)
        .order('ownership_percent', { ascending: false });

      if (error) throw error;
      return (data || []) as DistributionAllocation[];
    },
    enabled: !!distributionId,
  });
}

export function useCreateDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      org_id: string;
      entity_id: string;
      period_label: string;
      period_start: string;
      period_end: string;
      total_rental_income: number;
      total_expenses: number;
      total_mortgage_costs: number;
      net_distributable: number;
      total_distributed: number;
      retained_earnings: number;
      status: string;
      notes?: string;
      allocations: Array<{
        shareholder_id: string;
        shareholder_name: string;
        ownership_percent: number;
        amount: number;
      }>;
    }) => {
      const { allocations, ...distData } = payload;
      const { data: dist, error } = await (supabase as any)
        .from('distributions')
        .insert(distData)
        .select()
        .single();

      if (error) throw error;

      if (allocations.length > 0) {
        const { error: allocError } = await (supabase as any)
          .from('distribution_allocations')
          .insert(allocations.map(a => ({ ...a, distribution_id: dist.id })));
        if (allocError) throw allocError;
      }

      return dist;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distributions'] });
      toast.success('Distribution created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('distributions')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distributions'] });
      toast.success('Distribution approved');
    },
  });
}

export function useMarkAllocationPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reference }: { id: string; reference?: string }) => {
      const { error } = await (supabase as any)
        .from('distribution_allocations')
        .update({ paid_at: new Date().toISOString(), payment_reference: reference || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-allocations'] });
      toast.success('Marked as paid');
    },
  });
}
