import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

export type LettingsStage =
  | 'marketing'
  | 'viewings'
  | 'referencing'
  | 'offered'
  | 'move_in_prep'
  | 'completed'
  | 'cancelled';

export const STAGE_ORDER: LettingsStage[] = [
  'marketing',
  'viewings',
  'referencing',
  'offered',
  'move_in_prep',
  'completed',
];

export const STAGE_LABELS: Record<LettingsStage, string> = {
  marketing: 'Marketing',
  viewings: 'Viewings',
  referencing: 'Referencing',
  offered: 'Offered',
  move_in_prep: 'Move-in Prep',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const KANBAN_STAGES = STAGE_ORDER.filter(s => s !== 'completed') as LettingsStage[];

export interface LettingsPipelineItem {
  id: string;
  org_id: string;
  property_id: string;
  room_id: string | null;
  void_period_id: string | null;
  stage: LettingsStage;
  listing_date: string | null;
  advertised_rent: number | null;
  marketing_channels: string[] | null;
  listing_urls: string[] | null;
  total_enquiries: number;
  total_viewings: number;
  offered_to_name: string | null;
  offered_to_email: string | null;
  offered_to_phone: string | null;
  offered_rent: number | null;
  offer_date: string | null;
  reference_status: string | null;
  reference_provider: string | null;
  target_move_in: string | null;
  actual_move_in: string | null;
  tenancy_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  property?: { address_line_1: string; postcode: string };
  room?: { room_name: string; current_rent_pcm: number | null } | null;
}

export type LettingsPipelineUpdate = Partial<
  Omit<
    LettingsPipelineItem,
    'id' | 'org_id' | 'property_id' | 'created_at' | 'updated_at' | 'property' | 'room'
  >
>;

export function useLettingsPipeline() {
  return useQuery({
    queryKey: ['lettings-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lettings_pipeline')
        .select('*')
        .neq('stage', 'completed')
        .neq('stage', 'cancelled')
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return [] as LettingsPipelineItem[];

      const propertyIds = [...new Set(data.map(d => d.property_id))];
      const roomIds = [...new Set(data.map(d => d.room_id).filter(Boolean))] as string[];

      const [propsRes, roomsRes] = await Promise.all([
        supabase.from('properties_v2').select('id, address_line_1, postcode').in('id', propertyIds),
        roomIds.length > 0
          ? supabase.from('rooms_v2').select('id, room_name, current_rent_pcm').in('id', roomIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const propMap = new Map((propsRes.data || []).map(p => [p.id, p]));
      const roomMap = new Map((roomsRes.data || []).map(r => [r.id, r]));

      return data.map(d => ({
        ...d,
        stage: d.stage as LettingsStage,
        property: propMap.get(d.property_id) || { address_line_1: 'Unknown', postcode: '' },
        room: d.room_id ? roomMap.get(d.room_id) || null : null,
      })) as LettingsPipelineItem[];
    },
  });
}

export function useCreateLetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      propertyId: string;
      roomId?: string;
      voidPeriodId?: string;
      advertisedRent?: number;
      marketingChannels?: string[];
      listingDate?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase
        .from('lettings_pipeline')
        .insert({
          org_id: orgId,
          property_id: input.propertyId,
          room_id: input.roomId || null,
          void_period_id: input.voidPeriodId || null,
          advertised_rent: input.advertisedRent || null,
          marketing_channels: input.marketingChannels || null,
          listing_date: input.listingDate || new Date().toISOString().slice(0, 10),
          stage: 'marketing',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lettings-pipeline'] });
      toast({ title: 'Letting added to pipeline' });
    },
  });
}

export function useAdvanceStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: LettingsPipelineUpdate }) => {
      const { data, error } = await supabase
        .from('lettings_pipeline')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as LettingsPipelineItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lettings-pipeline'] });
      toast({ title: `Moved to ${STAGE_LABELS[data.stage]}` });
    },
  });
}

export function useCompleteLetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, tenancyId, actualMoveIn, voidPeriodId }: {
      id: string;
      tenancyId?: string;
      actualMoveIn?: string;
      voidPeriodId?: string | null;
    }) => {
      const updates: LettingsPipelineUpdate = {
        stage: 'completed',
        actual_move_in: actualMoveIn || new Date().toISOString().slice(0, 10),
      };
      if (tenancyId) updates.tenancy_id = tenancyId;

      const { error } = await supabase
        .from('lettings_pipeline')
        .update(updates)
        .eq('id', id);
      if (error) throw error;

      // Close linked void period
      if (voidPeriodId) {
        await supabase
          .from('void_periods')
          .update({ end_date: actualMoveIn || new Date().toISOString().slice(0, 10) })
          .eq('id', voidPeriodId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lettings-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['void-periods'] });
      toast({ title: 'Letting completed 🎉' });
    },
  });
}
