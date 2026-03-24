import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';
import { calculatePropertyPnL, type PropertyFinancials } from '@/lib/propertyPnL';

export type { PropertyFinancials } from '@/lib/propertyPnL';

interface CapexLineItemRow {
  actual_gbp: number;
  paid_date: string | null;
  created_at: string;
}

interface CapexProjectRow {
  capex_line_items: CapexLineItemRow[] | null;
}

interface MaintenanceCostRow {
  paid_amount: number | null;
  paid_date: string | null;
}

/**
 * Fetch and calculate per-property P&L from actual transaction data.
 * Uses: tenancy_agreements → rent_payments, loan_facilities, works_orders, capex_line_items
 */
export function usePropertyPnL(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property-pnl', propertyId],
    enabled: !!propertyId,
    queryFn: async (): Promise<PropertyFinancials | null> => {
      if (!propertyId) return null;

      const twelveMonthsAgo = format(subMonths(new Date(), 11), 'yyyy-MM-01');

      // Parallel fetch all data sources
      const [propertyRes, roomsRes, agreementsRes, loansRes, maintenanceRes, capexRes] = await Promise.all([
        // 1. Property valuation
        supabase
          .from('properties_v2')
          .select('current_valuation')
          .eq('id', propertyId)
          .single(),

        // 2. Rooms for expected rent
        supabase
          .from('rooms_v2')
          .select('current_rent_pcm, is_lettable')
          .eq('property_id', propertyId),

        // 3. Tenancy agreements for this property (to get rent payments)
        supabase
          .from('tenancy_agreements')
          .select('id')
          .eq('property_id', propertyId),

        // 4. Active loans
        supabase
          .from('loan_facilities')
          .select('current_balance, interest_rate, monthly_payment')
          .eq('property_id', propertyId)
          .eq('status', 'active'),

        // 5. Maintenance costs from work_orders
        supabase
          .from('work_orders')
          .select('paid_amount, paid_date')
          .eq('property_id', propertyId)
          .not('paid_amount', 'is', null)
          .gte('paid_date', twelveMonthsAgo),

        // 6. CapEx line items via capex_projects
        supabase
          .from('capex_projects')
          .select('capex_line_items(actual_gbp, paid_date, created_at)')
          .eq('property_id', propertyId),
      ]);

      // Get rent payments for agreements of this property
      const agreementIds = (agreementsRes.data || []).map(a => a.id);
      let rentPayments: { amount: number; payment_date: string }[] = [];

      if (agreementIds.length > 0) {
        const { data: payments } = await supabase
          .from('rent_payments')
          .select('amount, payment_date')
          .in('agreement_id', agreementIds)
          .gte('payment_date', twelveMonthsAgo);
        rentPayments = payments || [];
      }

      // Also try V1 tenancies path as fallback
      if (rentPayments.length === 0) {
        const { data: tenancies } = await supabase
          .from('tenancies')
          .select('id')
          .eq('property_id', propertyId);

        const tenancyIds = (tenancies || []).map(t => t.id);
        if (tenancyIds.length > 0) {
          const { data: v1Payments } = await supabase
            .from('rent_payments')
            .select('amount, payment_date')
            .in('tenancy_id', tenancyIds)
            .gte('payment_date', twelveMonthsAgo);
          rentPayments = v1Payments || [];
        }
      }

      // Calculate expected rent from rooms
      const rooms = roomsRes.data || [];
      const expectedRentPcm = rooms
        .filter(r => r.is_lettable)
        .reduce((sum, r) => sum + (r.current_rent_pcm || 0), 0);

      // Flatten capex line items
      const capexItems = ((capexRes.data ?? []) as CapexProjectRow[]).flatMap(
        (project) => project.capex_line_items ?? [],
      );

      return calculatePropertyPnL(
        propertyId,
        propertyRes.data?.current_valuation || null,
        expectedRentPcm,
        rentPayments,
        loansRes.data || [],
        (maintenanceRes.data ?? []).map(r => ({ paid_amount: (r as any).actual_cost ?? null, paid_date: (r as any).actual_completion_date ?? null })) as MaintenanceCostRow[],
        capexItems,
        0, // management fee % — default self-managed
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}
