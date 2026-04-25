import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useTaxSettings } from '@/hooks/useTaxData';
import { useTaxExpenses } from '@/hooks/useTaxData';
import { parseTaxYear, type TaxYearLabel } from '@/lib/accountingTypes';
import {
  runTaxCalculation,
  type TaxProfileInput,
  type PropertyTaxData,
  type TaxCalculationResult,
} from '@/lib/tax-engine';

// ── Tax Profile ──

interface TaxProfileRow {
  id: string;
  org_id: string;
  tax_year: string;
  entity_id: string | null;
  taxpayer_type: string;
  income_tax_rate: number | null;
  other_income: number;
  personal_allowance: number;
  created_at: string;
}

export function useTaxProfile(taxYear: TaxYearLabel) {
  const { data: org } = useOrganization();

  const query = useQuery({
    queryKey: ['tax_profile', org?.id, taxYear],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('tax_profiles')
        .select('*')
        .eq('org_id', org!.id)
        .eq('tax_year', taxYear)
        .is('entity_id', null)
        .maybeSingle();
      if (error) throw error;
      return data as TaxProfileRow | null;
    },
    enabled: !!org?.id,
  });

  return query;
}

export function useUpsertTaxProfile() {
  const qc = useQueryClient();
  const { data: org } = useOrganization();

  return useMutation({
    mutationFn: async (params: {
      taxYear: string;
      taxpayerType: 'individual' | 'partnership' | 'company';
      otherIncome: number;
      personalAllowance: number;
      incomeTaxRate?: number;
    }) => {
      if (!org) throw new Error('No org');
      const { data: existing } = await supabaseAny
        .from('tax_profiles')
        .select('id')
        .eq('org_id', org.id)
        .eq('tax_year', params.taxYear)
        .is('entity_id', null)
        .maybeSingle();

      const row = {
        org_id: org.id,
        tax_year: params.taxYear,
        taxpayer_type: params.taxpayerType,
        other_income: params.otherIncome,
        personal_allowance: params.personalAllowance,
        income_tax_rate: params.incomeTaxRate ?? null,
      };

      if (existing) {
        const { error } = await supabaseAny
          .from('tax_profiles')
          .update(row)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAny
          .from('tax_profiles')
          .insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax_profile'] });
      qc.invalidateQueries({ queryKey: ['tax_engine_calculation'] });
    },
  });
}

// ── Full Tax Calculation ──

export function useTaxCalculation(taxYear: TaxYearLabel): {
  data: TaxCalculationResult | null | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data: org } = useOrganization();
  const { data: taxSettings } = useTaxSettings();
  const { data: taxProfile } = useTaxProfile(taxYear);
  const { data: manualExpenses } = useTaxExpenses(taxYear);

  const result = useQuery({
    queryKey: [
      'tax_engine_calculation',
      org?.id,
      taxYear,
      taxSettings?.marginalTaxRate,
      taxProfile?.other_income,
      taxProfile?.personal_allowance,
      taxProfile?.taxpayer_type,
      manualExpenses?.length,
    ],
    queryFn: async (): Promise<TaxCalculationResult | null> => {
      if (!org || !taxSettings) return null;
      const { start, end } = parseTaxYear(taxYear);
      const startISO = start.toISOString().split('T')[0];
      const endISO = end.toISOString().split('T')[0];

      const [propsRes, entitiesRes, rentRes, tenancyRes, maintenanceRes, loansRes] =
        await Promise.all([
          supabaseAny
            .from('properties_v2')
            .select('id, address_line_1, postcode, entity_id, purchase_price, current_valuation')
            .eq('org_id', org.id),
          supabaseAny
            .from('legal_entities')
            .select('id, entity_name, entity_type')
            .eq('org_id', org.id),
          supabaseAny
            .from('rent_payments')
            .select('tenancy_id, amount')
            .gte('payment_date', startISO)
            .lte('payment_date', endISO),
          supabaseAny
            .from('tenancy_agreements')
            .select('id, property_id')
            .eq('org_id', org.id),
          supabaseAny
            .from('maintenance_requests')
            .select('property_id, actual_cost')
            .eq('status', 'completed'),
          supabaseAny
            .from('loan_facilities')
            .select('property_id, interest_rate, current_balance, monthly_payment, status')
            .eq('status', 'active'),
        ]);

      const properties = propsRes.data || [];
      const entities = entitiesRes.data || [];
      const rents = rentRes.data || [];
      const tenancies = tenancyRes.data || [];
      const maintenance = maintenanceRes.data || [];
      const loans = loansRes.data || [];

      const tenancyPropertyMap = new Map(tenancies.map((t) => [t.id, t.property_id]));
      type EntityRow = { id: string; [key: string]: unknown };
      const entityMap = new Map((entities as EntityRow[]).map((e) => [e.id, e]));

      // Build manual expenses lookup
      const manualMap = new Map<string, Record<string, number>>();
      for (const exp of manualExpenses || []) {
        if (!manualMap.has(exp.property_id)) manualMap.set(exp.property_id, {});
        const m = manualMap.get(exp.property_id)!;
        m[exp.category] = (m[exp.category] || 0) + Number(exp.amount);
      }

      // Build PropertyTaxData array
      const propertyTaxData: PropertyTaxData[] = properties.map((prop) => {
        const address = [prop.address_line_1, prop.postcode].filter(Boolean).join(', ');
        const entity = prop.entity_id ? entityMap.get(prop.entity_id) : null;

        const grossRent = rents
          .filter((r) => tenancyPropertyMap.get(r.tenancy_id) === prop.id)
          .reduce((s, r) => s + (Number(r.amount) || 0), 0);

        const repairsCost = maintenance
          .filter((m) => m.property_id === prop.id)
          .reduce((s, m) => s + (Number(m.actual_cost) || 0), 0);

        const propLoans = loans.filter((l) => l.property_id === prop.id);
        const mortgageInterest = propLoans.reduce((s, l) => {
          const balance = Number(l.current_balance) || 0;
          const rate = Number(l.interest_rate) || 0;
          return s + (balance * rate) / 100;
        }, 0);

        const manual = manualMap.get(prop.id) || {};
        const expenseBreakdown: Record<string, number> = {
          repairs: repairsCost,
          ...manual,
        };

        const insurance = manual['insurance'] || 0;
        const managementFees = manual['management_fees'] || 0;
        const accountingFees = manual['accountancy'] || 0;
        const groundRent = manual['ground_rent'] || 0;
        const serviceCharges = manual['service_charges'] || 0;
        const travel = manual['travel'] || 0;
        const other = manual['other'] || 0;
        const allowableExpenses =
          repairsCost + insurance + managementFees + accountingFees + groundRent + serviceCharges + travel + other;

        return {
          propertyId: prop.id,
          propertyAddress: address,
          entityId: prop.entity_id,
          entityName: entity?.entity_name || null,
          entityType: entity?.entity_type || null,
          grossRent,
          allowableExpenses,
          financeCosts: mortgageInterest,
          purchasePrice: prop.purchase_price ? Number(prop.purchase_price) : null,
          currentValue: prop.current_valuation ? Number(prop.current_valuation) : null,
          improvementCosts: 0,
          expenseBreakdown,
        };
      });

      const profile: TaxProfileInput = {
        taxpayerType: (taxProfile?.taxpayer_type as TaxProfileInput['taxpayerType']) || 'individual',
        otherIncome: taxProfile?.other_income ?? 0,
        personalAllowance: taxProfile?.personal_allowance ?? 12_570,
        incomeTaxRate: taxProfile?.income_tax_rate ?? undefined,
      };

      return runTaxCalculation(taxYear, profile, propertyTaxData);
    },
    enabled: !!org?.id && !!taxSettings && manualExpenses !== undefined,
  });

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error as Error | null,
  };
}

// ── Persist Tax Calculation Results ──

export function useSaveTaxCalculation() {
  const qc = useQueryClient();
  const { data: org } = useOrganization();

  return useMutation({
    mutationFn: async (params: {
      taxYear: string;
      taxProfileId: string | null;
      result: TaxCalculationResult;
    }) => {
      if (!org) throw new Error('No org');
      const { result, taxYear, taxProfileId } = params;

      // Delete previous calculations for this year
      await supabaseAny
        .from('tax_calculations')
        .delete()
        .eq('org_id', org.id)
        .eq('tax_year', taxYear);

      // Insert portfolio total
      const portfolioRow = {
        org_id: org.id,
        tax_profile_id: taxProfileId,
        tax_year: taxYear,
        property_id: null,
        gross_rent: result.sa105.totalRents,
        allowable_expenses: result.sa105.totalAllowableExpenses,
        finance_costs: result.sa105.totalFinanceCosts,
        finance_cost_relief: result.section24Impact.financeCredit,
        net_property_income: result.totalPropertyIncome,
        tax_liability: result.totalTaxLiability,
        effective_tax_rate: result.effectiveTaxRate,
        section24_impact: {
          old_system_tax: result.section24Impact.oldSystemTax,
          new_system_tax: result.section24Impact.newSystemTax,
          additional_tax: result.section24Impact.additionalTaxDueToSection24,
        },
        expense_breakdown: {},
      };
      const { error: portfolioErr } = await supabaseAny
        .from('tax_calculations')
        .insert(portfolioRow);
      if (portfolioErr) throw portfolioErr;

      // Insert per-property rows
      const propertyRows = result.perPropertyTax.map((pt) => {
        const cgt = result.cgtEstimates.find((c) => c.propertyId === pt.propertyId);
        return {
          org_id: org.id,
          tax_profile_id: taxProfileId,
          tax_year: taxYear,
          property_id: pt.propertyId,
          gross_rent: pt.grossRent,
          allowable_expenses: pt.allowableExpenses,
          finance_costs: pt.financeCosts,
          finance_cost_relief: pt.financeCosts * 0.20,
          net_property_income: pt.netIncome,
          tax_liability: pt.taxLiability,
          effective_tax_rate: pt.netIncome > 0 ? (pt.taxLiability / pt.netIncome) * 100 : 0,
          purchase_price: cgt?.purchasePrice ?? null,
          current_value: cgt?.currentValue ?? null,
          unrealised_gain: cgt?.result.gain ?? null,
          estimated_cgt: cgt?.result.cgt ?? null,
          annual_exempt_amount: CGT_RATES_EXEMPT,
          expense_breakdown: {},
          section24_impact: {},
        };
      });

      if (propertyRows.length > 0) {
        const { error } = await supabaseAny
          .from('tax_calculations')
          .insert(propertyRows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax_calculations'] });
    },
  });
}

const CGT_RATES_EXEMPT = 3000;
