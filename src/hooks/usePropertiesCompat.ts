import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyWithFinancials } from './useProperties';

// Re-export the V1 type so consumers can import from one place
export type { PropertyWithFinancials } from './useProperties';

/**
 * Compatibility adapter: reads V2 tables, returns V1 PropertyWithFinancials shape.
 *
 * This exists to let V1 consumer pages switch away from the V1 properties table
 * without rewriting their rendering logic. Once all consumers are migrated to
 * native V2 hooks, this adapter can be removed.
 *
 * V2 sources:
 *   properties_v2              → core property fields
 *   loan_facilities            → replaces V1 loans
 *   property_annual_performance → replaces V1 income + costs
 *   tenancy_agreements         → replaces V1 tenancies
 */
export function usePropertiesCompat() {
  return useQuery({
    queryKey: ['properties_compat_v2'],
    queryFn: async () => {
      // Parallel fetch all V2 data
      const [propsRes, loansRes, perfRes, agreementsRes] = await Promise.all([
        supabase
          .from('properties_v2')
          .select('*, legal_entities!inner(entity_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('loan_facilities')
          .select('*')
          .in('status', ['active', 'drawdown']),
        supabase
          .from('property_annual_performance')
          .select('*'),
        supabase
          .from('tenancy_agreements')
          .select('id, property_id, tenant_id, room_id, status, rent_amount_pcm, start_date, initial_end_date')
          .in('status', ['active', 'pending', 'notice_period']),
      ]);

      if (propsRes.error) throw propsRes.error;

      // Build lookup maps
      const loansByProp = new Map<string, any[]>();
      for (const loan of (loansRes.data || [])) {
        const arr = loansByProp.get(loan.property_id) || [];
        arr.push(loan);
        loansByProp.set(loan.property_id, arr);
      }

      const perfByProp = new Map<string, any>();
      for (const p of (perfRes.data || [])) {
        if (p.property_id) perfByProp.set(p.property_id, p);
      }

      const agreementsByProp = new Map<string, any[]>();
      for (const a of (agreementsRes.data || [])) {
        const arr = agreementsByProp.get(a.property_id) || [];
        arr.push(a);
        agreementsByProp.set(a.property_id, arr);
      }

      // Map V2 properties to V1 PropertyWithFinancials shape
      return (propsRes.data || []).map((v2: any): PropertyWithFinancials => {
        const loans = (loansByProp.get(v2.id) || []).map(mapLoanToV1);
        const perf = perfByProp.get(v2.id);
        const agreements = agreementsByProp.get(v2.id) || [];

        return {
          // ─── Core property fields (V2 → V1 mapping) ───
          id: v2.id,
          org_id: v2.org_id,
          address_line: v2.address_line_1,
          address_line2: v2.address_line_2,
          area_name: v2.city,
          town_city: v2.city,
          postcode: v2.postcode,
          county: v2.county,
          country: v2.country,
          property_type: v2.property_type,
          beds: v2.total_lettable_rooms,
          bathrooms: null,
          latitude: v2.latitude,
          longitude: v2.longitude,
          current_value_gbp: v2.current_valuation,
          purchase_price_gbp: v2.purchase_price,
          purchase_date: v2.purchase_date,
          lifecycle_type: v2.lifecycle_stage || 'development',
          has_gas: v2.has_gas_supply,
          is_grade_listed: v2.listing_grade !== 'none',
          listing_grade: v2.listing_grade,
          notes: v2.notes,
          created_at: v2.created_at,
          updated_at: v2.updated_at,

          // Fields that don't exist in V2 — safe defaults
          is_hmo_licensed: null,
          epc_rating: null,
          conservation_area: false,
          formatted_address: `${v2.address_line_1}, ${v2.city}, ${v2.postcode}`,
          legal_owner_company_id: null,
          legal_owner_party_id: null,
          last_valuation_date: v2.valuation_date,
          last_valuation_estimate: v2.current_valuation,
          capital_invested_gbp: v2.purchase_price,

          // ─── Nested financial data ───
          loans: loans,
          income: perf ? [mapPerfToIncome(v2.id, perf)] : [],
          costs: perf ? [mapPerfToCosts(v2.id, perf)] : [],
          tenancies: agreements.map(a => mapAgreementToTenancy(a)),

          // ─── Extra V2 context ───
          __v2_entity_id: v2.entity_id,
          __v2_entity_name: v2.legal_entities?.entity_name,
        } as any;
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mappers ─────────────────────────────────────────────────────────

function mapLoanToV1(loan: any) {
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

function mapPerfToIncome(propertyId: string, perf: any) {
  const currentYear = new Date().getFullYear();
  return {
    id: `perf-income-${propertyId}`,
    org_id: null,
    property_id: propertyId,
    year: currentYear,
    annual_rent_gbp: perf.annual_rent_received,
    created_at: null,
  };
}

function mapPerfToCosts(propertyId: string, perf: any) {
  const currentYear = new Date().getFullYear();
  return {
    id: `perf-costs-${propertyId}`,
    org_id: null,
    property_id: propertyId,
    year: currentYear,
    insurance_gbp_manual: null,
    management_gbp_manual: null,
    maintenance_gbp_manual: null,
    utilities_gbp_manual: null,
    ground_rent_gbp_manual: null,
    __total_annual_costs: perf.annual_costs,
    created_at: null,
  };
}

function mapAgreementToTenancy(a: any) {
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
