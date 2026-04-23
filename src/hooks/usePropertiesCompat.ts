import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { PropertyWithFinancials } from './useProperties';

// Re-export the V1 type so consumers can import from one place
export type { PropertyWithFinancials } from './useProperties';

type PropertyV2Row = Database['public']['Tables']['properties_v2']['Row'];
type LoanFacilityRow = Database['public']['Tables']['loan_facilities']['Row'];
type PropertyAnnualPerformanceRow = Database['public']['Views']['property_annual_performance']['Row'];
type TenancyAgreementRow = Database['public']['Tables']['tenancy_agreements']['Row'];

type PropertyV2WithEntity = PropertyV2Row & {
  legal_entities?: { entity_name: string | null } | Array<{ entity_name: string | null }> | null;
};

export type PropertyCompatWithFinancials = PropertyWithFinancials & {
  __v2_entity_id: string;
  __v2_entity_name: string | null;
};

/**
 * Compatibility adapter: reads V2 tables, returns V1 PropertyWithFinancials shape.
 *
 * This exists to let V1 consumer pages switch away from the V1 properties table
 * without rewriting their rendering logic. Once all consumers are migrated to
 * native V2 hooks, this adapter can be removed.
 *
 * V2 sources:
 *   properties_v2              â†’ core property fields
 *   loan_facilities            â†’ replaces V1 loans
 *   property_annual_performance â†’ replaces V1 income + costs
 *   tenancy_agreements         â†’ replaces V1 tenancies
 */
export function usePropertiesCompat() {
  return useQuery({
    queryKey: ['properties_compat_v2'],
    queryFn: async (): Promise<PropertyCompatWithFinancials[]> => {
      // Parallel fetch all V2 data
      const [propsRes, loansRes, perfRes, agreementsRes] = await Promise.all([
        (supabase as any)
          .from('properties_v2')
          .select('*, legal_entities!inner(entity_name)')
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('loan_facilities')
          .select('*')
          .in('status', ['active', 'drawdown']),
        (supabase as any)
          .from('property_annual_performance')
          .select('*'),
        (supabase as any)
          .from('tenancy_agreements')
          .select('id, property_id, tenant_id, room_id, status, rent_amount_pcm, start_date, initial_end_date')
          .in('status', ['active', 'pending', 'notice_period']),
      ]);

      if (propsRes.error) throw propsRes.error;

      // Build lookup maps
      const loansByProp = new Map<string, LoanFacilityRow[]>();
      for (const loan of loansRes.data || []) {
        const loans = loansByProp.get(loan.property_id) || [];
        loans.push(loan);
        loansByProp.set(loan.property_id, loans);
      }

      const perfByProp = new Map<string, PropertyAnnualPerformanceRow>();
      for (const performance of perfRes.data || []) {
        if (performance.property_id) perfByProp.set(performance.property_id, performance);
      }

      const agreementsByProp = new Map<string, TenancyAgreementRow[]>();
      for (const agreement of agreementsRes.data || []) {
        const agreements = agreementsByProp.get(agreement.property_id) || [];
        agreements.push(agreement as any);
        agreementsByProp.set(agreement.property_id, agreements);
      }

      // Map V2 properties to V1 PropertyWithFinancials shape
      return ((propsRes.data || []) as PropertyV2WithEntity[]).map((property) => {
        const loans = (loansByProp.get(property.id) || []).map(mapLoanToV1);
        const performance = perfByProp.get(property.id);
        const agreements = agreementsByProp.get(property.id) || [];
        const legalEntity = Array.isArray(property.legal_entities)
          ? property.legal_entities[0]
          : property.legal_entities;

        return {
          // â”€â”€â”€ Core property fields (V2 â†’ V1 mapping) â”€â”€â”€
          id: property.id,
          org_id: property.org_id,
          address_line: property.address_line_1,
          address_line2: property.address_line_2,
          area_name: property.city,
          town_city: property.city,
          postcode: property.postcode,
          county: property.county,
          country: property.country,
          property_type: property.property_type,
          beds: property.total_lettable_rooms,
          bathrooms: null,
          latitude: property.latitude,
          longitude: property.longitude,
          current_value_gbp: property.current_valuation,
          purchase_price_gbp: property.purchase_price,
          purchase_date: property.purchase_date,
          lifecycle_type: ['stabilised', 'letting'].includes(property.lifecycle_stage) ? 'core_rental' : 'development',
          has_gas: property.has_gas_supply,
          is_grade_listed: property.listing_grade !== 'none',
          listing_grade: property.listing_grade,
          notes: property.notes,
          created_at: property.created_at,
          updated_at: property.updated_at,

          // Fields that don't exist in V2 â€” safe defaults
          is_hmo_licensed: null,
          epc_rating: null,
          conservation_area: false,
          formatted_address: `${property.address_line_1}, ${property.city}, ${property.postcode}`,
          legal_owner_company_id: null,
          legal_owner_party_id: null,
          last_valuation_date: property.valuation_date,
          last_valuation_estimate: property.current_valuation,
          capital_invested_gbp: property.purchase_price,

          // â”€â”€â”€ Nested financial data â”€â”€â”€
          loans,
          income: performance ? [mapPerfToIncome(property.id, performance)] : [],
          costs: performance ? [mapPerfToCosts(property.id, performance)] : [],
          tenancies: agreements.map((agreement) => mapAgreementToTenancy(agreement)),

          // â”€â”€â”€ Extra V2 context â”€â”€â”€
          __v2_entity_id: property.entity_id,
          __v2_entity_name: legalEntity?.entity_name || null,
        } as unknown as PropertyCompatWithFinancials;
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}

// â”€â”€â”€ Mappers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function mapLoanToV1(loan: LoanFacilityRow): any {
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

function mapPerfToIncome(propertyId: string, performance: PropertyAnnualPerformanceRow): any {
  const currentYear = new Date().getFullYear();
  return {
    id: `perf-income-${propertyId}`,
    org_id: null,
    property_id: propertyId,
    year: currentYear,
    annual_rent_gbp: performance.annual_rent_received,
    created_at: null,
  };
}

function mapPerfToCosts(propertyId: string, performance: PropertyAnnualPerformanceRow): any {
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
    __total_annual_costs: performance.annual_costs,
    created_at: null,
  };
}

function mapAgreementToTenancy(agreement: any): any {
  return {
    id: agreement.id,
    org_id: null,
    tenant_id: agreement.tenant_id,
    room_id: agreement.room_id,
    property_id: agreement.property_id,
    start_date: agreement.start_date,
    end_date: agreement.initial_end_date,
    rent_amount_pcm: agreement.rent_amount_pcm,
    rent_due_day: 1,
    status: agreement.status === 'notice_period' ? 'notice' : agreement.status,
    created_at: null,
    updated_at: null,
  };
}
