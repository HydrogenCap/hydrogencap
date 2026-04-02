import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import type { AccountingExport } from '@/lib/accountingTypes';

type AccountingExportInsert = Database['public']['Tables']['accounting_exports']['Insert'];

export function useAccountingExports(entityId?: string, limit = 20) {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['accounting_exports', org?.id, entityId, limit],
    queryFn: async () => {
      let query = (supabase as any)
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
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (record: Omit<AccountingExport, 'id' | 'generated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: AccountingExportInsert = {
        ...record,
        generated_by: user?.id ?? null,
      };
      const { data, error } = await (supabase as any)
        .from('accounting_exports')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AccountingExport;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting_exports'] });
    },
    onError: (error: Error) => toast({ title: 'Failed to save export record', description: error.message, variant: 'destructive' }),
  });
}
