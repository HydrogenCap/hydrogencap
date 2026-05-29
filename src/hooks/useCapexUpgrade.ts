/**
 * CRUD hooks for CapEx upgrade: phases, payments, photos, planning applications.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useUserOrg, fetchUserOrgId } from './useUserOrg';
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────

export interface CapexPhase {
  id: string;
  project_id: string;
  org_id: string;
  phase_name: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: 'planned' | 'in_progress' | 'completed' | 'delayed';
  budget: number;
  actual_cost: number;
  depends_on_phase_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CapexPayment {
  id: string;
  project_id: string;
  phase_id: string | null;
  org_id: string;
  contractor_id: string | null;
  amount: number;
  payment_type: 'stage_payment' | 'final' | 'retention';
  invoice_ref: string | null;
  invoice_url: string | null;
  paid_at: string | null;
  retention_pct: number;
  retention_release_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapexPhoto {
  id: string;
  project_id: string;
  phase_id: string | null;
  org_id: string;
  photo_url: string;
  description: string | null;
  taken_at: string;
  category: 'before' | 'during' | 'after' | 'issue';
  created_at: string;
}

export interface PlanningApplication {
  id: string;
  property_id: string | null;
  project_id: string | null;
  org_id: string;
  application_type: 'planning' | 'building_regs' | 'hmo_licence' | 'listed_building';
  reference_number: string | null;
  submitted_date: string | null;
  authority_name: string | null;
  status: 'submitted' | 'validated' | 'consultation' | 'approved' | 'refused' | 'conditions_discharge' | 'withdrawn';
  conditions: Array<{ text: string; discharged: boolean }>;
  decision_date: string | null;
  expiry_date: string | null;
  document_urls: string[];
  created_at: string;
  updated_at: string;
}

// ── Phases ──────────────────────────────────────────────────────────

export function useCapexPhases(projectId: string) {
  const { data: orgId } = useUserOrg();
  return useQuery({
    queryKey: ['capex-phases', orgId, projectId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('capex_phases')
        .select('*')
        .eq('project_id', projectId)
        .eq('org_id', orgId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as CapexPhase[];
    },
    enabled: !!orgId && !!projectId,
  });
}

export function useCreateCapexPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (phase: Omit<CapexPhase, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('capex_phases')
        .insert({ ...phase, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as CapexPhase;
    },
    onSuccess: (_data) => {
      qc.invalidateQueries({ queryKey: ['capex-phases'] });
      toast.success('Phase added');
    },
    onError: (e: Error) => toast.error('Error', { description: e.message }),
  });
}

export function useUpdateCapexPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CapexPhase> & { id: string }) => {
      const { error } = await supabaseAny
        .from('capex_phases')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capex-phases'] });
      toast.success('Phase updated');
    },
  });
}

export function useDeleteCapexPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny.from('capex_phases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capex-phases'] }),
  });
}

// ── Payments ────────────────────────────────────────────────────────

export function useCapexPayments(projectId: string) {
  const { data: orgId } = useUserOrg();
  return useQuery({
    queryKey: ['capex-payments', orgId, projectId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('capex_payments')
        .select('*')
        .eq('project_id', projectId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as CapexPayment[];
    },
    enabled: !!orgId && !!projectId,
  });
}

export function useCreateCapexPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: Omit<CapexPayment, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('capex_payments')
        .insert({ ...payment, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as CapexPayment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capex-payments'] });
      toast.success('Payment added');
    },
    onError: (e: Error) => toast.error('Error', { description: e.message }),
  });
}

export function useUpdateCapexPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CapexPayment> & { id: string }) => {
      const { error } = await supabaseAny
        .from('capex_payments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capex-payments'] });
      toast.success('Payment updated');
    },
  });
}

export function useDeleteCapexPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny.from('capex_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capex-payments'] }),
  });
}

// ── Photos ──────────────────────────────────────────────────────────

export function useCapexPhotos(projectId: string) {
  const { data: orgId } = useUserOrg();
  return useQuery({
    queryKey: ['capex-photos', orgId, projectId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('capex_photos')
        .select('*')
        .eq('project_id', projectId)
        .eq('org_id', orgId)
        .order('taken_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CapexPhoto[];
    },
    enabled: !!orgId && !!projectId,
  });
}

export function useCreateCapexPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: Omit<CapexPhoto, 'id' | 'org_id' | 'created_at'>) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('capex_photos')
        .insert({ ...photo, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as CapexPhoto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capex-photos'] });
      toast.success('Photo added');
    },
    onError: (e: Error) => toast.error('Error', { description: e.message }),
  });
}

export function useDeleteCapexPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny.from('capex_photos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capex-photos'] }),
  });
}

// ── Planning Applications ───────────────────────────────────────────

export function usePlanningApplications(projectId: string) {
  const { data: orgId } = useUserOrg();
  return useQuery({
    queryKey: ['planning-applications', orgId, projectId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('planning_applications')
        .select('*')
        .eq('project_id', projectId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PlanningApplication[];
    },
    enabled: !!orgId && !!projectId,
  });
}

export function useCreatePlanningApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (app: Omit<PlanningApplication, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('planning_applications')
        .insert({ ...app, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as PlanningApplication;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-applications'] });
      toast.success('Application added');
    },
    onError: (e: Error) => toast.error('Error', { description: e.message }),
  });
}

export function useUpdatePlanningApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlanningApplication> & { id: string }) => {
      const { error } = await supabaseAny
        .from('planning_applications')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-applications'] });
      toast.success('Application updated');
    },
  });
}

export function useDeletePlanningApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny.from('planning_applications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-applications'] }),
  });
}
