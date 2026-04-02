import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  org_id: string;
  user_id: string;
  category: 'compliance' | 'rent' | 'maintenance' | 'tenancy' | 'system';
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  link_to: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

export function useNotifications(filter?: { category?: string; unreadOnly?: boolean; page?: number }) {
  const page = filter?.page ?? 0;
  return useQuery({
    queryKey: ['notifications', filter],
    queryFn: async () => {
      let query = (supabase as any)
        .from('notifications')
        .select('*')
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filter?.category && filter.category !== 'all') {
        query = query.eq('category', filter.category);
      }
      if (filter?.unreadOnly) {
        query = query.is('read_at', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Notification[];
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
        .is('dismissed_at', null);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 60000,
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDismissAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .not('read_at', 'is', null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
