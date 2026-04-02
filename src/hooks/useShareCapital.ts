import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ShareClassV2 {
  id: string;
  entity_id: string;
  class_name: string;
  issued_shares: number;
  nominal_value: number | null;
  currency: string;
  voting_rights: boolean;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareClassWithAllocation extends ShareClassV2 {
  allocated_shares: number;
  unallocated_shares: number;
  allocation_percent: number;
  is_fully_allocated: boolean;
}

interface ShareholderAllocation {
  share_class_id: string | null;
  shares_held: number;
}

export function useShareClasses(entityId: string | undefined) {
  return useQuery({
    queryKey: ['share_classes_v2', entityId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('share_classes_v2')
        .select('*')
        .eq('entity_id', entityId!)
        .order('is_primary', { ascending: false })
        .order('class_name');
      if (error) throw error;
      return data as ShareClassV2[];
    },
    enabled: !!entityId,
  });
}

export function useShareClassesWithAllocation(entityId: string | undefined) {
  const { data: shareClasses, isLoading: classesLoading } = useShareClasses(entityId);
  const { data: shareholders, isLoading: shLoading } = useQuery({
    queryKey: ['entity_shareholders', entityId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('entity_shareholders')
        .select('*')
        .eq('entity_id', entityId!)
        .is('effective_to', null);
      if (error) throw error;
      return data;
    },
    enabled: !!entityId,
  });

  const enriched: ShareClassWithAllocation[] = (shareClasses || []).map(sc => {
    const classHoldings = ((shareholders || []) as ShareholderAllocation[]).filter(
      (shareholding) => shareholding.share_class_id === sc.id
    );
    const allocated = classHoldings.reduce((sum, shareholding) => sum + shareholding.shares_held, 0);
    return {
      ...sc,
      allocated_shares: allocated,
      unallocated_shares: sc.issued_shares - allocated,
      allocation_percent: sc.issued_shares > 0 ? (allocated / sc.issued_shares) * 100 : 0,
      is_fully_allocated: allocated === sc.issued_shares,
    };
  });

  return {
    data: enriched,
    isLoading: classesLoading || shLoading,
  };
}

export function useCreateShareClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shareClass: {
      entity_id: string;
      class_name: string;
      issued_shares: number;
      nominal_value?: number | null;
      voting_rights?: boolean;
      is_primary?: boolean;
    }) => {
      const { data, error } = await (supabase as any)
        .from('share_classes_v2')
        .insert(shareClass)
        .select()
        .single();
      if (error) throw error;
      return data as ShareClassV2;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['share_classes_v2', data.entity_id] });
    },
  });
}

export function useUpdateShareClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ShareClassV2> & { id: string; entity_id: string }) => {
      const { data, error } = await (supabase as any)
        .from('share_classes_v2')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ShareClassV2;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['share_classes_v2', data.entity_id] });
      queryClient.invalidateQueries({ queryKey: ['entity_shareholders', data.entity_id] });
    },
  });
}

export function useDeleteShareClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entityId }: { id: string; entityId: string }) => {
      const { error } = await (supabase as any)
        .from('share_classes_v2')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return entityId;
    },
    onSuccess: (entityId) => {
      queryClient.invalidateQueries({ queryKey: ['share_classes_v2', entityId] });
    },
  });
}

export function validateShareIntegrity(
  shareClasses: ShareClassWithAllocation[]
): { classId: string; className: string; issued: number; allocated: number; error: string }[] {
  const errors: { classId: string; className: string; issued: number; allocated: number; error: string }[] = [];
  for (const sc of shareClasses) {
    if (sc.allocated_shares > sc.issued_shares) {
      errors.push({
        classId: sc.id,
        className: sc.class_name,
        issued: sc.issued_shares,
        allocated: sc.allocated_shares,
        error: `${sc.class_name}: ${sc.allocated_shares} shares allocated but only ${sc.issued_shares} issued (over-allocated by ${sc.allocated_shares - sc.issued_shares})`,
      });
    }
  }
  return errors;
}
