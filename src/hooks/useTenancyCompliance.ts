import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type TenancyComplianceUpdate = Database['public']['Tables']['tenancy_compliance_items']['Update'];

export interface TenancyComplianceItem {
  id: string;
  tenancy_id: string;
  org_id: string;
  item_type: string;
  label: string;
  is_required: boolean;
  is_applicable: boolean;
  completed_date: string | null;
  completed_by: string | null;
  document_url: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useTenancyCompliance(tenancyId: string | undefined) {
  return useQuery({
    queryKey: ['tenancy-compliance', tenancyId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('tenancy_compliance_items')
        .select('*')
        .eq('tenancy_id', tenancyId!)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as TenancyComplianceItem[];
    },
    enabled: !!tenancyId,
  });
}

export function useCompleteTenancyComplianceItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ itemId, notes, documentUrl }: { itemId: string; notes?: string; documentUrl?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updatePayload: TenancyComplianceUpdate = {
        completed_date: new Date().toISOString().split('T')[0],
        completed_by: user?.email || 'Unknown',
        notes: notes || null,
        updated_at: new Date().toISOString(),
      };
      if (documentUrl) {
        updatePayload.document_url = documentUrl;
      }
      const { data, error } = await supabaseAny
        .from('tenancy_compliance_items')
        .update(updatePayload)
        .eq('id', itemId)
        .select()
        .single();
      if (error) throw error;
      return data as TenancyComplianceItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance'] });
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance-stats'] });
      toast({ title: 'Item completed', description: data.label });
    },
  });
}

export function useUncompleteTenancyComplianceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabaseAny
        .from('tenancy_compliance_items')
        .update({
          completed_date: null,
          completed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance'] });
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance-stats'] });
    },
  });
}

export interface TenancyComplianceItemWithDetails extends TenancyComplianceItem {
  tenancy: {
    id: string;
    status: string;
    tenant_id: string;
    property_id: string;
    room_id: string;
    tenant: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      tenant_type: string;
      company_name: string | null;
    };
    property: {
      id: string;
      address_line: string;
    };
    room: {
      id: string;
      room_name: string;
    };
  };
}

export function useTenancyComplianceStats() {
  return useQuery({
    queryKey: ['tenancy-compliance-stats'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('tenancy_compliance_items')
        .select(`
          *,
          tenancy:tenancies!inner(
            id, status, tenant_id, property_id, room_id,
            tenant:tenants(id, first_name, last_name, tenant_type, company_name),
            property:properties(id, address_line),
            room:rooms(id, room_name)
          )
        `)
        .eq('tenancy.status', 'active')
        .eq('is_applicable', true)
        .eq('is_required', true);

      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      const items = (data || []) as TenancyComplianceItemWithDetails[];

      const totalItems = items.length;
      const completedItems = items.filter(i => i.completed_date).length;
      const overdueItems = items.filter(i =>
        !i.completed_date && i.due_date && i.due_date < today
      );
      const upcomingItems = items.filter(i =>
        !i.completed_date && i.due_date && i.due_date >= today
      );

      return {
        totalItems,
        completedItems,
        overdueCount: overdueItems.length,
        overdueItems,
        upcomingItems,
        completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 100,
      };
    },
  });
}
