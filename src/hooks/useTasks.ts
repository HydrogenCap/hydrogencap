import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId, useUserOrg } from '@/hooks/useUserOrg';
import { useAuth } from '@/contexts/AuthContext';

export interface Task {
  id: string;
  org_id: string;
  property_id: string | null;
  entity_id: string | null;
  compliance_requirement_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  source: string;
  source_wizard_id: string | null;
  completed_at: string | null;
  dismissed_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function useTasks(filters?: { status?: string; propertyId?: string; entityId?: string }) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['tasks', orgId, filters],
    queryFn: async () => {
      let query = supabaseAny
        .from('tasks')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters?.entityId) {
        query = query.eq('entity_id', filters.entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!orgId,
  });
}

export function useTaskCounts() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['task-counts', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('tasks')
        .select('status')
        .eq('org_id', orgId)
        .in('status', ['open', 'in_progress']);

      if (error) throw error;
      return {
        open: data?.filter((t) => t.status === 'open').length || 0,
        in_progress: data?.filter((t) => t.status === 'in_progress').length || 0,
        total: data?.length || 0,
      };
    },
    enabled: !!orgId,
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: Partial<Pick<Task, 'status' | 'priority' | 'due_date' | 'dismissed_reason' | 'completed_at'>>;
    }) => {
      const { error } = await supabaseAny
        .from('tasks')
        .update(updates)
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-counts'] });
    },
  });
}

export function useCreateTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      tasks: Array<{
        title: string;
        category: string;
        priority: string;
        due_date?: string;
        description?: string;
        property_id?: string;
        entity_id?: string;
        compliance_requirement_id?: string;
        source?: string;
        source_wizard_id?: string;
      }>
    ) => {
      const orgId = await fetchUserOrgId();
      const rows = tasks.map((t) => ({
        ...t,
        org_id: orgId,
        created_by: user!.id,
        source: t.source || 'wizard',
        status: 'open',
      }));

      const { error } = await supabase.from('tasks').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-counts'] });
    },
  });
}
