import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId, useUserOrg } from '@/hooks/useUserOrg';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───

export interface ActionSnooze {
  id: string;
  org_id: string;
  action_type: string;
  action_key: string;
  snoozed_until: string;
  reason: string | null;
  snoozed_by: string;
  created_at: string;
}

export interface ActionAssignment {
  id: string;
  org_id: string;
  action_type: string;
  action_key: string;
  assigned_to_user_id: string | null;
  assigned_to_contractor_id: string | null;
  assigned_by: string;
  created_at: string;
}

export interface SnoozeInput {
  actionType: string;
  actionKey: string;
  snoozedUntil: string; // ISO date string
  reason: string;
}

export interface AssignInput {
  actionType: string;
  actionKey: string;
  assignedToUserId?: string;
  assignedToContractorId?: string;
}

// ─── Queries ───

export function useSnoozedActions() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['action-snoozes', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('action_snoozes')
        .select('*')
        .eq('org_id', orgId!)
        .gte('snoozed_until', new Date().toISOString());

      if (error) throw error;
      return (data ?? []) as ActionSnooze[];
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

export function useActionAssignments() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['action-assignments', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('action_assignments')
        .select('*')
        .eq('org_id', orgId!);

      if (error) throw error;
      return (data ?? []) as ActionAssignment[];
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

// ─── Mutations ───

export function useSnoozeAction() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: SnoozeInput) => {
      const orgId = await fetchUserOrgId();

      const { data, error } = await supabaseAny
        .from('action_snoozes')
        .insert({
          org_id: orgId,
          action_type: input.actionType,
          action_key: input.actionKey,
          snoozed_until: input.snoozedUntil,
          reason: input.reason,
          snoozed_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['action-snoozes'] });
      toast({ title: 'Action snoozed' });
    },
    onError: (e) => {
      toast({ title: 'Failed to snooze action', description: e.message, variant: 'destructive' });
    },
  });
}

export function useUnsnoozeAction() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (snoozeId: string) => {
      const { error } = await supabaseAny
        .from('action_snoozes')
        .delete()
        .eq('id', snoozeId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['action-snoozes'] });
      toast({ title: 'Snooze removed' });
    },
    onError: (e) => {
      toast({ title: 'Failed to remove snooze', description: e.message, variant: 'destructive' });
    },
  });
}

export function useAssignAction() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: AssignInput) => {
      const orgId = await fetchUserOrgId();

      const { data, error } = await supabaseAny
        .from('action_assignments')
        .insert({
          org_id: orgId,
          action_type: input.actionType,
          action_key: input.actionKey,
          assigned_to_user_id: input.assignedToUserId ?? null,
          assigned_to_contractor_id: input.assignedToContractorId ?? null,
          assigned_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['action-assignments'] });
      toast({ title: 'Action assigned' });
    },
    onError: (e) => {
      toast({ title: 'Failed to assign action', description: e.message, variant: 'destructive' });
    },
  });
}

export function useUnassignAction() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabaseAny
        .from('action_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['action-assignments'] });
      toast({ title: 'Assignment removed' });
    },
    onError: (e) => {
      toast({ title: 'Failed to remove assignment', description: e.message, variant: 'destructive' });
    },
  });
}

// ─── Helper: build a composite key for looking up snoozes/assignments ───

export function getActionKey(riskId: string): { actionType: string; actionKey: string } {
  // Risk IDs are in the form "type-propertyId" or "type-subtype-propertyId"
  const firstDash = riskId.indexOf('-');
  if (firstDash === -1) return { actionType: riskId, actionKey: riskId };

  const actionType = riskId.slice(0, firstDash);
  const actionKey = riskId;
  return { actionType, actionKey };
}

// ─── Lookup helpers ───

export function isSnoozed(
  riskId: string,
  snoozes: ActionSnooze[]
): ActionSnooze | undefined {
  const { actionType, actionKey } = getActionKey(riskId);
  return snoozes.find(
    s => s.action_type === actionType && s.action_key === actionKey
  );
}

export function getAssignment(
  riskId: string,
  assignments: ActionAssignment[]
): ActionAssignment | undefined {
  const { actionType, actionKey } = getActionKey(riskId);
  return assignments.find(
    a => a.action_type === actionType && a.action_key === actionKey
  );
}
