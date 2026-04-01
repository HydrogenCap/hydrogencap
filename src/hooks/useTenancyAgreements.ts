import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';

export type TenancyType = 'ast' | 'licence_to_occupy' | 'contractual_periodic' | 'statutory_periodic' | 'company_let';
export type TenancyAgreementStatus = 'active' | 'pending' | 'notice_period' | 'ended' | 'terminated';
export type DepositScheme = 'dps' | 'mydeposits' | 'tds' | 'none';
export type NoticeType = 'section_21' | 'section_8' | 'tenant_notice' | 'mutual' | 'none';

export interface TenancyAgreement {
  id: string;
  org_id: string;
  tenant_id: string;
  room_id: string;
  property_id: string;
  tenancy_type: TenancyType;
  start_date: string;
  initial_end_date: string | null;
  actual_end_date: string | null;
  rent_amount_pcm: number;
  rent_frequency: string;
  deposit_amount: number | null;
  deposit_scheme: DepositScheme | null;
  deposit_reference: string | null;
  deposit_protected_date: string | null;
  prescribed_info_served_date: string | null;
  how_to_rent_served_date: string | null;
  is_periodic: boolean;
  notice_served_date: string | null;
  notice_type: NoticeType | null;
  status: TenancyAgreementStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenancyAgreementFull extends TenancyAgreement {
  tenant_name?: string;
  room_name?: string;
  property_address?: string;
}

export interface TenancyComplianceCheck {
  tenancy_id: string;
  org_id: string;
  tenant_id: string;
  room_id: string;
  property_id: string;
  tenant_name: string;
  status: string;
  deposit_amount: number | null;
  deposit_scheme: string | null;
  deposit_protected_date: string | null;
  prescribed_info_served_date: string | null;
  how_to_rent_served_date: string | null;
  deposit_compliance: string;
  how_to_rent_compliance: string;
  section_21_ready: boolean;
}

interface AgreementTenantJoin {
  first_name: string | null;
  last_name: string | null;
}

interface AgreementRoomJoin {
  room_name: string | null;
}

interface AgreementPropertyJoin {
  address_line_1: string | null;
  city: string | null;
}

interface TenancyAgreementQueryRow extends TenancyAgreement {
  tenants_v2: AgreementTenantJoin | null;
  rooms_v2: AgreementRoomJoin | null;
  properties_v2: AgreementPropertyJoin | null;
}

export const TENANCY_TYPES = [
  { value: 'ast', label: 'AST' },
  { value: 'licence_to_occupy', label: 'Licence to Occupy' },
  { value: 'contractual_periodic', label: 'Contractual Periodic' },
  { value: 'statutory_periodic', label: 'Statutory Periodic' },
  { value: 'company_let', label: 'Company Let' },
] as const;

export const RENT_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'four_weekly', label: 'Four-Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

export const DEPOSIT_SCHEMES = [
  { value: 'dps', label: 'DPS' },
  { value: 'mydeposits', label: 'MyDeposits' },
  { value: 'tds', label: 'TDS' },
  { value: 'none', label: 'None' },
] as const;

export const NOTICE_TYPES = [
  { value: 'section_21', label: 'Section 21' },
  { value: 'section_8', label: 'Section 8' },
  { value: 'tenant_notice', label: 'Tenant Notice' },
  { value: 'mutual', label: 'Mutual Agreement' },
] as const;

export function useTenancyAgreements(filters?: { tenantId?: string; roomId?: string; propertyId?: string }) {
  return useQuery({
    queryKey: ['tenancy_agreements', filters],
    queryFn: async () => {
      let query = supabase
        .from('tenancy_agreements')
        .select(`
          *,
          tenants_v2(first_name, last_name),
          rooms_v2(room_name),
          properties_v2(address_line_1, city)
        `)
        .order('start_date', { ascending: false });

      if (filters?.tenantId) query = query.eq('tenant_id', filters.tenantId);
      if (filters?.roomId) query = query.eq('room_id', filters.roomId);
      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);

      const { data, error } = await query;
      if (error) throw error;
      return ((data || []) as TenancyAgreementQueryRow[]).map((d) => ({
        ...d,
        tenant_name: d.tenants_v2 ? `${d.tenants_v2.first_name} ${d.tenants_v2.last_name}` : undefined,
        room_name: d.rooms_v2?.room_name,
        property_address: d.properties_v2 ? `${d.properties_v2.address_line_1}, ${d.properties_v2.city}` : undefined,
        tenants_v2: undefined,
        rooms_v2: undefined,
        properties_v2: undefined,
      })) as TenancyAgreementFull[];
    },
  });
}

export function useTenancyComplianceChecks() {
  return useQuery({
    queryKey: ['tenancy_compliance_check_v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenancy_compliance_check_v2')
        .select('*');
      if (error) throw error;
      return data as TenancyComplianceCheck[];
    },
  });
}

type TenancyInsert = Omit<TenancyAgreement, 'id' | 'org_id' | 'created_at' | 'updated_at'>;

export function useCreateTenancyAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agreement: TenancyInsert) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase
        .from('tenancy_agreements')
        .insert({ ...agreement, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenancy_agreements'] });
      qc.invalidateQueries({ queryKey: ['tenancy_compliance_check_v2'] });
    },
  });
}

export function useUpdateTenancyAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TenancyAgreement> & { id: string }) => {
      const { data, error } = await supabase
        .from('tenancy_agreements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenancy_agreements'] });
      qc.invalidateQueries({ queryKey: ['tenancy_compliance_check_v2'] });
    },
  });
}
