import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import type { ComplianceTaskOverview, ComplianceScanResult, TaskStatus, TaskPriority, TaskType } from '@/lib/complianceTaskTypes';
import { ACTIVE_PIPELINE_STATUSES } from '@/lib/complianceTaskTypes';
import type { AIComplianceRequirement } from '@/hooks/useAIComplianceChecker';

type ComplianceTaskInsert = Database['public']['Tables']['compliance_tasks']['Insert'];
type ComplianceTaskFullUpdate = Database['public']['Tables']['compliance_tasks']['Update'];

export function useComplianceTasks() {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['compliance-tasks', org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data, error } = await supabaseAny
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
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: TaskStatus; notes?: string }) => {
      const updates: ComplianceTaskFullUpdate = { status };
      if (status === 'completed') {
        updates.resolved_at = new Date().toISOString();
        if (notes) updates.resolution_notes = notes;
      }
      const { error } = await supabase.from('compliance_tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-tasks'] }),
    onError: (error: Error) => toast({ title: 'Failed to update task status', description: error.message, variant: 'destructive' }),
  });
}

export function useUpdateTaskPriority() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: TaskPriority }) => {
      const { error } = await supabase.from('compliance_tasks').update({ priority }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-tasks'] }),
    onError: (error: Error) => toast({ title: 'Failed to update task priority', description: error.message, variant: 'destructive' }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ComplianceTaskFullUpdate }) => {
      const { error } = await supabase.from('compliance_tasks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-tasks'] }),
    onError: (error: Error) => toast({ title: 'Failed to update task', description: error.message, variant: 'destructive' }),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { data: org } = useOrganization();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (task: Partial<ComplianceTaskInsert>) => {
      const { error } = await supabase.from('compliance_tasks').insert([{ ...task, org_id: org!.id, source: 'manual' } as ComplianceTaskInsert]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-tasks'] }),
    onError: (error: Error) => toast({ title: 'Failed to create task', description: error.message, variant: 'destructive' }),
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

// ── AI Compliance Checker → Tasks ────────────────────────────

const AI_STATUS_TO_TASK_TYPE: Record<string, TaskType> = {
  missing: 'missing_document',
  expired: 'expired',
  expiring_soon: 'renewal_due',
};

const AI_STATUS_TO_TITLE_VERB: Record<string, string> = {
  missing: 'Upload',
  expired: 'Renew expired',
  expiring_soon: 'Renew',
};

// AIComplianceRequirement.priority is 'high' | 'medium' | 'low'; the task
// table also accepts 'critical'. Pass-through is fine — TaskPriority is a
// strict superset.
const AI_PRIORITY_TO_TASK_PRIORITY: Record<string, TaskPriority> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

function isActionable(req: AIComplianceRequirement): boolean {
  return (
    req.required &&
    (req.status === 'missing' || req.status === 'expired' || req.status === 'expiring_soon')
  );
}

export interface CreateTasksFromAIInput {
  propertyId: string;
  requirements: AIComplianceRequirement[];
}

export interface CreateTasksFromAIResult {
  created: number;
  skipped: number;
  total: number;
}

/**
 * Bulk-creates compliance_tasks rows from an AI compliance analysis.
 *
 * Skips any requirement that already has an active task on the same
 * property + document_type so re-running the AI checker doesn't pile
 * up duplicates.
 */
export function useCreateTasksFromAIAnalysis() {
  const qc = useQueryClient();
  const { data: org } = useOrganization();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ propertyId, requirements }: CreateTasksFromAIInput): Promise<CreateTasksFromAIResult> => {
      if (!org?.id) throw new Error('No organisation in context');

      const candidates = requirements.filter(isActionable);
      if (candidates.length === 0) {
        return { created: 0, skipped: 0, total: 0 };
      }

      // Look up existing active tasks for this property so we can skip
      // duplicates without inserting and relying on a unique constraint.
      const docTypes = candidates.map((r) => r.type);
      const { data: existingRows, error: lookupErr } = await supabaseAny
        .from('compliance_tasks')
        .select('document_type')
        .eq('property_id', propertyId)
        .in('document_type', docTypes)
        .in('status', ACTIVE_PIPELINE_STATUSES);
      if (lookupErr) throw lookupErr;

      const existing = new Set(
        ((existingRows ?? []) as Array<{ document_type: string }>).map((r) => r.document_type)
      );

      const toInsert: ComplianceTaskInsert[] = candidates
        .filter((r) => !existing.has(r.type))
        .map((r) => ({
          org_id: org.id,
          property_id: propertyId,
          document_type: r.type,
          task_type: AI_STATUS_TO_TASK_TYPE[r.status] ?? 'follow_up',
          title: `${AI_STATUS_TO_TITLE_VERB[r.status] ?? 'Action'} ${r.type}`,
          description: r.recommendation || r.reason || null,
          priority: AI_PRIORITY_TO_TASK_PRIORITY[r.priority] ?? 'medium',
          status: 'open',
          source: 'auto',
        }));

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from('compliance_tasks').insert(toInsert);
        if (insertErr) throw insertErr;
      }

      return {
        created: toInsert.length,
        skipped: candidates.length - toInsert.length,
        total: candidates.length,
      };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['compliance-tasks'] });
      if (result.created === 0 && result.skipped > 0) {
        toast({
          title: 'No new tasks created',
          description: `${result.skipped} task${result.skipped === 1 ? ' is' : 's are'} already open for these items.`,
        });
        return;
      }
      const skippedSuffix = result.skipped > 0 ? ` (${result.skipped} already open)` : '';
      toast({
        title: `Created ${result.created} task${result.created === 1 ? '' : 's'}`,
        description: `Find them under Compliance Tasks${skippedSuffix}.`,
      });
    },
    onError: (error: Error) =>
      toast({ title: 'Failed to create tasks', description: error.message, variant: 'destructive' }),
  });
}
