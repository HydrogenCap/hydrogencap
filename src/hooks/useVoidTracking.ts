import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';
import {
  calculateVoidDays,
  calculateAverageTurnaround,
  calculatePortfolioVoidRate,
} from '@/lib/void-calculator';

export type VoidReason =
  | 'between_tenants'
  | 'refurbishment'
  | 'market_conditions'
  | 'legal_dispute'
  | 'maintenance'
  | 'sale_preparation'
  | 'other';

export const VOID_REASON_LABELS: Record<VoidReason, string> = {
  between_tenants: 'Between Tenants',
  refurbishment: 'Refurbishment',
  market_conditions: 'Market Conditions',
  legal_dispute: 'Legal Dispute',
  maintenance: 'Maintenance',
  sale_preparation: 'Sale Preparation',
  other: 'Other',
};

export interface VoidPeriod {
  id: string;
  property_id: string;
  room_id: string | null;
  org_id: string;
  start_date: string;
  end_date: string | null;
  reason: VoidReason | null;
  reason_notes: string | null;
  estimated_monthly_cost: number | null;
  actual_costs: number | null;
  lost_rent: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActiveVoid extends VoidPeriod {
  property: { id: string; address_line_1: string; postcode: string };
  room: { room_name: string; current_rent_pcm: number | null } | null;
}

/** Currently void properties/rooms */
export function useActiveVoids() {
  return useQuery({
    queryKey: ['void-tracking', 'active'],
    queryFn: async () => {
      const { data: voids, error } = await (supabase as any)
        .from('void_periods')
        .select('*')
        .is('end_date', null)
        .order('start_date', { ascending: true });

      if (error) throw error;
      if (!voids || voids.length === 0) return [] as ActiveVoid[];

      const propertyIds = [...new Set(voids.map(v => v.property_id))];
      const roomIds = [...new Set(voids.map(v => v.room_id).filter(Boolean))] as string[];

      const [propsRes, roomsRes] = await Promise.all([
        (supabase as any).from('properties_v2').select('id, address_line_1, city, postcode').in('id', propertyIds),
        roomIds.length > 0
          ? (supabase as any).from('rooms_v2').select('id, room_name, current_rent_pcm').in('id', roomIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const propMap = new Map((propsRes.data || []).map(p => [p.id, p]));
      const roomMap = new Map((roomsRes.data || []).map(r => [r.id, r]));

      return voids.map(v => ({
        ...(v as unknown as VoidPeriod),
        property: propMap.get(v.property_id) || { id: v.property_id, address_line_1: 'Unknown', postcode: '' },
        room: v.room_id ? roomMap.get(v.room_id) || null : null,
      })) as ActiveVoid[];
    },
  });
}

/** Historical voids, optionally filtered by property */
export function useVoidHistory(propertyId?: string) {
  return useQuery({
    queryKey: ['void-tracking', 'history', propertyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('void_periods')
        .select('*')
        .not('end_date', 'is', null)
        .order('end_date', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as VoidPeriod[];
    },
  });
}

/** Start a void period */
export function useCreateVoid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      propertyId: string;
      roomId?: string;
      startDate: string;
      reason?: VoidReason;
      estimatedMonthlyCost?: number;
      notes?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await (supabase as any)
        .from('void_periods')
        .insert({
          org_id: orgId,
          property_id: input.propertyId,
          room_id: input.roomId || null,
          start_date: input.startDate,
          reason: input.reason || null,
          estimated_monthly_cost: input.estimatedMonthlyCost || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['void-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['void-periods'] });
      toast({ title: 'Void period started' });
    },
  });
}

/** End a void period with actual costs */
export function useEndVoid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      endDate,
      actualCosts,
    }: {
      id: string;
      endDate: string;
      actualCosts?: number;
    }) => {
      const updates: Record<string, unknown> = { end_date: endDate };
      if (actualCosts !== undefined) {
        updates.actual_costs = actualCosts;
      }

      const { data, error } = await (supabase as any)
        .from('void_periods')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['void-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['void-periods'] });
      toast({ title: 'Void period ended' });
    },
  });
}

/** Portfolio void stats: void rate, avg duration, total cost */
export function useVoidStats() {
  const { data: activeVoids } = useActiveVoids();
  const { data: history } = useVoidHistory();

  return useQuery({
    queryKey: ['void-tracking', 'stats', activeVoids?.length, history?.length],
    enabled: activeVoids !== undefined,
    queryFn: async () => {
      const activeCount = activeVoids?.length ?? 0;

      // Calculate total monthly cost from active voids
      let totalMonthlyCost = 0;
      if (activeVoids) {
        for (const v of activeVoids) {
          const monthlyRent = v.room?.current_rent_pcm ?? v.estimated_monthly_cost ?? 0;
          totalMonthlyCost += monthlyRent;
        }
      }

      // Calculate average void duration from completed voids
      const completedDurations = (history || []).map(v =>
        calculateVoidDays(v.start_date, v.end_date),
      );
      const avgDuration = calculateAverageTurnaround(completedDurations);

      // Calculate YTD void cost
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const allVoids = [...(activeVoids || []), ...(history || [])];
      let ytdCost = 0;
      for (const v of allVoids) {
        if (v.end_date && v.end_date < yearStart) continue;
        const effectiveStart = v.start_date > yearStart ? v.start_date : yearStart;
        const days = calculateVoidDays(effectiveStart, v.end_date);
        const dailyRent = ((v as ActiveVoid).room?.current_rent_pcm ?? v.estimated_monthly_cost ?? 0) / 30;
        ytdCost += dailyRent * days;
      }

      // Portfolio void rate
      const [roomsRes, voidsRes] = await Promise.all([
        supabase.from('rooms_v2').select('id', { count: 'exact', head: true }).eq('is_lettable', true),
        supabase.from('void_periods').select('id', { count: 'exact', head: true }).is('end_date', null),
      ]);

      const totalRooms = roomsRes.count || 0;
      const voidRooms = voidsRes.count || 0;
      const voidRate = calculatePortfolioVoidRate(voidRooms, totalRooms);

      return {
        activeCount,
        voidRate,
        voidRooms,
        totalRooms,
        avgDuration,
        totalMonthlyCost: Math.round(totalMonthlyCost),
        ytdCost: Math.round(ytdCost),
      };
    },
  });
}
