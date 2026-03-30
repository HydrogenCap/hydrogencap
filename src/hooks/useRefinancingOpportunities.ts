import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrg } from './useUserOrg';
import { showMutationError } from '@/lib/errorToast';

export interface RefinancingOpportunity {
  id: string;
  org_id: string;
  property_id: string;
  status: string;
  current_mortgage_gbp: number;
  current_value_gbp: number;
  current_ltv: number;
  target_ltv: number;
  potential_release_gbp: number;
  identified_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefinancingOpportunityWithAddress extends RefinancingOpportunity {
  property_address: string;
}

export function useRefinancingOpportunities() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['refinancing_opportunities', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refinancing_opportunities')
        .select('*, properties_v2!inner(address_line_1, postcode)')
        .eq('org_id', orgId!)
        .order('potential_release_gbp', { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((d) => ({
        ...d,
        property_address: `${d.properties_v2?.address_line_1}, ${d.properties_v2?.postcode}`,
      })) as RefinancingOpportunityWithAddress[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateRefinancingOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'reviewed') update.reviewed_at = new Date().toISOString();
      if (status === 'completed') update.completed_at = new Date().toISOString();
      const { error } = await supabase
        .from('refinancing_opportunities')
        .update(update)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refinancing_opportunities'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update opportunity');
    },
  });
}
