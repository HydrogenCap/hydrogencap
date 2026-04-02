import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useOrganization } from '@/hooks/useOrganization';
import type { TaxYearLabel } from '@/lib/accountingTypes';
import { parseTaxYear } from '@/lib/accountingTypes';
import {
  buildSA105,
  buildAnnualSummary,
  type SA105PropertyData,
  type AnnualTaxSummary,
  type MarginalTaxRate,
} from '@/lib/propertyTax';

type TaxExpenseRow = Database['public']['Tables']['tax_expenses']['Row'];
type TaxExpenseInsert = Database['public']['Tables']['tax_expenses']['Insert'];
type ProfileTaxSettingsUpdate = Pick<
  Database['public']['Tables']['profiles']['Update'],
  'marginal_tax_rate' | 'corporation_tax_rate' | 'use_property_allowance'
>;

// ── Tax expenses CRUD ──

export function useTaxExpenses(taxYear: TaxYearLabel) {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['tax_expenses', org?.id, taxYear],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tax_expenses')
        .select('*')
        .eq('org_id', org!.id)
        .eq('tax_year', taxYear);
      if (error) throw error;
      return (data || []) as TaxExpenseRow[];
    },
    enabled: !!org?.id,
  });
}

export function useAddTaxExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: {
      org_id: string;
      property_id: string;
      tax_year: string;
      category: string;
      description?: string;
      amount: number;
    }) => {
      const { error } = await supabase.from('tax_expenses').insert(expense as TaxExpenseInsert);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax_expenses'] }),
  });
}

export function useDeleteTaxExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax_expenses'] }),
  });
}

// ── Tax settings from profile ──

export function useTaxSettings() {
  return useQuery({
    queryKey: ['tax_settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('marginal_tax_rate, corporation_tax_rate, use_property_allowance')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return {
        marginalTaxRate: (Number(data?.marginal_tax_rate) || 0.40) as MarginalTaxRate,
        corporationTaxRate: Number(data?.corporation_tax_rate) || 0.25,
        usePropertyAllowance: !!data?.use_property_allowance,
      };
    },
  });
}

export function useUpdateTaxSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: {
      marginal_tax_rate?: number;
      corporation_tax_rate?: number;
      use_property_allowance?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase as any)
        .from('profiles')
        .update(settings as ProfileTaxSettingsUpdate)
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax_settings'] }),
  });
}

// ── Full tax computation ──

export function useTaxSummary(taxYear: TaxYearLabel) {
  const { data: org } = useOrganization();
  const { data: taxSettings } = useTaxSettings();
  const { data: manualExpenses } = useTaxExpenses(taxYear);

  return useQuery({
    queryKey: ['tax_summary_computed', org?.id, taxYear, taxSettings, manualExpenses?.length],
    queryFn: async (): Promise<AnnualTaxSummary | null> => {
      if (!org || !taxSettings) return null;
      const { start, end } = parseTaxYear(taxYear);
      const startISO = start.toISOString().split('T')[0];
      const endISO = end.toISOString().split('T')[0];

      // Fetch all data in parallel
      const [propsRes, entitiesRes, rentRes, tenancyRes, maintenanceRes, loansRes] = await Promise.all([
        supabase.from('properties_v2').select('id, address_line_1, postcode, entity_id').eq('org_id', org.id),
        supabase.from('legal_entities').select('id, entity_name, entity_type').eq('org_id', org.id),
        supabase.from('rent_payments').select('tenancy_id, amount').gte('payment_date', startISO).lte('payment_date', endISO),
        supabase.from('tenancy_agreements').select('id, property_id').eq('org_id', org.id),
        supabase.from('maintenance_requests').select('property_id, actual_cost').eq('status', 'completed'),
        supabase.from('loan_facilities').select('property_id, interest_rate, current_balance, monthly_payment, status').eq('status', 'active'),
      ]);

      const properties = propsRes.data || [];
      const entities = entitiesRes.data || [];
      const rents = rentRes.data || [];
      const tenancies = tenancyRes.data || [];
      const maintenance = maintenanceRes.data || [];
      const loans = loansRes.data || [];

      // Build tenancy -> property lookup
      const tenancyPropertyMap = new Map(tenancies.map(t => [t.id, t.property_id]));

      const entityMap = new Map(entities.map(e => [e.id, e]));

      // Build manual expenses lookup: property_id -> { category -> total }
      const manualMap = new Map<string, Record<string, number>>();
      for (const exp of manualExpenses || []) {
        if (!manualMap.has(exp.property_id)) manualMap.set(exp.property_id, {});
        const m = manualMap.get(exp.property_id)!;
        m[exp.category] = (m[exp.category] || 0) + Number(exp.amount);
      }

      const sa105Properties: SA105PropertyData[] = properties.map(prop => {
        const address = [prop.address_line_1, prop.postcode].filter(Boolean).join(', ');
        const entity = prop.entity_id ? entityMap.get(prop.entity_id) : null;

        const rentalIncome = rents
          .filter(r => tenancyPropertyMap.get(r.tenancy_id) === prop.id)
          .reduce((s, r) => s + (Number(r.amount) || 0), 0);

        const repairsCost = maintenance
          .filter(m => m.property_id === prop.id)
          .reduce((s, m) => s + (Number(m.actual_cost) || 0), 0);

        // Estimate annual mortgage interest
        const propLoans = loans.filter(l => l.property_id === prop.id);
        const mortgageInterest = propLoans.reduce((s, l) => {
          const balance = Number(l.current_balance) || 0;
          const rate = Number(l.interest_rate) || 0;
          return s + (balance * rate / 100);
        }, 0);

        const manual = manualMap.get(prop.id) || {};

        return buildSA105(
          prop.id,
          address,
          prop.entity_id,
          entity?.entity_name || null,
          entity?.entity_type || null,
          rentalIncome,
          mortgageInterest,
          repairsCost,
          manual,
          taxSettings.usePropertyAllowance
        );
      });

      return buildAnnualSummary(
        taxYear,
        sa105Properties,
        taxSettings.marginalTaxRate,
        taxSettings.corporationTaxRate
      );
    },
    enabled: !!org?.id && !!taxSettings && manualExpenses !== undefined,
  });
}
