/**
 * Bridge hook: fetches V2 data and maps it into the V1 PropertyWithFinancials shape
 * so existing Dashboard components, metricsConfig, and calculations work unchanged.
 *
 * This is the recommended migration approach: swap data source, keep interface stable.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchUserOrgId } from './useUserOrg';
import type { PropertyWithFinancials } from './useProperties';

type PropertyV2Row = Database['public']['Tables']['properties_v2']['Row'];
type LoanFacilityRow = Database['public']['Tables']['loan_facilities']['Row'];
type TenancyAgreementRow = Database['public']['Tables']['tenancy_agreements']['Row'];
type RoomV2Row = Database['public']['Tables']['rooms_v2']['Row'];

type PropertyWithEntity = PropertyV2Row & {
  legal_entities?: { entity_name: string | null; entity_type: string | null } | Array<{ entity_name: string | null; entity_type: string | null }> | null;
};

type LoanWithLender = LoanFacilityRow & {
  lenders?: { lender_name: string | null } | Array<{ lender_name: string | null }> | null;
};

type DashboardTenancyRow = Pick<
  TenancyAgreementRow,
  'id' | 'status' | 'rent_amount_pcm' | 'start_date' | 'initial_end_date' | 'actual_end_date' | 'property_id' | 'room_id' | 'tenant_id'
> & {
  tenants_v2?: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null;
  rooms_v2?: { room_name: string | null } | Array<{ room_name: string | null }> | null;
  properties_v2?: { address_line_1: string | null } | Array<{ address_line_1: string | null }> | null;
};

type DashboardRoom = Pick<RoomV2Row, 'id' | 'property_id' | 'room_name' | 'occupancy_status' | 'is_lettable'>;

function getSingleRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
}

export function useDashboardPropertiesV2() {
  return useQuery({
    queryKey: ['dashboard_properties_v2'],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();

      // Fetch V2 properties with entity info
      const { data: properties, error: propErr } = await supabase
        .from('properties_v2')
        .select('*, legal_entities!inner(entity_name, entity_type)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (propErr) throw propErr;

      // Fetch active loan facilities for all properties
      const { data: loans, error: loanErr } = await supabase
        .from('loan_facilities')
        .select('*, lenders!inner(lender_name)')
        .eq('org_id', orgId)
        .eq('status', 'active');
      if (loanErr) throw loanErr;

      // Fetch active tenancy agreements for rent data
      const { data: agreements, error: agErr } = await supabase
        .from('tenancy_agreements')
        .select('*')
        .eq('org_id', orgId)
        .in('status', ['active', 'periodic', 'notice_period']);
      if (agErr) throw agErr;

      // Build lookup maps
      const loansByProperty = new Map<string, LoanWithLender[]>();
      for (const loan of (loans || []) as LoanWithLender[]) {
        const existing = loansByProperty.get(loan.property_id) || [];
        existing.push(loan);
        loansByProperty.set(loan.property_id, existing);
      }

      const rentByProperty = new Map<string, number>();
      for (const agreement of agreements || []) {
        const current = rentByProperty.get(agreement.property_id) || 0;
        rentByProperty.set(agreement.property_id, current + (agreement.rent_amount_pcm || 0));
      }

      // Map V2 → V1 PropertyWithFinancials shape
      const currentYear = new Date().getFullYear();
      const mapped: PropertyWithFinancials[] = ((properties || []) as PropertyWithEntity[]).map((property) => {
        const propertyLoans = loansByProperty.get(property.id) || [];
        const monthlyRent = rentByProperty.get(property.id) || 0;
        const annualRent = monthlyRent * 12;
        const legalEntity = getSingleRelation(property.legal_entities);

        const v1Loans = propertyLoans.map((loan) => {
          const lender = getSingleRelation(loan.lenders);
          return {
            id: loan.id,
            property_id: loan.property_id,
            org_id: loan.org_id,
            lender: lender?.lender_name || null,
            current_mortgage_balance_gbp: loan.current_balance,
            interest_rate_percent: loan.interest_rate,
            loan_term_months: null,
            capital_or_interest: loan.interest_only ? 'interest' : 'repayment',
            fixed_rate_expires: loan.rate_expiry_date,
            mortgage_payment_gbp: loan.monthly_payment,
            payment_override_gbp: null,
            created_at: loan.created_at,
            updated_at: loan.updated_at,
          };
        });

        const v1Income = annualRent > 0 ? [{
          id: `v2-income-${property.id}`,
          property_id: property.id,
          org_id: property.org_id,
          year: currentYear,
          annual_rent_gbp: annualRent,
          other_income_gbp: null,
          created_at: property.created_at,
          updated_at: property.updated_at,
        }] : [];

        const isCore = ['stabilised', 'letting'].includes(property.lifecycle_stage);
        const lifecycleType = isCore ? 'core_rental' : 'development';
        const isHmo = property.property_type?.startsWith('hmo');

        return ({
          id: property.id,
          org_id: property.org_id,
          address_line: property.address_line_1 + (property.address_line_2 ? `, ${property.address_line_2}` : ''),
          postcode: property.postcode,
          city: property.city || null,
          county: property.county || null,
          latitude: property.latitude,
          longitude: property.longitude,
          property_type: property.property_type,
          lifecycle_type: lifecycleType,
          current_value_gbp: property.current_valuation,
          purchase_price_gbp: property.purchase_price,
          original_purchase_date: property.purchase_date,
          beds: property.total_lettable_rooms,
          bathrooms: null,
          tenure: null,
          epc_rating: property.epc_rating || null,
          epc_required: property.listing_grade === 'none' || !property.listing_grade,
          is_hmo_licensed: isHmo,
          lease_years_remaining: null,
          entity_name: legalEntity?.entity_name || null,
          entity_type: legalEntity?.entity_type || null,
          loans: v1Loans,
          income: v1Income,
          costs: [],
          tenancies: [],
          created_at: property.created_at,
          updated_at: property.updated_at,
        } as PropertyWithFinancials;
      });

      return mapped;
    },
  });
}

/**
 * V2 tenancy data for rental/occupancy stats
 */
export function useDashboardTenanciesV2() {
  return useQuery({
    queryKey: ['dashboard_tenancies_v2'],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase
        .from('tenancy_agreements')
        .select(`
          id, status, rent_amount_pcm, start_date,
          initial_end_date, actual_end_date,
          property_id, room_id, tenant_id,
          tenants_v2(first_name, last_name),
          rooms_v2(room_name),
          properties_v2(address_line_1)
        `)
        .eq('org_id', orgId);
      if (error) throw error;

      return ((data || []) as DashboardTenancyRow[]).map((agreement) => {
        const tenant = getSingleRelation(agreement.tenants_v2);
        const room = getSingleRelation(agreement.rooms_v2);
        const property = getSingleRelation(agreement.properties_v2);

        return {
          ...agreement,
          rent_amount_pcm: agreement.rent_amount_pcm,
          end_date: agreement.actual_end_date || agreement.initial_end_date,
          tenant: {
            id: agreement.tenant_id,
            first_name: tenant?.first_name || '',
            last_name: tenant?.last_name || '',
          },
          room: { room_name: room?.room_name || '' },
          property: {
            id: agreement.property_id,
            address_line: property?.address_line_1 || '',
          },
        };
      });
    },
  });
}

/**
 * V2 rooms data for occupancy stats
 */
export function useDashboardRoomsV2() {
  return useQuery({
    queryKey: ['dashboard_rooms_v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms_v2')
        .select('id, property_id, room_name, occupancy_status, is_lettable');
      if (error) throw error;

      return ((data || []) as DashboardRoom[]).map((room) => ({
        ...room,
        status: room.occupancy_status === 'occupied' ? 'occupied' : 'vacant',
      }));
    },
  });
}
