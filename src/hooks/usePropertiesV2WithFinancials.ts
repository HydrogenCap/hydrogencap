/**
 * V2-native replacement for `usePropertiesCompat`. Reads the same
 * underlying tables (`properties_v2`, `loan_facilities`,
 * `property_annual_performance`, `tenancy_agreements`) and returns the
 * same nested financial sub-arrays, but exposes the property row using
 * its V2 column names instead of the legacy V1-shaped reshape.
 *
 * Migration mapping is documented in `src/lib/v2FieldAccessors.ts` and
 * `docs/release/v1-compat-retirement-2026-06-09.md`.
 *
 * The mapped loan / income / cost / tenancy shapes are intentionally
 * preserved from the compat layer so per-row consumers (cards, charts,
 * exports) do not need to be re-templated; only top-level property
 * field accesses change.
 */

import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { PropertyWithEntity } from '@/hooks/usePropertiesV2';

type LoanFacilityRow = Database['public']['Tables']['loan_facilities']['Row'];
type PropertyAnnualPerformanceRow = Database['public']['Views']['property_annual_performance']['Row'];
type TenancyAgreementRow = Database['public']['Tables']['tenancy_agreements']['Row'];

type TenancyAgreementSlim = Pick<
  TenancyAgreementRow,
  'id' | 'property_id' | 'tenant_id' | 'room_id' | 'status' | 'rent_amount_pcm' | 'start_date' | 'initial_end_date'
>;

export interface PropertyLoanCard {
  id: string;
  org_id: string;
  property_id: string;
  lender: string | null;
  lender_name: string | null;
  current_mortgage_balance_gbp: number | null;
  interest_rate_percent: number | null;
  loan_term_months: number | null;
  capital_or_interest: 'capital' | 'interest';
  mortgage_payment_gbp: number | null;
  payment_override_gbp: number | null;
  fixed_rate_expires: string | null;
  product_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  original_amount: number | null;
  current_ltv: number | null;
  facility_type: string | null;
  status: string | null;
}

export interface PropertyIncomeRow {
  id: string;
  org_id: string | null;
  property_id: string;
  year: number;
  annual_rent_gbp: number | null;
  created_at: string | null;
}

export interface PropertyCostsRow {
  id: string;
  org_id: string | null;
  property_id: string;
  year: number;
  insurance_gbp_manual: number | null;
  management_gbp_manual: number | null;
  maintenance_gbp_manual: number | null;
  utilities_gbp_manual: number | null;
  ground_rent_gbp_manual: number | null;
  __total_annual_costs: number | null;
  created_at: string | null;
}

export interface PropertyTenancyRow {
  id: string;
  org_id: string | null;
  tenant_id: string | null;
  room_id: string | null;
  property_id: string;
  start_date: string | null;
  end_date: string | null;
  rent_amount_pcm: number | null;
  rent_due_day: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * V2-native property with the same financial sub-arrays the compat
 * layer used to stitch together. Top-level fields use the V2 column
 * names; derived/legacy fields are not duplicated — use
 * `@/lib/v2FieldAccessors` for `lifecycleType`, `formattedAddress`,
 * etc.
 */
export type PropertyV2WithFinancials = PropertyWithEntity & {
  loans: PropertyLoanCard[];
  income: PropertyIncomeRow[];
  costs: PropertyCostsRow[];
  tenancies: PropertyTenancyRow[];
};

type PropertyV2WithEntityJoin = Database['public']['Tables']['properties_v2']['Row'] & {
  legal_entities?:
    | { entity_name: string | null; entity_type?: string | null }
    | Array<{ entity_name: string | null; entity_type?: string | null }>
    | null;
};

export function usePropertiesV2WithFinancials() {
  return useQuery({
    queryKey: ['properties_v2_with_financials'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PropertyV2WithFinancials[]> => {
      const [propsRes, loansRes, perfRes, agreementsRes] = await Promise.all([
        supabaseAny
          .from('properties_v2')
          .select('*, legal_entities!properties_v2_entity_id_fkey!inner(entity_name, entity_type)')
          .order('created_at', { ascending: false }),
        supabaseAny.from('loan_facilities').select('*').in('status', ['active', 'drawdown']),
        supabaseAny.from('property_annual_performance').select('*'),
        supabaseAny
          .from('tenancy_agreements')
          .select(
            'id, property_id, tenant_id, room_id, status, rent_amount_pcm, start_date, initial_end_date',
          )
          .in('status', ['active', 'pending', 'notice_period']),
      ]);

      if (propsRes.error) throw propsRes.error;

      const loansByProp = new Map<string, LoanFacilityRow[]>();
      for (const loan of loansRes.data || []) {
        const list = loansByProp.get(loan.property_id) || [];
        list.push(loan);
        loansByProp.set(loan.property_id, list);
      }

      const perfByProp = new Map<string, PropertyAnnualPerformanceRow>();
      for (const p of perfRes.data || []) {
        if (p.property_id) perfByProp.set(p.property_id, p);
      }

      const agreementsByProp = new Map<string, TenancyAgreementSlim[]>();
      for (const a of (agreementsRes.data || []) as TenancyAgreementSlim[]) {
        const list = agreementsByProp.get(a.property_id) || [];
        list.push(a);
        agreementsByProp.set(a.property_id, list);
      }

      return ((propsRes.data || []) as PropertyV2WithEntityJoin[]).map((row) => {
        const legalEntity = Array.isArray(row.legal_entities)
          ? row.legal_entities[0]
          : row.legal_entities;
        const performance = perfByProp.get(row.id);
        const agreements = agreementsByProp.get(row.id) || [];
        const property: PropertyWithEntity = {
          ...(row as unknown as PropertyWithEntity),
          entity_name: legalEntity?.entity_name ?? '',
          entity_type: legalEntity?.entity_type ?? '',
        };
        return {
          ...property,
          loans: (loansByProp.get(row.id) || []).map(mapLoan),
          income: performance ? [mapPerfToIncome(row.id, performance)] : [],
          costs: performance ? [mapPerfToCosts(row.id, performance)] : [],
          tenancies: agreements.map(mapAgreement),
        };
      });
    },
  });
}

function mapLoan(loan: LoanFacilityRow): PropertyLoanCard {
  return {
    id: loan.id,
    org_id: loan.org_id,
    property_id: loan.property_id,
    lender: loan.lender_id,
    lender_name: null,
    current_mortgage_balance_gbp: loan.current_balance,
    interest_rate_percent: loan.interest_rate,
    loan_term_months: null,
    capital_or_interest: loan.interest_only ? 'interest' : 'capital',
    mortgage_payment_gbp: loan.monthly_payment,
    payment_override_gbp: null,
    fixed_rate_expires: loan.rate_expiry_date,
    product_name: loan.product_name,
    created_at: loan.created_at,
    updated_at: loan.updated_at,
    original_amount: loan.original_amount,
    current_ltv: loan.current_ltv,
    facility_type: loan.facility_type,
    status: loan.status,
  };
}

function mapPerfToIncome(propertyId: string, p: PropertyAnnualPerformanceRow): PropertyIncomeRow {
  return {
    id: `perf-income-${propertyId}`,
    org_id: null,
    property_id: propertyId,
    year: new Date().getFullYear(),
    annual_rent_gbp: p.annual_rent_received,
    created_at: null,
  };
}

function mapPerfToCosts(propertyId: string, p: PropertyAnnualPerformanceRow): PropertyCostsRow {
  return {
    id: `perf-costs-${propertyId}`,
    org_id: null,
    property_id: propertyId,
    year: new Date().getFullYear(),
    insurance_gbp_manual: null,
    management_gbp_manual: null,
    maintenance_gbp_manual: null,
    utilities_gbp_manual: null,
    ground_rent_gbp_manual: null,
    __total_annual_costs: p.annual_costs,
    created_at: null,
  };
}

function mapAgreement(a: TenancyAgreementSlim): PropertyTenancyRow {
  return {
    id: a.id,
    org_id: null,
    tenant_id: a.tenant_id,
    room_id: a.room_id,
    property_id: a.property_id,
    start_date: a.start_date,
    end_date: a.initial_end_date,
    rent_amount_pcm: a.rent_amount_pcm,
    rent_due_day: 1,
    status: a.status === 'notice_period' ? 'notice' : a.status,
    created_at: null,
    updated_at: null,
  };
}
