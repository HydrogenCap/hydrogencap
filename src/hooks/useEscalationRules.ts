import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

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

type EscalationRuleInsert = Database['public']['Tables']['escalation_rules']['Insert'];
type EscalationRuleUpdate = Database['public']['Tables']['escalation_rules']['Update'];

export function useEscalationRules() {
  return useQuery({
    queryKey: ['escalation-rules'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
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
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (rule: Partial<EscalationRuleInsert>) => {
      const { error } = await supabase.from('escalation_rules').insert([rule as EscalationRuleInsert]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation-rules'] }),
    onError: (error: Error) => toast({ title: 'Failed to create escalation rule', description: error.message, variant: 'destructive' }),
  });
}

export function useUpdateEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EscalationRuleUpdate> }) => {
      const { error } = await supabase.from('escalation_rules').update(updates).eq('id', id);
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
