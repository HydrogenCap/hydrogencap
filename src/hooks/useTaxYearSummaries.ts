import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import type { TaxYearSummary, TaxYearLabel } from '@/lib/accountingTypes';

export function useTaxYearSummaries(taxYear?: TaxYearLabel) {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['tax_year_summaries', org?.id, taxYear],
    queryFn: async () => {
      let query = (supabase as any)
        .from('tax_year_summaries')
        .select('*')
        .eq('org_id', org!.id);
      if (taxYear) query = query.eq('tax_year', taxYear);
      query = query.order('tax_year', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as TaxYearSummary[];
    },
    enabled: !!org?.id,
  });
}

export function useGenerateTaxYearSummary() {
  const qc = useQueryClient();
  const { data: org } = useOrganization();
  return useMutation({
    mutationFn: async ({ entityId, taxYear }: { entityId: string; taxYear: TaxYearLabel }) => {
      const { data, error } = await supabase.rpc('generate_tax_year_summary', {
        target_entity_id: entityId,
        target_tax_year: taxYear,
        target_org_id: org!.id,
      });
      if (error) throw error;
      return data as string; // returns uuid
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax_year_summaries'] });
    },
  });
}

export function useLockTaxYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lock }: { id: string; lock: boolean }) => {
      const { error } = await (supabase as any)
        .from('tax_year_summaries')
        .update({ is_locked: lock })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax_year_summaries'] });
    },
  });
}
