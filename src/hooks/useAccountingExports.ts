import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import type { AccountingExport } from '@/lib/accountingTypes';

export function useAccountingExports(entityId?: string, limit = 20) {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['accounting_exports', org?.id, entityId, limit],
    queryFn: async () => {
      let query = supabase
        .from('accounting_exports')
        .select('*')
        .eq('org_id', org!.id)
        .order('generated_at', { ascending: false })
        .limit(limit);
      if (entityId) query = query.eq('entity_id', entityId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AccountingExport[];
    },
    enabled: !!org?.id,
  });
}

export function useCreateExportRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: Omit<AccountingExport, 'id' | 'generated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('accounting_exports')
        .insert({ ...record, generated_by: user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AccountingExport;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting_exports'] });
    },
  });
}
