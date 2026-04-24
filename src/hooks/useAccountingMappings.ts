import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useOrganization } from '@/hooks/useOrganization';
import type { AccountingMapping, AccountingSystem } from '@/lib/accountingTypes';

type AccountingMappingInsert = Database['public']['Tables']['accounting_mappings']['Insert'];
type AccountingMappingUpdate = Database['public']['Tables']['accounting_mappings']['Update'];

export function useAccountingMappings(system?: AccountingSystem, entityId?: string | null) {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['accounting_mappings', org?.id, system, entityId],
    queryFn: async () => {
      let query = supabaseAny
        .from('accounting_mappings')
        .select('*')
        .eq('is_active', true);

      if (system) query = query.eq('accounting_system', system);

      // Get org-specific + global (null org_id) mappings
      if (org?.id) {
        query = query.or(`org_id.eq.${org.id},org_id.is.null`);
      } else {
        query = query.is('org_id', null);
      }

      // Entity-specific or generic (null entity_id)
      if (entityId) {
        query = query.or(`entity_id.eq.${entityId},entity_id.is.null`);
      } else {
        query = query.is('entity_id', null);
      }

      query = query.order('hydrogencap_category');
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AccountingMapping[];
    },
    enabled: true,
  });
}

export function useUpsertMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: AccountingMappingInsert) => {
      const { data, error } = await supabaseAny
        .from('accounting_mappings')
        .upsert(mapping, { onConflict: 'accounting_system,entity_id,hydrogencap_category' })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AccountingMapping;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting_mappings'] });
    },
  });
}

export function useUpdateMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: AccountingMappingUpdate & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('accounting_mappings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AccountingMapping;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting_mappings'] });
    },
  });
}
