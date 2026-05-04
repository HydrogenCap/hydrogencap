/**
 * V2 write hook for property_cost_budgets_v2 (Costs Prompt B, 2026-05-04).
 *
 * Replaces the now-frozen V1 useUpsertCosts. Keyed by the
 * (property_id, tax_year) UNIQUE composite. Tax year follows the UK
 * starting-year rule locked 2026-05-04: V1 year=2025 → V2 tax_year='2025/26'.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { showMutationError, showMutationSuccess } from '@/lib/errorToast';

export interface PropertyCostBudgetUpsertInput {
  property_id: string;
  tax_year: string;
  management_rule_enabled?: boolean | null;
  management_rule_percent_of_rent?: number | null;
  management_gbp_manual?: number | null;
  management_gbp_calculated?: number | null;
  repairs_rule_enabled?: boolean | null;
  repairs_rule_percent_of_rent?: number | null;
  repairs_gbp_manual?: number | null;
  repairs_gbp_calculated?: number | null;
  insurance_rule_enabled?: boolean | null;
  insurance_rule_percent_of_value?: number | null;
  insurance_gbp_manual?: number | null;
  insurance_gbp_calculated?: number | null;
  bills_gbp_manual?: number | null;
  compliance_gbp_manual?: number | null;
  other_gbp_manual?: number | null;
}

/** Map V1 integer year → V2 UK tax-year string (e.g. 2025 → '2025/26'). */
export function yearToTaxYear(year: number): string {
  const next = (year + 1) % 100;
  return `${year}/${String(next).padStart(2, '0')}`;
}

export function useUpsertPropertyCostBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PropertyCostBudgetUpsertInput) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('property_cost_budgets_v2')
        .upsert(
          { ...input, org_id: orgId },
          { onConflict: 'property_id,tax_year' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['property_cost_budgets_v2'] });
      queryClient.invalidateQueries({ queryKey: ['property', data?.property_id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      showMutationSuccess('Costs updated');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update costs');
    },
  });
}
