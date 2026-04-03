import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { calculatePaymentScore } from '@/lib/tenant-scoring';

// ============================================================
// Types
// ============================================================

export type NoticeType =
  | 'section_8'
  | 'section_13'
  | 'section_21'
  | 'rent_arrears_warning'
  | 'property_access'
  | 'welcome'
  | 'end_of_tenancy'
  | 'custom';

export type NoticeStatus = 'draft' | 'sent' | 'served' | 'acknowledged' | 'expired' | 'withdrawn';

export type ServedMethod =
  | 'hand_delivery'
  | 'first_class_post'
  | 'recorded_delivery'
  | 'email'
  | 'portal'
  | 'other';

export interface TenantNotice {
  id: string;
  org_id: string;
  tenant_id: string;
  tenancy_id: string | null;
  notice_type: NoticeType;
  subject: string;
  content: string;
  served_method: ServedMethod | null;
  served_at: string | null;
  proof_of_service: string | null;
  status: NoticeStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LifecycleEventType =
  | 'application_received'
  | 'reference_requested'
  | 'reference_completed'
  | 'agreement_signed'
  | 'moved_in'
  | 'rent_increase'
  | 'notice_served'
  | 'notice_received'
  | 'inspection_scheduled'
  | 'inspection_completed'
  | 'complaint_received'
  | 'complaint_resolved'
  | 'arrears_flagged'
  | 'arrears_cleared'
  | 'moved_out'
  | 'deposit_returned'
  | 'status_change'
  | 'note'
  | 'custom';

export interface TenantLifecycleEvent {
  id: string;
  org_id: string;
  tenant_id: string;
  tenancy_id: string | null;
  event_type: LifecycleEventType;
  description: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// Payment Score Hook
// ============================================================

export function useTenantPaymentScore(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant_payment_score', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await (supabase as any)
        .from('tenants_v2')
        .select('on_time_payments, late_payments, missed_payments, payment_score, housing_benefit_amount, universal_credit')
        .eq('id', tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const score = calculatePaymentScore({
        on_time_payments: data.on_time_payments ?? 0,
        late_payments: data.late_payments ?? 0,
        missed_payments: data.missed_payments ?? 0,
      });

      return {
        score,
        on_time_payments: data.on_time_payments ?? 0,
        late_payments: data.late_payments ?? 0,
        missed_payments: data.missed_payments ?? 0,
        stored_score: data.payment_score as number | null,
        housing_benefit_amount: data.housing_benefit_amount as number | null,
        universal_credit: data.universal_credit as number | null,
      };
    },
    enabled: !!tenantId,
  });
}

// ============================================================
// Notices Hooks
// ============================================================

export function useTenantNotices(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant_notices', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await (supabase as any)
        .from('tenant_notices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TenantNotice[];
    },
    enabled: !!tenantId,
  });
}

export type CreateNoticeInput = Omit<TenantNotice, 'id' | 'org_id' | 'created_by' | 'created_at' | 'updated_at'>;

export function useCreateNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notice: CreateNoticeInput) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await (supabase as any)
        .from('tenant_notices')
        .insert({ ...notice, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as TenantNotice;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['tenant_notices', variables.tenant_id] });
      qc.invalidateQueries({ queryKey: ['tenant_lifecycle_events', variables.tenant_id] });
    },
  });
}

// ============================================================
// Lifecycle Events Hooks
// ============================================================

export function useTenantLifecycleEvents(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant_lifecycle_events', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await (supabase as any)
        .from('tenant_lifecycle_events')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TenantLifecycleEvent[];
    },
    enabled: !!tenantId,
  });
}

export type LogEventInput = Omit<TenantLifecycleEvent, 'id' | 'org_id' | 'created_by' | 'created_at'>;

export function useLogLifecycleEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: LogEventInput) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await (supabase as any)
        .from('tenant_lifecycle_events')
        .insert({ ...event, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as TenantLifecycleEvent;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['tenant_lifecycle_events', variables.tenant_id] });
    },
  });
}
