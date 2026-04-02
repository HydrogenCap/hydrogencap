import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import type { ComplianceNotification } from '@/lib/complianceTaskTypes';

export function useUnreadNotifications() {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['compliance-notifications', 'unread', org?.id],
    enabled: !!org?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('unread_notifications_v2')
        .select('*')
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as ComplianceNotification[];
    },
  });
}

export function useAllNotifications(filters?: { status?: string; type?: string }) {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['compliance-notifications', 'all', org?.id, filters],
    enabled: !!org?.id,
    queryFn: async () => {
      let q = supabase.from('compliance_notifications').select('*').order('sent_at', { ascending: false }).limit(100);
      if (filters?.status === 'unread') q = q.is('read_at', null).in('status', ['sent', 'delivered']);
      if (filters?.type) q = q.eq('notification_type', filters.type);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ComplianceNotification[];
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('compliance_notifications')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-notifications'] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  const { data: org } = useOrganization();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('compliance_notifications')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('org_id', org!.id)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-notifications'] }),
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('compliance_notifications')
        .update({ status: 'dismissed' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-notifications'] }),
  });
}
