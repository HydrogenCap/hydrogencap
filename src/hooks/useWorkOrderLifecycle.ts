import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────

export type PipelineStage =
  | 'raised'
  | 'pending_approval'
  | 'approved'
  | 'contractor_assigned'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'signed_off';

export interface WorkOrderMaterial {
  id: string;
  work_order_id: string;
  org_id: string;
  material_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  supplier: string | null;
  receipt_url: string | null;
  purchased_at: string | null;
  created_at: string;
}

export interface WorkOrderWarranty {
  id: string;
  work_order_id: string;
  property_id: string | null;
  org_id: string;
  description: string;
  warranty_provider: string | null;
  warranty_start: string;
  warranty_end: string;
  terms: string | null;
  document_url: string | null;
  created_at: string;
}

export const PIPELINE_STAGES: { value: PipelineStage; label: string; statusMap: string }[] = [
  { value: 'raised', label: 'Raised', statusMap: 'draft' },
  { value: 'pending_approval', label: 'Pending Approval', statusMap: 'submitted' },
  { value: 'approved', label: 'Approved', statusMap: 'approved' },
  { value: 'contractor_assigned', label: 'Contractor Assigned', statusMap: 'approved' },
  { value: 'scheduled', label: 'Scheduled', statusMap: 'approved' },
  { value: 'in_progress', label: 'In Progress', statusMap: 'in_progress' },
  { value: 'completed', label: 'Completed', statusMap: 'completed' },
  { value: 'signed_off', label: 'Signed Off', statusMap: 'closed' },
];

/** Map existing WO status to the pipeline stage */
export function getPipelineStage(wo: {
  status: string;
  jobs?: { status: string; contractor_id: string | null }[];
  target_start_date?: string | null;
}): PipelineStage {
  switch (wo.status) {
    case 'draft': return 'raised';
    case 'submitted': return 'pending_approval';
    case 'rejected': return 'raised';
    case 'approved': {
      const hasContractor = wo.jobs?.some(j => j.contractor_id);
      if (hasContractor && wo.target_start_date) return 'scheduled';
      if (hasContractor) return 'contractor_assigned';
      return 'approved';
    }
    case 'in_progress': return 'in_progress';
    case 'completed': return 'completed';
    case 'invoiced':
    case 'closed': return 'signed_off';
    default: return 'raised';
  }
}

export function getPipelineStageIndex(stage: PipelineStage): number {
  return PIPELINE_STAGES.findIndex(s => s.value === stage);
}

// ─── Advance Work Order ─────────────────────────────────────────────

export function useAdvanceWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, targetStage }: { id: string; targetStage: PipelineStage }) => {
      const stageConfig = PIPELINE_STAGES.find(s => s.value === targetStage);
      if (!stageConfig) throw new Error('Invalid stage');

      const updates: Record<string, unknown> = {
        status: stageConfig.statusMap,
        updated_at: new Date().toISOString(),
      };

      if (targetStage === 'in_progress') {
        updates.actual_start_date = new Date().toISOString().split('T')[0];
      }
      if (targetStage === 'completed') {
        updates.actual_completion_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabaseAny
        .from('work_orders')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['work_order', id] });
      qc.invalidateQueries({ queryKey: ['work_orders'] });
      qc.invalidateQueries({ queryKey: ['work_order_counts'] });
      toast.success('Work order advanced');
    },
    onError: (e: Error) => toast.error('Failed', { description: e.message }),
  });
}

// ─── Approve with lifecycle fields ──────────────────────────────────

export function useApproveWorkOrderLifecycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approvedBudget }: { id: string; approvedBudget: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: Record<string, unknown> = {
        status: 'approved',
        approval_status: 'approved',
        approved_budget: approvedBudget,
        approved_by: user?.id || null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseAny
        .from('work_orders')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['work_order', id] });
      qc.invalidateQueries({ queryKey: ['work_orders'] });
      qc.invalidateQueries({ queryKey: ['work_order_counts'] });
      qc.invalidateQueries({ queryKey: ['pending_approvals'] });
      toast.success('Work order approved');
    },
    onError: (e: Error) => toast.error('Failed', { description: e.message }),
  });
}

// ─── Reject with lifecycle fields ───────────────────────────────────

export function useRejectWorkOrderLifecycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const updates: Record<string, unknown> = {
        status: 'rejected',
        approval_status: 'rejected',
        rejected_reason: reason,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseAny
        .from('work_orders')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['work_order', id] });
      qc.invalidateQueries({ queryKey: ['work_orders'] });
      qc.invalidateQueries({ queryKey: ['work_order_counts'] });
      qc.invalidateQueries({ queryKey: ['pending_approvals'] });
      toast.success('Work order rejected');
    },
    onError: (e: Error) => toast.error('Failed', { description: e.message }),
  });
}

// ─── Pending Approvals ──────────────────────────────────────────────

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['pending_approvals'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('work_orders')
        .select(`
          *,
          entity:legal_entities(id, entity_name),
          property:properties_v2(id, address_line_1, city, postcode)
        `)
        .eq('status', 'submitted')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Materials ──────────────────────────────────────────────────────

export function useWorkOrderMaterials(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['work_order_materials', workOrderId],
    queryFn: async () => {
      if (!workOrderId) return [];
      const { data, error } = await supabaseAny
        .from('work_order_materials')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as WorkOrderMaterial[];
    },
    enabled: !!workOrderId,
  });
}

export function useAddMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      work_order_id: string;
      material_name: string;
      quantity: number;
      unit_cost: number;
      supplier?: string;
      receipt_url?: string;
      purchased_at?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabaseAny
        .from('work_order_materials')
        .insert({
          ...input,
          org_id: orgId,
          supplier: input.supplier || null,
          receipt_url: input.receipt_url || null,
          purchased_at: input.purchased_at || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkOrderMaterial;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['work_order_materials', vars.work_order_id] });
      toast.success('Material added');
    },
    onError: (e: Error) => toast.error('Failed', { description: e.message }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, workOrderId }: { id: string; workOrderId: string }) => {
      const { error } = await supabaseAny
        .from('work_order_materials')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { workOrderId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['work_order_materials', result.workOrderId] });
    },
  });
}

// ─── Warranties ─────────────────────────────────────────────────────

export function useWorkOrderWarranties(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['work_order_warranties', workOrderId],
    queryFn: async () => {
      if (!workOrderId) return [];
      const { data, error } = await supabaseAny
        .from('work_order_warranties')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as WorkOrderWarranty[];
    },
    enabled: !!workOrderId,
  });
}

export function useCreateWarranty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      work_order_id: string;
      property_id?: string;
      description: string;
      warranty_provider?: string;
      warranty_start: string;
      warranty_end: string;
      terms?: string;
      document_url?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabaseAny
        .from('work_order_warranties')
        .insert({
          ...input,
          org_id: orgId,
          property_id: input.property_id || null,
          warranty_provider: input.warranty_provider || null,
          terms: input.terms || null,
          document_url: input.document_url || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkOrderWarranty;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['work_order_warranties', vars.work_order_id] });
      qc.invalidateQueries({ queryKey: ['expiring_warranties'] });
      toast.success('Warranty recorded');
    },
    onError: (e: Error) => toast.error('Failed', { description: e.message }),
  });
}

export function useDeleteWarranty() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, workOrderId }: { id: string; workOrderId: string }) => {
      const { error } = await supabaseAny
        .from('work_order_warranties')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { workOrderId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['work_order_warranties', result.workOrderId] });
      qc.invalidateQueries({ queryKey: ['expiring_warranties'] });
    },
  });
}

export function useExpiringWarranties(daysAhead: number = 90) {
  return useQuery({
    queryKey: ['expiring_warranties', daysAhead],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const { data, error } = await supabaseAny
        .from('work_order_warranties')
        .select(`
          *,
          work_order:work_orders(id, wo_number, title),
          property:properties_v2(id, address_line_1, city)
        `)
        .gte('warranty_end', new Date().toISOString().split('T')[0])
        .lte('warranty_end', futureDate.toISOString().split('T')[0])
        .order('warranty_end', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAllActiveWarranties() {
  return useQuery({
    queryKey: ['active_warranties'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('work_order_warranties')
        .select(`
          *,
          work_order:work_orders(id, wo_number, title),
          property:properties_v2(id, address_line_1, city)
        `)
        .gte('warranty_end', new Date().toISOString().split('T')[0])
        .order('warranty_end', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}
