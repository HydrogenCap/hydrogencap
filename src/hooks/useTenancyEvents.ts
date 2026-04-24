/**
 * Tenancy Events Hook (AA4a)
 * Fetches tenancies and calculates lifecycle events.
 */
import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { calculateAllEvents, type TenancyEvent } from '@/lib/tenancyLifecycle';

interface UseTenancyEventsOptions {
  propertyId?: string;
  tenancyId?: string;
  daysAhead?: number;
}

interface TenancyEventTenant {
  first_name: string | null;
  last_name: string | null;
}

interface TenancyEventProperty {
  id: string;
  address_line_1: string | null;
  city: string | null;
  postcode: string | null;
}

interface TenancyEventRoom {
  room_name: string | null;
  property_id: string | null;
  properties_v2: TenancyEventProperty | null;
}

interface TenancyEventRow {
  id: string;
  start_date: string;
  initial_end_date: string | null;
  actual_end_date: string | null;
  break_clause_date: string | null;
  last_rent_review_date: string | null;
  status: string;
  rent_amount_pcm: number;
  is_periodic: boolean;
  tenants_v2: TenancyEventTenant | null;
  rooms_v2: TenancyEventRoom | null;
}

export function useTenancyEvents(options?: UseTenancyEventsOptions) {
  return useQuery({
    queryKey: ['tenancy-events', options?.propertyId, options?.tenancyId, options?.daysAhead],
    queryFn: async (): Promise<TenancyEvent[]> => {
      const orgId = await fetchUserOrgId();

      let query = supabaseAny
        .from('tenancy_agreements')
        .select(`
          id, start_date, initial_end_date, actual_end_date,
          break_clause_date, last_rent_review_date, last_rent_review_amount,
          status, rent_amount_pcm, is_periodic,
          tenants_v2(first_name, last_name),
          rooms_v2(room_name, property_id,
            properties_v2(id, address_line_1, city, postcode)
          )
        `)
        .eq('org_id', orgId)
        .in('status', ['active', 'periodic']);

      if (options?.tenancyId) {
        query = query.eq('id', options.tenancyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Map to the shape expected by calculateAllEvents
      let tenancies = ((data || []) as TenancyEventRow[]).map((d) => ({
        id: d.id,
        start_date: d.start_date,
        initial_end_date: d.initial_end_date,
        actual_end_date: d.actual_end_date,
        break_clause_date: d.break_clause_date,
        last_rent_review_date: d.last_rent_review_date,
        status: d.status,
        rent_amount_pcm: d.rent_amount_pcm,
        is_periodic: d.is_periodic,
        tenant: d.tenants_v2 ? { first_name: d.tenants_v2.first_name, last_name: d.tenants_v2.last_name } : null,
        room: d.rooms_v2 ? {
          room_name: d.rooms_v2.room_name,
          property: d.rooms_v2.properties_v2 ? {
            id: d.rooms_v2.properties_v2.id,
            address_line_1: d.rooms_v2.properties_v2.address_line_1,
            city: d.rooms_v2.properties_v2.city,
            postcode: d.rooms_v2.properties_v2.postcode,
          } : null,
        } : null,
      }));

      // Filter by propertyId if specified
      if (options?.propertyId) {
        tenancies = tenancies.filter(t => t.room?.property?.id === options.propertyId);
      }

      return calculateAllEvents(tenancies, options?.daysAhead || 90);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Convenience hook for counting urgent tenancy events (for sidebar badge)
 */
export function useTenancyEventCounts() {
  const { data: events } = useTenancyEvents({ daysAhead: 30 });
  const urgentCount = (events || []).filter(e => e.status === 'overdue' || e.status === 'action_required').length;
  return { urgentCount };
}
