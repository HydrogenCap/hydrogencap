import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeFunction } from '@/hooks/useEdgeFunction';

export interface RegulatoryAlert {
  id: string;
  org_id: string;
  title: string;
  category: string;
  severity: string;
  summary: string;
  details: string | null;
  source_url: string | null;
  effective_date: string | null;
  affects_property_types: string[] | null;
  recommended_actions: unknown;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  dismissed: boolean;
  created_at: string;
}

export function useRegulatoryAlerts() {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['regulatory-alerts', org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('regulatory_alerts')
        .select('*')
        .eq('org_id', org!.id)
        .order('severity', { ascending: true }) // critical first (alphabetical: critical < info < warning)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Re-sort by severity weight since alphabetical doesn't give correct order
      const severityWeight: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      return ((data || []) as unknown as RegulatoryAlert[]).sort(
        (a, b) => (severityWeight[a.severity] ?? 3) - (severityWeight[b.severity] ?? 3)
      );
    },
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase as any)
        .from('regulatory_alerts')
        .update({
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regulatory-alerts'] });
      toast({ title: 'Alert acknowledged' });
    },
    onError: (error: Error) =>
      toast({ title: 'Failed to acknowledge alert', description: error.message, variant: 'destructive' }),
  });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await (supabase as any)
        .from('regulatory_alerts')
        .update({ dismissed: true })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regulatory-alerts'] });
      toast({ title: 'Alert dismissed' });
    },
    onError: (error: Error) =>
      toast({ title: 'Failed to dismiss alert', description: error.message, variant: 'destructive' }),
  });
}

export function useCheckRegChanges() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      return invokeEdgeFunction<{ success: boolean; alertsInserted: number }>(
        'check-regulatory-changes',
        {}
      );
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['regulatory-alerts'] });
      toast({
        title: 'Regulatory check complete',
        description: data.alertsInserted > 0
          ? `Found ${data.alertsInserted} new alert${data.alertsInserted === 1 ? '' : 's'}`
          : 'No new regulatory changes found',
      });
    },
    onError: (error: Error) =>
      toast({ title: 'Regulatory check failed', description: error.message, variant: 'destructive' }),
  });
}
