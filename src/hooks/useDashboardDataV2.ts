/**
 * Bridge hook: fetches V2 data and maps it into the V1 PropertyWithFinancials shape
 * so existing Dashboard components, metricsConfig, and calculations work unchanged.
 *
 * This is the recommended migration approach: swap data source, keep interface stable.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import type { PropertyWithFinancials } from './useProperties';

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
      const loansByProperty = new Map<string, typeof loans>();
      for (const loan of loans || []) {
        const existing = loansByProperty.get(loan.property_id) || [];
        existing.push(loan);
        loansByProperty.set(loan.property_id, existing);
      }

      const rentByProperty = new Map<string, number>();
      for (const ag of agreements || []) {
        const current = rentByProperty.get(ag.property_id) || 0;
        rentByProperty.set(ag.property_id, current + (ag.rent_amount_pcm || 0));
      }

      // Map V2 → V1 PropertyWithFinancials shape
      const currentYear = new Date().getFullYear();
      const mapped: PropertyWithFinancials[] = (properties || []).map((p: any) => {
        const propertyLoans = loansByProperty.get(p.id) || [];
        const monthlyRent = rentByProperty.get(p.id) || 0;
        const annualRent = monthlyRent * 12;

        // Map the primary loan to V1 loan shape
        const primaryLoan = propertyLoans[0];
        const v1Loans = propertyLoans.map((lf: any) => ({
          id: lf.id,
          property_id: lf.property_id,
          org_id: lf.org_id,
          lender: (lf as any).lenders?.lender_name || null,
          current_mortgage_balance_gbp: lf.current_balance,
          interest_rate_percent: lf.interest_rate,
          loan_term_months: null, // V2 uses term dates not months
          capital_or_interest: lf.interest_only ? 'interest' : 'repayment',
          fixed_rate_expires: lf.rate_expiry_date,
          mortgage_payment_gbp: lf.monthly_payment,
          payment_override_gbp: null,
          created_at: lf.created_at,
          updated_at: lf.updated_at,
        }));

        // Map to V1 income shape
        const v1Income = annualRent > 0 ? [{
          id: `v2-income-${p.id}`,
          property_id: p.id,
          org_id: p.org_id,
          year: currentYear,
          annual_rent_gbp: annualRent,
          other_income_gbp: null,
          created_at: p.created_at,
          updated_at: p.updated_at,
        }] : [];

        // Determine lifecycle from V2 lifecycle_stage
        const isCore = ['stabilised', 'letting'].includes(p.lifecycle_stage);
        const lifecycleType = isCore ? 'core_rental' : 'development';

        // Property type mapping for HMO check
        const isHmo = p.property_type?.startsWith('hmo');

        // Sum total debt for this property
        const totalDebt = propertyLoans.reduce((s: number, l: any) => s + (l.current_balance || 0), 0);

        return {
          // Core identity fields mapped from V2
          id: p.id,
          org_id: p.org_id,
          address_line: p.address_line_1 + (p.address_line_2 ? `, ${p.address_line_2}` : ''),
          postcode: p.postcode,
          city: p.city || null,
          county: p.county || null,
          latitude: p.latitude,
          longitude: p.longitude,
          property_type: p.property_type,
          lifecycle_type: lifecycleType,
          
          // Financial fields
          current_value_gbp: p.current_valuation,
          purchase_price_gbp: p.purchase_price,
          original_purchase_date: p.purchase_date,
          
          // Property characteristics
          beds: p.total_lettable_rooms,
          bathrooms: null,
          tenure: null,
          epc_rating: p.epc_rating || null,
          epc_required: p.listing_grade === 'none' || !p.listing_grade,
          
          // HMO
          is_hmo_licensed: isHmo,
          
          // Leasehold
          lease_years_remaining: null,
          
          // Entity info (not on V1 but useful)
          entity_name: p.legal_entities?.entity_name,
          entity_type: p.legal_entities?.entity_type,

          // Nested financial data in V1 shape
          loans: v1Loans,
          income: v1Income,
          costs: [],
          tenancies: [],

          // Fields that don't exist on V2 — null them out
          created_at: p.created_at,
          updated_at: p.updated_at,
        } as any as PropertyWithFinancials;
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
      return (data || []).map((d: any) => ({
        ...d,
        // Map to shapes expected by rentalStats
        rent_amount_pcm: d.rent_amount_pcm,
        end_date: d.actual_end_date || d.initial_end_date,
        tenant: {
          id: d.tenant_id,
          first_name: d.tenants_v2?.first_name || '',
          last_name: d.tenants_v2?.last_name || '',
        },
        room: { room_name: d.rooms_v2?.room_name || '' },
        property: {
          id: d.property_id,
          address_line: d.properties_v2?.address_line_1 || '',
        },
      }));
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
      return (data || []).map((r: any) => ({
        ...r,
        // Map V2 occupancy_status to V1 status
        status: r.occupancy_status === 'occupied' ? 'occupied' : 'vacant',
      }));
    },
  });
}
