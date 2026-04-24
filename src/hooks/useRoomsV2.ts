import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';

export interface RoomV2 {
  id: string;
  property_id: string;
  room_name: string;
  room_type: 'single' | 'double' | 'ensuite' | 'studio' | 'bedsit' | 'communal';
  floor: number | null;
  has_ensuite: boolean;
  is_lettable: boolean;
  current_rent_pcm: number | null;
  target_rent_pcm: number | null;
  occupancy_status: 'occupied' | 'vacant' | 'under_offer' | 'unavailable' | 'refurbishment';
  notes: string | null;
  size_sqm: number | null;
  occupancy_type: 'single' | 'double' | 'child' | null;
  amenity_type: 'bedroom' | 'bathroom' | 'kitchen' | 'toilet' | 'common' | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyRoomSummary {
  property_id: string;
  total_lettable: number;
  total_occupied: number;
  gross_rent_pcm: number;
  potential_rent_pcm: number;
}

export const ROOM_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'ensuite', label: 'En-suite' },
  { value: 'studio', label: 'Studio' },
  { value: 'bedsit', label: 'Bedsit' },
  { value: 'communal', label: 'Communal' },
] as const;

export const OCCUPANCY_STATUSES = [
  { value: 'occupied', label: 'Occupied' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'under_offer', label: 'Under Offer' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'refurbishment', label: 'Refurbishment' },
] as const;

export function usePropertyRooms(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['rooms_v2', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabaseAny
        .from('rooms_v2')
        .select('*')
        .eq('property_id', propertyId)
        .order('room_name');
      if (error) throw error;
      return data as RoomV2[];
    },
    enabled: !!propertyId,
  });
}

export function useRoom(id: string | undefined) {
  return useQuery({
    queryKey: ['room_v2', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabaseAny
        .from('rooms_v2')
        .select('*, properties_v2!inner(address_line_1, city, postcode)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as (RoomV2 & { properties_v2: { address_line_1: string; city: string; postcode: string } }) | null;
    },
    enabled: !!id,
  });
}

export function usePropertyRoomSummaries() {
  return useQuery({
    queryKey: ['property_room_summary_v2'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('property_room_summary_v2')
        .select('*');
      if (error) throw error;
      const map = new Map<string, PropertyRoomSummary>();
      (data || []).forEach((summary) => map.set(summary.property_id, summary as PropertyRoomSummary));
      return map;
    },
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (room: Omit<RoomV2, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('rooms_v2').insert(room).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['rooms_v2', data.property_id] });
      qc.invalidateQueries({ queryKey: ['property_room_summary_v2'] });
    },
  });
}

export function useBulkCreateRooms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rooms: Omit<RoomV2, 'id' | 'created_at' | 'updated_at'>[]) => {
      const { data, error } = await supabase.from('rooms_v2').insert(rooms).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      const propertyId = variables[0]?.property_id;
      if (propertyId) {
        qc.invalidateQueries({ queryKey: ['rooms_v2', propertyId] });
      }
      qc.invalidateQueries({ queryKey: ['property_room_summary_v2'] });
    },
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...room }: Partial<RoomV2> & { id: string }) => {
      const { data, error } = await supabase.from('rooms_v2').update(room).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['rooms_v2', data.property_id] });
      qc.invalidateQueries({ queryKey: ['room_v2', data.id] });
      qc.invalidateQueries({ queryKey: ['property_room_summary_v2'] });
    },
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabase.from('rooms_v2').delete().eq('id', id);
      if (error) throw error;
      return propertyId;
    },
    onSuccess: (propertyId) => {
      qc.invalidateQueries({ queryKey: ['rooms_v2', propertyId] });
      qc.invalidateQueries({ queryKey: ['property_room_summary_v2'] });
    },
  });
}
