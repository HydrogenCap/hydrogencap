import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────

export type WOStatus = 'draft' | 'submitted' | 'approved' | 'rejected' |
  'in_progress' | 'completed' | 'invoiced' | 'closed' | 'cancelled';
export type WOCategory = 'compliance' | 'reactive' | 'planned' | 'improvement' |
  'refurbishment' | 'void_works' | 'emergency' | 'general';
export type WOPriority = 'low' | 'normal' | 'high' | 'urgent';
export type CostCategory = 'labour' | 'materials' | 'plant_hire' | 'subcontractor' | 'fees' | 'other';
export type WOPaymentStatus = 'unpaid' | 'invoiced' | 'approved' | 'paid';

export interface WorkOrder {
  id: string;
  org_id: string;
  wo_number: string;
  title: string;
  description: string | null;
  entity_id: string;
  property_id: string | null;
  room_id: string | null;
  category: WOCategory;
  priority: WOPriority;
  estimated_cost: number | null;
  approved_budget: number | null;
  actual_cost: number | null;
  status: WOStatus;
  raised_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  maintenance_request_id: string | null;
  target_start_date: string | null;
  target_completion_date: string | null;
  actual_start_date: string | null;
  actual_completion_date: string | null;
  invoice_reference: string | null;
  invoice_amount: number | null;
  invoice_date: string | null;
  payment_status: WOPaymentStatus;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderWithDetails extends WorkOrder {
  entity: { id: string; entity_name: string } | null;
  property: { id: string; address_line_1: string; city: string; postcode: string } | null;
  room: { id: string; room_name: string } | null;
  jobs: { id: string; status: string; contractor_id: string | null; final_amount_gbp: number | null }[];
  cost_items: WorkOrderCostItem[];
}

export interface WorkOrderCostItem {
  id: string;
  work_order_id: string;
  description: string;
  category: CostCategory;
  amount: number;
  vat_amount: number;
  contractor_job_id: string | null;
  invoice_reference: string | null;
  receipt_url: string | null;
  is_estimated: boolean;
  created_at: string;
}

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'];
type WorkOrderInsert = Database['public']['Tables']['work_orders']['Insert'];
type WorkOrderUpdate = Database['public']['Tables']['work_orders']['Update'];
type WorkOrderCostRow = Database['public']['Tables']['work_order_costs']['Row'];
type WorkOrderCostInsert = Database['public']['Tables']['work_order_costs']['Insert'];
type ContractorJobUpdate = Database['public']['Tables']['contractor_jobs']['Update'];
type MaintenanceRequestRow = Database['public']['Tables']['maintenance_requests']['Row'];

interface WorkOrderCountItem {
  status: WOStatus;
  priority: WOPriority;
  estimated_cost: number | null;
  actual_cost: number | null;
}

interface WorkOrderCostSummary {
  amount: number;
  vat_amount: number | null;
}

interface MaintenanceRequestWithProperty extends MaintenanceRequestRow {
  property_v2: { entity_id: string | null } | null;
}

// ─── Constants ───────────────────────────────────────────────────────

export const WO_STATUSES: { value: WOStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'approved', label: 'Approved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'completed', label: 'Completed', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  { value: 'invoiced', label: 'Invoiced', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'closed', label: 'Closed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
];

export const WO_CATEGORIES: { value: WOCategory; label: string }[] = [
  { value: 'compliance', label: 'Compliance' },
  { value: 'reactive', label: 'Reactive Repair' },
  { value: 'planned', label: 'Planned Maintenance' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'refurbishment', label: 'Refurbishment' },
  { value: 'void_works', label: 'Void Works' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'general', label: 'General' },
];

export const COST_CATEGORIES: { value: CostCategory; label: string }[] = [
  { value: 'labour', label: 'Labour' },
  { value: 'materials', label: 'Materials' },
  { value: 'plant_hire', label: 'Plant Hire' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'fees', label: 'Professional Fees' },
  { value: 'other', label: 'Other' },
];

// ─── Select Constants ────────────────────────────────────────────────

const WORK_ORDER_SELECT = `
  *,
  entity:legal_entities(id, entity_name),
  property:properties_v2(id, address_line_1, city, postcode),
  room:rooms_v2(id, room_name),
  jobs:contractor_jobs(id, status, contractor_id, final_amount_gbp),
  cost_items:work_order_costs(*)
`;

// ─── Read Hooks ──────────────────────────────────────────────────────

export function useWorkOrders(filters?: {
  status?: WOStatus[];
  category?: WOCategory;
  entityId?: string;
  propertyId?: string;
  priority?: WOPriority;
}) {
  return useQuery({
    queryKey: ['work_orders', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('work_orders')
        .select(WORK_ORDER_SELECT)
        .order('created_at', { ascending: false });

      if (filters?.status?.length) query = query.in('status', filters.status);
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.entityId) query = query.eq('entity_id', filters.entityId);
      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
      if (filters?.priority) query = query.eq('priority', filters.priority);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as WorkOrderWithDetails[];
    },
  });
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['work_order', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('work_orders')
        .select(WORK_ORDER_SELECT)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as WorkOrderWithDetails;
    },
    enabled: !!id,
  });
}

export function useWorkOrderCounts() {
  return useQuery({
    queryKey: ['work_order_counts'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('work_orders')
        .select('status, priority, estimated_cost, actual_cost');
      if (error) throw error;

      const items = (data || []) as WorkOrderCountItem[];
      return {
        total: items.length,
        draft: items.filter(w => w.status === 'draft').length,
        awaitingApproval: items.filter(w => w.status === 'submitted').length,
        approved: items.filter(w => w.status === 'approved').length,
        inProgress: items.filter(w => w.status === 'in_progress').length,
        completed: items.filter(w => ['completed', 'invoiced', 'closed'].includes(w.status)).length,
        urgent: items.filter(w => w.priority === 'urgent' && !['closed', 'cancelled', 'completed', 'invoiced'].includes(w.status)).length,
        totalEstimated: items.reduce((s: number, w) => s + (w.estimated_cost || 0), 0),
        totalActual: items.filter(w => ['completed', 'invoiced', 'closed'].includes(w.status))
          .reduce((s: number, w) => s + (w.actual_cost || 0), 0),
      };
    },
  });
}

// ─── Create Work Order ───────────────────────────────────────────────

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      entity_id: string;
      property_id?: string;
      room_id?: string;
      category: WOCategory;
      priority: WOPriority;
      estimated_cost?: number;
      target_start_date?: string;
      target_completion_date?: string;
      maintenance_request_id?: string;
      internal_notes?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      if (!orgId) throw new Error('No organization found');
      const { data: { user } } = await supabase.auth.getUser();

      // Generate WO number
      const { data: woNumber, error: numErr } = await supabase
        .rpc('generate_wo_number', { p_org_id: orgId, p_entity_id: input.entity_id });
      if (numErr) throw numErr;

      const payload: WorkOrderInsert = {
          org_id: orgId,
          wo_number: woNumber,
          title: input.title,
          description: input.description || null,
          entity_id: input.entity_id,
          property_id: input.property_id || null,
          room_id: input.room_id || null,
          category: input.category,
          priority: input.priority,
          estimated_cost: input.estimated_cost || null,
          target_start_date: input.target_start_date || null,
          target_completion_date: input.target_completion_date || null,
          maintenance_request_id: input.maintenance_request_id || null,
          internal_notes: input.internal_notes || null,
          raised_by: user?.id || null,
          status: 'draft',
        };

      const { data, error } = await (supabase as any)
        .from('work_orders')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data as WorkOrderRow;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['work_orders'] });
      qc.invalidateQueries({ queryKey: ['work_order_counts'] });
      toast({ title: `Work order ${data.wo_number} created` });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });
}

// ─── Submit for Approval ─────────────────────────────────────────────

export function useSubmitWorkOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('work_orders')
        .update({ status: 'submitted', updated_at: new Date().toISOString() } satisfies WorkOrderUpdate)
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['work_order', id] });
      qc.invalidateQueries({ queryKey: ['work_orders'] });
      qc.invalidateQueries({ queryKey: ['work_order_counts'] });
      toast({ title: 'Submitted for approval' });
    },
  });
}

// ─── Approve Work Order ──────────────────────────────────────────────

export function useApproveWorkOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, approvedBudget }: { id: string; approvedBudget: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: WorkOrderUpdate = {
        status: 'approved',
        approved_budget: approvedBudget,
        approved_by: user?.id || null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from('work_orders')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['work_order', id] });
      qc.invalidateQueries({ queryKey: ['work_orders'] });
      qc.invalidateQueries({ queryKey: ['work_order_counts'] });
      toast({ title: 'Work order approved' });
    },
  });
}

// ─── Reject Work Order ───────────────────────────────────────────────

export function useRejectWorkOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const payload: WorkOrderUpdate = {
        status: 'rejected',
        rejected_reason: reason,
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from('work_orders')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['work_order', id] });
      qc.invalidateQueries({ queryKey: ['work_orders'] });
      qc.invalidateQueries({ queryKey: ['work_order_counts'] });
      toast({ title: 'Work order rejected' });
    },
  });
}

// ─── Update Work Order ───────────────────────────────────────────────

export function useUpdateWorkOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkOrderUpdate> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('work_orders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkOrderRow;
    },
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['work_order', newData.id] });
      const previous = qc.getQueryData<WorkOrderWithDetails>(['work_order', newData.id]);
      if (previous) {
        qc.setQueryData(['work_order', newData.id], { ...previous, ...newData });
      }
      return { previous };
    },
    onError: (_err, newData, context) => {
      if (context?.previous) {
        qc.setQueryData(['work_order', newData.id], context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      qc.invalidateQueries({ queryKey: ['work_order', variables.id] });
      qc.invalidateQueries({ queryKey: ['work_orders'] });
      qc.invalidateQueries({ queryKey: ['work_order_counts'] });
      toast({ title: 'Work order updated' });
    },
  });
}

// ─── Complete Work Order ─────────────────────────────────────────────

export function useCompleteWorkOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, actualCost }: { id: string; actualCost?: number }) => {
      let cost = actualCost;
      if (cost === undefined) {
        const { data: items } = await (supabase as any)
          .from('work_order_costs')
          .select('amount, vat_amount')
          .eq('work_order_id', id)
          .eq('is_estimated', false);

        cost = ((items || []) as WorkOrderCostSummary[]).reduce((s, i) => s + i.amount + (i.vat_amount || 0), 0);
      }

      // TODO: When WO is closed, sync actual_cost to financial_snapshots.maintenance_costs
      // for the property's entity + month. This will be automated in a future section.

      const payload: WorkOrderUpdate = {
        status: 'completed',
        actual_cost: cost,
        actual_completion_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from('work_orders')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['work_order', variables.id] });
      qc.invalidateQueries({ queryKey: ['work_orders'] });
      qc.invalidateQueries({ queryKey: ['work_order_counts'] });
      toast({ title: 'Work order completed' });
    },
  });
}

// ─── Cost Line Items ─────────────────────────────────────────────────

export function useAddCostItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      work_order_id: string;
      description: string;
      category: CostCategory;
      amount: number;
      vat_amount?: number;
      contractor_job_id?: string;
      invoice_reference?: string;
      is_estimated?: boolean;
    }) => {
      const orgId = await fetchUserOrgId();
      if (!orgId) throw new Error('No org');

      const payload: WorkOrderCostInsert = { ...input, org_id: orgId };
      const { data, error } = await (supabase as any)
        .from('work_order_costs')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as WorkOrderCostRow;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['work_order', vars.work_order_id] });
    },
  });
}

export function useDeleteCostItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, workOrderId }: { id: string; workOrderId: string }) => {
      const { error } = await (supabase as any)
        .from('work_order_costs')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { workOrderId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['work_order', result.workOrderId] });
    },
  });
}

// ─── Link Contractor Job to WO ───────────────────────────────────────

export function useLinkJobToWorkOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ jobId, workOrderId }: { jobId: string; workOrderId: string }) => {
      const payload: ContractorJobUpdate = { work_order_id: workOrderId };
      const { error } = await (supabase as any)
        .from('contractor_jobs')
        .update(payload)
        .eq('id', jobId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['work_order', variables.workOrderId] });
      qc.invalidateQueries({ queryKey: ['contractor-job', variables.jobId] });
      qc.invalidateQueries({ queryKey: ['work_orders'] });
      toast({ title: 'Job linked to work order' });
    },
  });
}

// ─── Create WO from Maintenance Request ──────────────────────────────

export function useCreateWOFromMaintenance() {
  const createWO = useCreateWorkOrder();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data: req, error } = await (supabase as any)
        .from('maintenance_requests')
        .select(`
          *,
          property_v2:properties_v2(id, entity_id, address_line_1, city)
        `)
        .eq('id', requestId)
        .single();

      if (error || !req) throw error || new Error('Request not found');
      const maintenanceRequest = req as MaintenanceRequestWithProperty;

      const entityId = maintenanceRequest.property_v2?.entity_id;
      if (!entityId) throw new Error('Property has no entity — cannot create WO');

      const categoryMap: Record<string, WOCategory> = {
        plumbing: 'reactive',
        electrical: 'reactive',
        heating: 'reactive',
        appliance: 'reactive',
        damp_mould: 'reactive',
        structural: 'planned',
        locks_security: 'emergency',
        cleaning: 'planned',
        garden_external: 'planned',
        other: 'general',
      };

      return createWO.mutateAsync({
        title: maintenanceRequest.title,
        description: maintenanceRequest.description || undefined,
        entity_id: entityId,
        property_id: maintenanceRequest.property_id || undefined,
        room_id: maintenanceRequest.room_id || undefined,
        category: categoryMap[maintenanceRequest.category] || 'general',
        priority: maintenanceRequest.priority === 'emergency' ? 'urgent' : (maintenanceRequest.priority as WOPriority),
        maintenance_request_id: requestId,
      });
    },
  });
}
