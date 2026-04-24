import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';
import { detectVoidRooms } from '@/lib/voidDetection';

export type VoidReason = 'between_tenants' | 'refurbishment' | 'sale_preparation' | 'legal_dispute' | 'other';

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
  created_at: string;
  updated_at: string;
}

export const VOID_REASON_LABELS: Record<VoidReason, string> = {
  between_tenants: 'Between Tenants',
  refurbishment: 'Refurbishment',
  sale_preparation: 'Sale Preparation',
  legal_dispute: 'Legal Dispute',
  other: 'Other',
};

export function useVoidPeriods(propertyId?: string) {
  return useQuery({
    queryKey: ['void-periods', propertyId],
    queryFn: async () => {
      let query = supabaseAny
        .from('void_periods')
        .select('*')
        .order('start_date', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as VoidPeriod[];
    },
  });
}

export interface ActiveVoid extends VoidPeriod {
  property: { id: string; address_line_1: string; postcode: string };
  room: { room_name: string; current_rent_pcm: number | null } | null;
}

export function useActiveVoids() {
  return useQuery({
    queryKey: ['void-periods', 'active'],
    queryFn: async () => {
      const { data: voids, error } = await supabaseAny
        .from('void_periods')
        .select('*')
        .is('end_date', null)
        .order('start_date', { ascending: true });

      if (error) throw error;
      if (!voids || voids.length === 0) return [] as ActiveVoid[];

      // Fetch related properties and rooms manually (FK goes to properties V1, not V2)
      const propertyIds = [...new Set(voids.map(v => v.property_id))];
      const roomIds = [...new Set(voids.map(v => v.room_id).filter(Boolean))] as string[];

      const [propsRes, roomsRes] = await Promise.all([
        supabaseAny.from('properties_v2').select('id, address_line_1, city, postcode').in('id', propertyIds),
        roomIds.length > 0
          ? supabaseAny.from('rooms_v2').select('id, room_name, current_rent_pcm').in('id', roomIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const propMap = new Map((propsRes.data || []).map(p => [p.id, p]));
      const roomMap = new Map((roomsRes.data || []).map(r => [r.id, r]));

      return voids.map(v => ({
        ...v,
        property: propMap.get(v.property_id) || { id: v.property_id, address_line_1: 'Unknown', postcode: '' },
        room: v.room_id ? roomMap.get(v.room_id) || null : null,
      })) as ActiveVoid[];
    },
  });
}

export function useVoidStats() {
  const { data: allVoids } = useVoidPeriods();
  const { data: activeVoids } = useActiveVoids();

  if (!allVoids) return null;

  const active = allVoids.filter(v => !v.end_date);
  const completedVoids = allVoids.filter(v => v.end_date);

  const avgDays = completedVoids.length > 0
    ? Math.round(
        completedVoids.reduce((sum, v) => {
          const start = new Date(v.start_date);
          const end = new Date(v.end_date!);
          return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / completedVoids.length
      )
    : 0;

  // Calculate financial impact
  let totalDailyLostRent = 0;
  if (activeVoids) {
    for (const v of activeVoids) {
      const dailyRent = v.room?.current_rent_pcm
        ? v.room.current_rent_pcm / 30
        : (v.estimated_monthly_cost || 0) / 30;
      totalDailyLostRent += dailyRent;
    }
  }

  const totalMonthlyCost = totalDailyLostRent * 30;

  return {
    activeCount: active.length,
    totalCompleted: completedVoids.length,
    averageDays: avgDays,
    totalMonthlyCost: Math.round(totalMonthlyCost),
    totalDailyLostRent: Math.round(totalDailyLostRent),
  };
}

/** Detect rooms that appear void but have no void_period record */
export function useUntrackedVoids() {
  return useQuery({
    queryKey: ['void-periods', 'untracked'],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();

      // Fetch lettable rooms, active tenancies, open voids, and properties in parallel
      const [roomsRes, tenanciesRes, voidsRes, propsRes] = await Promise.all([
        supabase.from('rooms_v2').select('id, property_id, room_name, is_lettable, occupancy_status, current_rent_pcm').eq('is_lettable', true),
        supabase.from('tenancy_agreements').select('room_id, status, start_date, actual_end_date').in('status', ['active', 'periodic', 'notice_served', 'notice_period']),
        supabase.from('void_periods').select('property_id, room_id, end_date').is('end_date', null),
        supabase.from('properties_v2').select('id, address_line_1, postcode').eq('org_id', orgId),
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (tenanciesRes.error) throw tenanciesRes.error;
      if (voidsRes.error) throw voidsRes.error;
      if (propsRes.error) throw propsRes.error;

      return detectVoidRooms(
        roomsRes.data || [],
        tenanciesRes.data || [],
        voidsRes.data || [],
        propsRes.data || [],
      );
    },
    staleTime: 60_000,
  });
}

/** Portfolio void rate: void rooms / total lettable rooms */
export function useVoidRate() {
  return useQuery({
    queryKey: ['void-periods', 'rate'],
    queryFn: async () => {
      const [roomsRes, voidsRes] = await Promise.all([
        supabase.from('rooms_v2').select('id', { count: 'exact', head: true }).eq('is_lettable', true),
        supabase.from('void_periods').select('id', { count: 'exact', head: true }).is('end_date', null),
      ]);

      const totalRooms = roomsRes.count || 0;
      const voidRooms = voidsRes.count || 0;

      return {
        totalRooms,
        voidRooms,
        voidRate: totalRooms > 0 ? Math.round((voidRooms / totalRooms) * 100 * 10) / 10 : 0,
      };
    },
    staleTime: 60_000,
  });
}

export function useCreateVoidPeriod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (voidPeriod: {
      propertyId: string;
      roomId?: string;
      startDate: string;
      endDate?: string;
      reason?: VoidReason;
      reasonNotes?: string;
      estimatedMonthlyCost?: number;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('void_periods')
        .insert({
          org_id: orgId,
          property_id: voidPeriod.propertyId,
          room_id: voidPeriod.roomId || null,
          start_date: voidPeriod.startDate,
          end_date: voidPeriod.endDate || null,
          reason: voidPeriod.reason || null,
          reason_notes: voidPeriod.reasonNotes || null,
          estimated_monthly_cost: voidPeriod.estimatedMonthlyCost || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['void-periods'] });
      toast({ title: 'Void period recorded' });
    },
  });
}

export function useUpdateVoidPeriod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<VoidPeriod> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('void_periods')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['void-periods'] });
      toast({ title: 'Void period updated' });
    },
  });
}

export function useEndVoidPeriod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, endDate }: { id: string; endDate: string }) => {
      const { data, error } = await supabaseAny
        .from('void_periods')
        .update({ end_date: endDate })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['void-periods'] });
      toast({ title: 'Void period ended' });
    },
  });
}

export function useDeleteVoidPeriod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('void_periods').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['void-periods'] });
      toast({ title: 'Void period deleted' });
    },
  });
}
