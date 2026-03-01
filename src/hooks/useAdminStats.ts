import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function adminAction(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('admin-stats', {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminAction('dashboard'),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminUsers(params: {
  search?: string;
  tierFilter?: string;
  statusFilter?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminAction('users', params),
    staleTime: 60 * 1000,
  });
}

export function useGrantTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; days?: number }) =>
      adminAction('grant_trial', params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; newTier: string }) =>
      adminAction('change_plan', params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
