/**
 * V2 write hook for property_income_budgets_v2 (Income migration, 2026-05-06).
 *
 * Mirrors usePropertyCostBudgets (Costs Prompt B). Replaces the now-frozen V1
 * useUpsertIncome. Keyed by (property_id, tax_year) UNIQUE composite.
 *
 * Year-shape rule (locked 2026-05-04, see #50a): V1 year=YYYY → V2 tax_year='YYYY/(YY+1)'.
 * yearToTaxYear is the single source of truth — re-exported from usePropertyCostBudgets.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { showMutationError, showMutationSuccess } from '@/lib/errorToast';
import { ActivityLoggers } from './useActivityLog';
export { yearToTaxYear } from './usePropertyCostBudgets';
import { yearToTaxYear } from './usePropertyCostBudgets';

export interface PropertyIncomeBudgetUpsertInput {
  property_id: string;
  tax_year: string;
  annual_rent_gbp: number;
}

/** Convenience wrapper: accept legacy `year` integer call sites. */
export interface PropertyIncomeBudgetUpsertByYear {
  property_id: string;
  year: number;
  annual_rent_gbp: number;
}

export function useUpsertPropertyIncomeBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PropertyIncomeBudgetUpsertInput | PropertyIncomeBudgetUpsertByYear) => {
      const orgId = await fetchUserOrgId();
      const tax_year = 'tax_year' in input ? input.tax_year : yearToTaxYear(input.year);
      const payload = {
        org_id: orgId,
        property_id: input.property_id,
        tax_year,
        annual_rent_gbp: input.annual_rent_gbp,
      };
      const { data, error } = await supabaseAny
        .from('property_income_budgets_v2')
        .upsert(payload, { onConflict: 'property_id,tax_year' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: { property_id?: string; tax_year?: string; annual_rent_gbp?: number } | null) => {
      queryClient.invalidateQueries({ queryKey: ['property_income_budgets_v2'] });
      queryClient.invalidateQueries({ queryKey: ['property', data?.property_id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      try {
        // Best-effort legacy activity log; year derived from tax_year prefix.
        const yr = parseInt(String(data?.tax_year ?? '').slice(0, 4), 10);
        if (!Number.isNaN(yr)) {
          ActivityLoggers.incomeUpdated(data.property_id, yr, Number(data.annual_rent_gbp));
        }
      } catch {
        // ignore
      }
      showMutationSuccess('Income updated');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update income');
    },
  });
}
