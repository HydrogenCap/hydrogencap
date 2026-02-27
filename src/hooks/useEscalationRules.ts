import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EscalationRule {
  id: string;
  org_id: string | null;
  document_type: string | null;
  rule_name: string;
  trigger_condition: string;
  trigger_value: number;
  action_type: string;
  action_config: Record<string, unknown> | null;
  escalation_level: number;
  is_active: boolean;
  created_at: string;
}

export function useEscalationRules() {
  return useQuery({
    queryKey: ['escalation-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escalation_rules')
        .select('*')
        .order('trigger_value', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EscalationRule[];
    },
  });
}

export function useCreateEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Partial<EscalationRule>) => {
      const { error } = await supabase.from('escalation_rules').insert(rule as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation-rules'] }),
  });
}

export function useUpdateEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EscalationRule> }) => {
      const { error } = await supabase.from('escalation_rules').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation-rules'] }),
  });
}

export function useDeleteEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('escalation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation-rules'] }),
  });
}
