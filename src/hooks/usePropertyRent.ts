import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';

export type RentSource = 'tenancy' | 'property' | 'rooms' | 'none';

export interface ResolvedRent {
  pcm: number | null;
  source: RentSource;
}

interface RentablePropertyInput {
  id: string;
  rent_basis?: string | null;
  whole_house_rent_pcm?: number | null;
}

interface ActiveTenancyRow {
  property_id: string;
  rent_amount_pcm: number | null;
}

interface RoomRentRow {
  property_id: string;
  target_rent_pcm: number | null;
}

/**
 * Single source of truth for "what's the current monthly rent of property X?"
 *
 * Priority:
 *   1. Sum of `tenancy_agreements.rent_amount_pcm` where status='active'
 *   2. `properties_v2.whole_house_rent_pcm`
 *   3. Sum of room-level rents (HMOs)
 *   4. null (with source='none')
 *
 * Returning the source lets surfaces show provenance ("from tenancy" vs
 * "stale property field"), which is the difference between a meaningful
 * rent KPI and a misleading one.
 */
export function usePropertyRent(property?: RentablePropertyInput | null): ResolvedRent {
  const { byProperty } = useAllPropertyRents();

  return useMemo<ResolvedRent>(() => {
    if (!property) return { pcm: null, source: 'none' };
    const fromMap = byProperty.get(property.id);
    if (fromMap && fromMap.pcm !== null) return fromMap;

    if (property.whole_house_rent_pcm && property.whole_house_rent_pcm > 0) {
      return { pcm: property.whole_house_rent_pcm, source: 'property' };
    }
    return { pcm: null, source: 'none' };
  }, [property, byProperty]);
}

/**
 * Bulk version — one round-trip for all rents in the org. Use this in grids,
 * portfolio totals, and any list view. The per-property hook above is a thin
 * lookup on top of this.
 */
export function useAllPropertyRents() {
  const { data, isLoading } = useQuery({
    queryKey: ['property_rents_resolved'],
    queryFn: async () => {
      const [tenanciesRes, propsRes, roomsRes] = await Promise.all([
        supabaseAny
          .from('tenancy_agreements')
          .select('property_id, rent_amount_pcm')
          .eq('status', 'active'),
        supabaseAny
          .from('properties_v2')
          .select('id, whole_house_rent_pcm'),
        supabaseAny
          .from('rooms')
          .select('property_id, rent_pcm'),
      ]);

      return {
        tenancies: (tenanciesRes.data || []) as ActiveTenancyRow[],
        properties: (propsRes.data || []) as Array<{ id: string; whole_house_rent_pcm: number | null }>,
        rooms: ((roomsRes.data as RoomRentRow[] | null) || []),
      };
    },
    staleTime: 60_000,
  });

  const byProperty = useMemo(() => {
    const map = new Map<string, ResolvedRent>();
    if (!data) return map;

    // Tenancies first — most authoritative
    const tenancyPcm = new Map<string, number>();
    for (const t of data.tenancies) {
      if (!t.property_id || !t.rent_amount_pcm) continue;
      tenancyPcm.set(t.property_id, (tenancyPcm.get(t.property_id) || 0) + Number(t.rent_amount_pcm));
    }
    for (const [pid, pcm] of tenancyPcm) {
      if (pcm > 0) map.set(pid, { pcm, source: 'tenancy' });
    }

    // Rooms — fallback if no tenancy
    const roomPcm = new Map<string, number>();
    for (const r of data.rooms) {
      if (!r.property_id || !r.rent_pcm) continue;
      roomPcm.set(r.property_id, (roomPcm.get(r.property_id) || 0) + Number(r.rent_pcm));
    }

    // Property column — final fallback
    for (const p of data.properties) {
      if (map.has(p.id)) continue;
      const rooms = roomPcm.get(p.id);
      if (rooms && rooms > 0) {
        map.set(p.id, { pcm: rooms, source: 'rooms' });
      } else if (p.whole_house_rent_pcm && p.whole_house_rent_pcm > 0) {
        map.set(p.id, { pcm: p.whole_house_rent_pcm, source: 'property' });
      } else {
        map.set(p.id, { pcm: null, source: 'none' });
      }
    }

    return map;
  }, [data]);

  return { byProperty, isLoading };
}
