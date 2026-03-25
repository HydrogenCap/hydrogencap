import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useOrganization } from '@/hooks/useOrganization';
import type { ComplianceTaskOverview, ComplianceScanResult, TaskStatus, TaskPriority } from '@/lib/complianceTaskTypes';

type ComplianceTaskInsert = Database['public']['Tables']['compliance_tasks']['Insert'];

export function useComplianceTasks() {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['compliance-tasks', org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_task_overview')
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as ComplianceTaskOverview[];
    },
  });
}

export function useComplianceTaskStats() {
  const { data: tasks } = useComplianceTasks();
  const active = tasks?.filter(t => !['completed', 'cancelled'].includes(t.status)) || [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  return {
    openCount: active.filter(t => ['open', 'in_progress', 'waiting'].includes(t.status)).length,
    overdueCount: active.filter(t => t.is_overdue).length,
    criticalCount: active.filter(t => t.priority === 'critical').length,
    completedThisMonth: tasks?.filter(t => t.status === 'completed' && t.resolved_at && t.resolved_at >= monthStart).length || 0,
  };
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: TaskStatus; notes?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'completed') {
        updates.resolved_at = new Date().toISOString();
        if (notes) updates.resolution_notes = notes;
      }
      const { error } = await supabase.from('compliance_tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-tasks'] }),
  });
}

export function useUpdateTaskPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: TaskPriority }) => {
      const { error } = await supabase.from('compliance_tasks').update({ priority }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('compliance_tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-tasks'] }),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { data: org } = useOrganization();
  return useMutation({
    mutationFn: async (task: Partial<ComplianceTaskInsert>) => {
      const { error } = await supabase.from('compliance_tasks').insert([{ ...task, org_id: org!.id, source: 'manual' }] as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-tasks'] }),
  });
}

export function useRunComplianceScan() {
  const qc = useQueryClient();
  const { data: org } = useOrganization();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('run_compliance_scan', { p_org_id: org!.id });
      if (error) throw error;
      return data as unknown as ComplianceScanResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-tasks'] });
      qc.invalidateQueries({ queryKey: ['compliance-notifications'] });
    },
  });
}
