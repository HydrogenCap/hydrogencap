import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { toast } from "sonner";

// ── Tenant References ──

export interface TenantReference {
  id: string;
  org_id: string;
  letting_id: string | null;
  tenant_id: string | null;
  applicant_name: string;
  applicant_email: string | null;
  applicant_phone: string | null;
  credit_check_status: 'pending' | 'passed' | 'failed' | 'conditional';
  credit_check_date: string | null;
  credit_score: number | null;
  employer_name: string | null;
  employer_contact: string | null;
  employment_status: 'employed' | 'self_employed' | 'retired' | 'student' | 'unemployed' | 'other' | null;
  annual_income: number | null;
  employer_ref_status: 'pending' | 'received' | 'satisfactory' | 'unsatisfactory';
  previous_landlord_name: string | null;
  previous_landlord_contact: string | null;
  landlord_ref_status: 'pending' | 'received' | 'satisfactory' | 'unsatisfactory';
  right_to_rent_checked: boolean;
  right_to_rent_doc_type: string | null;
  right_to_rent_expiry: string | null;
  guarantor_required: boolean;
  guarantor_name: string | null;
  guarantor_contact: string | null;
  guarantor_status: 'not_required' | 'pending' | 'confirmed' | 'refused';
  overall_status: 'in_progress' | 'approved' | 'rejected' | 'conditional';
  notes: string | null;
  created_at: string;
}

export function useTenantReferences(lettingId: string | undefined) {
  return useQuery({
    queryKey: ['tenant-references', lettingId],
    queryFn: async () => {
      if (!lettingId) return null;
      const { data, error } = await supabaseAny
        .from('tenant_references')
        .select('*')
        .eq('letting_id', lettingId)
        .maybeSingle();
      if (error) throw error;
      return data as TenantReference | null;
    },
    enabled: !!lettingId,
  });
}

export function useCreateReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<TenantReference> & { letting_id: string; applicant_name: string }) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('tenant_references')
        .insert({ ...input, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as TenantReference;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tenant-references', data.letting_id] });
      toast.success('Reference record created');
    },
  });
}

export function useUpdateReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lettingId, ...updates }: Partial<TenantReference> & { id: string; lettingId: string }) => {
      const { data, error } = await supabaseAny
        .from('tenant_references')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, lettingId } as TenantReference & { lettingId: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tenant-references', data.lettingId] });
      toast.success('Reference updated');
    },
  });
}

export function useApproveApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lettingId, status }: { id: string; lettingId: string; status: 'approved' | 'rejected' }) => {
      const { error } = await supabaseAny
        .from('tenant_references')
        .update({ overall_status: status })
        .eq('id', id);
      if (error) throw error;
      return { lettingId, status };
    },
    onSuccess: ({ lettingId, status }) => {
      qc.invalidateQueries({ queryKey: ['tenant-references', lettingId] });
      qc.invalidateQueries({ queryKey: ['lettings-pipeline'] });
      toast.success(status === 'approved' ? 'Applicant approved' : 'Applicant rejected');
    },
  });
}

// ── Move-In Checklist ──

export interface MoveInChecklistItem {
  id: string;
  org_id: string;
  property_id: string;
  tenant_id: string | null;
  letting_id: string | null;
  deposit_protected: boolean;
  deposit_protection_ref: string | null;
  deposit_prescribed_info_served: boolean;
  standing_order_confirmed: boolean;
  keys_handed_over: boolean;
  keys_count: number | null;
  meter_readings_recorded: boolean;
  gas_reading: string | null;
  electric_reading: string | null;
  water_reading: string | null;
  council_tax_notified: boolean;
  utilities_transferred: boolean;
  inventory_completed: boolean;
  inventory_signed: boolean;
  how_to_rent_provided: boolean;
  gas_cert_provided: boolean;
  eicr_provided: boolean;
  epc_provided: boolean;
  welcome_pack_sent: boolean;
  emergency_contacts_collected: boolean;
  completed_at: string | null;
  created_at: string;
}

export function useMoveInChecklist(lettingId: string | undefined) {
  return useQuery({
    queryKey: ['move-in-checklist', lettingId],
    queryFn: async () => {
      if (!lettingId) return null;
      const { data, error } = await supabaseAny
        .from('move_in_checklists')
        .select('*')
        .eq('letting_id', lettingId)
        .maybeSingle();
      if (error) throw error;
      return data as MoveInChecklistItem | null;
    },
    enabled: !!lettingId,
  });
}

export function useCreateMoveInChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { property_id: string; letting_id: string; tenant_id?: string }) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('move_in_checklists')
        .insert({ ...input, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as MoveInChecklistItem;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['move-in-checklist', data.letting_id] });
    },
  });
}

export function useUpdateMoveInItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lettingId, ...updates }: Partial<MoveInChecklistItem> & { id: string; lettingId: string }) => {
      const { data, error } = await supabaseAny
        .from('move_in_checklists')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, lettingId } as MoveInChecklistItem & { lettingId: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['move-in-checklist', data.lettingId] });
      toast.success('Checklist updated');
    },
  });
}

export function useCompleteMoveIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lettingId }: { id: string; lettingId: string }) => {
      const { error } = await supabaseAny
        .from('move_in_checklists')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { lettingId };
    },
    onSuccess: ({ lettingId }) => {
      qc.invalidateQueries({ queryKey: ['move-in-checklist', lettingId] });
      qc.invalidateQueries({ queryKey: ['lettings-pipeline'] });
      toast.success('Move-in completed');
    },
  });
}

// ── Viewings ──

export interface PropertyViewing {
  id: string;
  org_id: string;
  property_id: string;
  letting_id: string | null;
  applicant_name: string;
  applicant_email: string | null;
  applicant_phone: string | null;
  viewing_date: string;
  viewing_time: string;
  status: 'scheduled' | 'attended' | 'no_show' | 'cancelled';
  feedback: string | null;
  created_at: string;
}

export function useViewings(lettingId: string | undefined) {
  return useQuery({
    queryKey: ['property-viewings', lettingId],
    queryFn: async () => {
      if (!lettingId) return [];
      const { data, error } = await supabaseAny
        .from('property_viewings')
        .select('*')
        .eq('letting_id', lettingId)
        .order('viewing_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PropertyViewing[];
    },
    enabled: !!lettingId,
  });
}

export function useCreateViewing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<PropertyViewing, 'id' | 'org_id' | 'created_at'>) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('property_viewings')
        .insert({ ...input, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as PropertyViewing;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['property-viewings', data.letting_id] });
      toast.success('Viewing scheduled');
    },
  });
}

export function useUpdateViewing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lettingId, ...updates }: Partial<PropertyViewing> & { id: string; lettingId: string }) => {
      const { data, error } = await supabaseAny
        .from('property_viewings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, lettingId } as PropertyViewing & { lettingId: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['property-viewings', data.lettingId] });
      toast.success('Viewing updated');
    },
  });
}

// ── Tenancy Agreement Drafts ──

export interface TenancyAgreementDraft {
  id: string;
  org_id: string;
  letting_id: string | null;
  property_id: string;
  tenant_names: string;
  tenant_address: string | null;
  landlord_name: string;
  landlord_address: string | null;
  property_address: string;
  property_description: string | null;
  rent_amount: number;
  payment_frequency: string;
  payment_day: number | null;
  deposit_amount: number | null;
  tenancy_start_date: string;
  tenancy_end_date: string | null;
  break_clause_months: number | null;
  special_conditions: string | null;
  agreement_html: string | null;
  status: 'draft' | 'sent_for_signing' | 'signed' | 'cancelled';
  created_at: string;
}

export function useTenancyDraft(lettingId: string | undefined) {
  return useQuery({
    queryKey: ['tenancy-draft', lettingId],
    queryFn: async () => {
      if (!lettingId) return null;
      const { data, error } = await supabaseAny
        .from('tenancy_agreement_drafts')
        .select('*')
        .eq('letting_id', lettingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TenancyAgreementDraft | null;
    },
    enabled: !!lettingId,
  });
}

export function useSaveTenancyDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TenancyAgreementDraft, 'id' | 'org_id' | 'created_at'>) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('tenancy_agreement_drafts')
        .insert({ ...input, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as TenancyAgreementDraft;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tenancy-draft', data.letting_id] });
      toast.success('Agreement saved');
    },
  });
}

export function useUpdateTenancyDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lettingId, ...updates }: Partial<TenancyAgreementDraft> & { id: string; lettingId: string }) => {
      const { data, error } = await supabaseAny
        .from('tenancy_agreement_drafts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { ...data, lettingId } as TenancyAgreementDraft & { lettingId: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tenancy-draft', data.lettingId] });
      toast.success('Agreement updated');
    },
  });
}
