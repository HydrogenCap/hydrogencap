import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

export type VoidReason = 'between_tenants' | 'refurbishment' | 'sale_preparation' | 'legal_dispute' | 'other';

export interface VoidPeriod {
  id: string;
  property_id: string;
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
      let query = supabase
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

export function useActiveVoids() {
  return useQuery({
    queryKey: ['void-periods', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('void_periods')
        .select('*, property:properties(address_line, postcode)')
        .is('end_date', null)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data as (VoidPeriod & { property: { address_line: string; postcode: string } })[];
    },
  });
}

export function useVoidStats() {
  const { data: allVoids } = useVoidPeriods();

  if (!allVoids) return null;

  const activeVoids = allVoids.filter(v => !v.end_date);
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

  const totalMonthlyCost = activeVoids.reduce(
    (sum, v) => sum + (v.estimated_monthly_cost || 0), 0
  );

  return {
    activeCount: activeVoids.length,
    totalCompleted: completedVoids.length,
    averageDays: avgDays,
    totalMonthlyCost,
  };
}

export function useCreateVoidPeriod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (voidPeriod: {
      propertyId: string;
      startDate: string;
      endDate?: string;
      reason?: VoidReason;
      reasonNotes?: string;
      estimatedMonthlyCost?: number;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase
        .from('void_periods')
        .insert({
          org_id: orgId,
          property_id: voidPeriod.propertyId,
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
      const { data, error } = await supabase
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
