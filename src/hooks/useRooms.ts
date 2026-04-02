 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
 import { useToast } from '@/hooks/use-toast';
 
 export type RoomStatus = 'vacant' | 'occupied' | 'notice' | 'maintenance';
 export type RoomType = 'single' | 'double' | 'ensuite' | 'studio';
 
 export interface Room {
   id: string;
   org_id: string;
   property_id: string;
   room_name: string;
   room_number: string | null;
   floor: number;
   room_type: RoomType;
   target_rent_pcm: number | null;
   status: RoomStatus;
   description: string | null;
   amenities: string[] | null;
   square_footage: number | null;
   photos: string[] | null;
   created_at: string;
   updated_at: string;
 }
 
 export interface RoomWithTenancy extends Room {
   current_tenant?: {
     id: string;
     first_name: string;
     last_name: string;
   } | null;
   current_tenancy?: {
     id: string;
     rent_amount_pcm: number;
     start_date: string;
     end_date: string | null;
   } | null;
 }
 
// getUserOrgId replaced by shared import
 
 export function useRooms(propertyId?: string) {
   return useQuery({
     queryKey: ['rooms', propertyId],
     queryFn: async () => {
       let query = (supabase as any)
         .from('rooms')
         .select('*')
         .order('floor', { ascending: true })
         .order('room_name', { ascending: true });
 
       if (propertyId) {
         query = query.eq('property_id', propertyId);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as Room[];
     },
   });
 }
 
 export function useRoomsWithTenancy(propertyId: string) {
   return useQuery({
     queryKey: ['rooms', 'with-tenancy', propertyId],
     queryFn: async () => {
       // Get rooms
       const { data: rooms, error: roomsError } = await (supabase as any)
         .from('rooms')
         .select('*')
         .eq('property_id', propertyId)
         .order('floor', { ascending: true })
         .order('room_name', { ascending: true });
 
       if (roomsError) throw roomsError;
 
       // Get active tenancies for these rooms
       const roomIds = rooms.map(r => r.id);
       const { data: tenancies, error: tenanciesError } = await (supabase as any)
         .from('tenancies')
         .select(`
           id, room_id, rent_amount_pcm, start_date, end_date,
           tenant:tenants(id, first_name, last_name)
         `)
         .in('room_id', roomIds)
         .eq('status', 'active');
 
       if (tenanciesError) throw tenanciesError;
 
       // Map tenancies to rooms
       const tenancyMap = new Map((tenancies as any[]).map((t: any) => [t.room_id, t]));
 
       return rooms.map(room => ({
         ...room,
         current_tenancy: tenancyMap.get(room.id) ? {
           id: tenancyMap.get(room.id)!.id,
           rent_amount_pcm: tenancyMap.get(room.id)!.rent_amount_pcm,
           start_date: tenancyMap.get(room.id)!.start_date,
           end_date: tenancyMap.get(room.id)!.end_date,
         } : null,
         current_tenant: tenancyMap.get(room.id)?.tenant || null,
       })) as RoomWithTenancy[];
     },
     enabled: !!propertyId,
   });
 }
 
 export function useRoom(roomId: string) {
   return useQuery({
     queryKey: ['rooms', roomId],
     queryFn: async () => {
       const { data, error } = await (supabase as any)
         .from('rooms')
         .select('*')
         .eq('id', roomId)
         .single();
       if (error) throw error;
       return data as Room;
     },
     enabled: !!roomId,
   });
 }
 
 export function useCreateRoom() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (room: Omit<Room, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
       const orgId = await getUserOrgId();
       if (!orgId) throw new Error('No organization found');
 
       const { data, error } = await (supabase as any)
         .from('rooms')
         .insert({ ...room, org_id: orgId })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ['rooms'] });
       queryClient.invalidateQueries({ queryKey: ['unit-usage-count'] });
       toast({ title: 'Room created', description: `${data.room_name} has been added.` });
     },
     onError: (error) => {
       toast({ title: 'Failed to create room', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useUpdateRoom() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ id, ...updates }: Partial<Room> & { id: string }) => {
       const { data, error } = await (supabase as any)
         .from('rooms')
         .update(updates)
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['rooms'] });
       toast({ title: 'Room updated' });
     },
     onError: (error) => {
       toast({ title: 'Failed to update room', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useDeleteRoom() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase.from('rooms').delete().eq('id', id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['rooms'] });
       queryClient.invalidateQueries({ queryKey: ['unit-usage-count'] });
       toast({ title: 'Room deleted' });
     },
     onError: (error) => {
       toast({ title: 'Failed to delete room', description: error.message, variant: 'destructive' });
     },
   });
 }
 
 export function useRoomStats(propertyId?: string) {
   const { data: rooms } = useRooms(propertyId);
 
   if (!rooms) return null;
 
   return {
     total: rooms.length,
     vacant: rooms.filter(r => r.status === 'vacant').length,
     occupied: rooms.filter(r => r.status === 'occupied').length,
     notice: rooms.filter(r => r.status === 'notice').length,
     maintenance: rooms.filter(r => r.status === 'maintenance').length,
     occupancyRate: rooms.length > 0 
       ? Math.round((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100) 
       : 0,
   };
 }