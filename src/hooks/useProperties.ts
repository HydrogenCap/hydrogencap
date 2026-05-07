/**
 * @deprecated — V1 hook. All consumers should use usePropertiesV2 instead.
 * Kept temporarily for reference. Will be removed in a future cleanup.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { ActivityLoggers } from './useActivityLog';

import { showMutationError, showMutationSuccess } from '@/lib/errorToast';
import { throwV1Frozen } from '@/lib/v1Frozen';
import {
  propertyCostBudgetToLegacyShape,
  warnIfLegacyYearMissing,
  type PropertyCostBudgetV2RowLite,
} from '@/lib/propertyCostBudgetCompat';
import {
  propertyIncomeBudgetToLegacyShape,
  type PropertyIncomeBudgetV2RowLite,
} from '@/lib/propertyIncomeBudgetCompat';

type Property = Database['public']['Tables']['properties']['Row'];
type PropertyV1Insert = Database['public']['Tables']['properties']['Insert'];
type PropertyV1Update = Database['public']['Tables']['properties']['Update'];
type Loan = Database['public']['Tables']['loans']['Row'];
// V1 `income` table dropped (Income migration 2026-05-06). Local legacy shape
// preserved so PropertyWithFinancials downstream consumers keep typing.
type Income = {
  id: string;
  property_id: string;
  year: number;
  annual_rent_gbp: number;
};
// V1 `costs` table dropped (Costs Prompt F, 2026-05-07). Local legacy shape
// preserved so PropertyWithFinancials downstream consumers (legacy `*_gbp`
// effective amounts + integer `year`) keep typing.
type Costs = {
  id: string;
  property_id: string;
  year: number;
  management_gbp: number | null;
  insurance_gbp: number | null;
  maintenance_gbp: number | null;
  repairs_gbp: number | null;
  bills_gbp: number | null;
  compliance_gbp: number | null;
  other_gbp: number | null;
  management_gbp_manual: number | null;
  repairs_gbp_manual: number | null;
  insurance_gbp_manual: number | null;
  bills_gbp_manual: number | null;
  compliance_gbp_manual: number | null;
  other_gbp_manual: number | null;
  management_rule_enabled: boolean | null;
  management_rule_percent_of_rent: number | null;
  repairs_rule_enabled: boolean | null;
  repairs_rule_percent_of_rent: number | null;
  insurance_rule_enabled: boolean | null;
  insurance_rule_percent_of_value: number | null;
};
type Tenancy = Database['public']['Tables']['tenancies']['Row'];

export interface PropertyWithFinancials extends Property {
  loans: Loan[];
  income: Income[];
  costs: Costs[];
  tenancies: Tenancy[];
}

/**
 * Per-row shim: V2 property_cost_budgets_v2 embed → V1 costs[] legacy shape.
 * Applied at the consumption layer so PropertyWithFinancials downstream code is unchanged.
 */
function mapV2CostsToLegacy<T extends { costs?: unknown }>(rows: T[] | null | undefined, ctx: string): T[] {
  if (!rows) return [];
  return rows.map((r) => {
    const v2Rows = (r.costs ?? []) as PropertyCostBudgetV2RowLite[];
    warnIfLegacyYearMissing(ctx, v2Rows);
    return { ...r, costs: v2Rows.map(propertyCostBudgetToLegacyShape) } as T;
  });
}

/**
 * Per-row shim: V2 property_income_budgets_v2 embed → V1 income[] legacy shape.
 */
function mapV2IncomeToLegacy<T extends { income?: unknown }>(rows: T[] | null | undefined): T[] {
  if (!rows) return [];
  return rows.map((r) => {
    const v2Rows = (r.income ?? []) as PropertyIncomeBudgetV2RowLite[];
    return { ...r, income: v2Rows.map(propertyIncomeBudgetToLegacyShape) } as T;
  });
}

function mapV2Embeds<T extends { costs?: unknown; income?: unknown }>(
  rows: T[] | null | undefined,
  ctx: string,
): T[] {
  return mapV2IncomeToLegacy(mapV2CostsToLegacy(rows, ctx));
}

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('properties')
        .select(`
          *,
          loans(*),
          income:property_income_budgets_v2(*),
          costs:property_cost_budgets_v2(*),
          tenancies(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return mapV2Embeds(data, 'useProperties') as unknown as PropertyWithFinancials[];
    },
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabaseAny
        .from('properties')
        .select(`
          *,
          loans(*),
          income:property_income_budgets_v2(*),
          costs:property_cost_budgets_v2(*),
          tenancies(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapV2Embeds([data], 'useProperty')[0] as unknown as PropertyWithFinancials;
    },
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (_property: Omit<PropertyV1Insert, 'org_id'>): Promise<Property> => {
      throwV1Frozen('properties', 'useCreateProperty');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      ActivityLoggers.propertyCreated(data.id, data.address_line);
      showMutationSuccess('Property created');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to create property');
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (_args: PropertyV1Update & { id: string; previousValue?: number | null }) => {
      throwV1Frozen('properties', 'useUpdateProperty');
    },
    // Optimistic update for instant UI feedback
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['property', newData.id] });
      const previousProperty = queryClient.getQueryData<PropertyWithFinancials>(['property', newData.id]);
      
      if (previousProperty) {
        queryClient.setQueryData(['property', newData.id], {
          ...previousProperty,
          ...newData,
        });
      }
      
      return { previousProperty };
    },
    onError: (_err, newData, context) => {
      if (context?.previousProperty) {
        queryClient.setQueryData(['property', newData.id], context.previousProperty);
      }
      showMutationError(_err, 'Failed to update property');
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (_id: string) => {
      throwV1Frozen('properties', 'useDeleteProperty');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['unit-usage-count'] });
      showMutationSuccess('Property deleted');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to delete property');
    },
  });
}

// Loan hooks — V1 `loans` table is frozen (Prompt #45). Writes redirected to
// V2 `loan_facilities` via useCreateLoanFacility / useUpdateLoanFacility.
export function useCreateLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_loan: Database['public']['Tables']['loans']['Insert']): Promise<Loan> => {
      throwV1Frozen('loans', 'useCreateLoan');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      showMutationSuccess('Loan created');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to create loan');
    },
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_args: Database['public']['Tables']['loans']['Update'] & {
      id: string;
      previousRate?: number | null;
    }): Promise<Loan> => {
      throwV1Frozen('loans', 'useUpdateLoan');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      showMutationSuccess('Loan updated');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update loan');
    },
  });
}

// V1 `income` table dropped (Income migration 2026-05-06). Writes redirected
// to V2 `property_income_budgets_v2` via useUpsertPropertyIncomeBudget.
export function useUpsertIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_income: { property_id: string; year: number; annual_rent_gbp: number }) => {
      throwV1Frozen('income', 'useUpsertIncome');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      ActivityLoggers.incomeUpdated(data.property_id, data.year, Number(data.annual_rent_gbp));
      showMutationSuccess('Income updated');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update income');
    },
  });
}

// V1 `costs` table is frozen (Costs Prompt B). Writes redirected to V2
// `property_cost_budgets_v2` via useUpsertPropertyCostBudget.
export function useUpsertCosts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_costs: Partial<Costs>) => {
      throwV1Frozen('costs', 'useUpsertCosts');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      const total = [
        data.management_gbp_manual,
        data.bills_gbp_manual,
        data.insurance_gbp_manual,
        data.repairs_gbp_manual,
        data.compliance_gbp_manual,
        data.other_gbp_manual,
      ].reduce((sum: number, val: any) => sum + (val ? Number(val) : 0), 0);

      ActivityLoggers.costsUpdated(data.property_id, data.year, total);
      showMutationSuccess('Costs updated');
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update costs');
    },
  });
}
