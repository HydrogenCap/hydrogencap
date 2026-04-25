import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';

export type TenantTypeV2 = 'private' | 'dss_hb' | 'uc' | 'council_placement' | 'supported_housing';
export type TenantStatusV2 = 'active' | 'prospective' | 'in_notice' | 'departed' | 'evicted' | 'archived';

export interface TenantV2 {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  national_insurance: string | null;
  referral_source: string | null;
  tenant_type: TenantTypeV2;
  status: TenantStatusV2;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantWithCurrentTenancy extends TenantV2 {
  current_tenancy?: {
    id: string;
    property_id: string;
    room_id: string;
    rent_amount_pcm: number;
    start_date: string;
    tenancy_type: string;
    status: string;
    property_address?: string;
    room_name?: string;
  } | null;
}

interface AgreementPropertyDetails {
  address_line_1: string | null;
  city: string | null;
  postcode: string | null;
}

interface AgreementRoomDetails {
  room_name: string | null;
}

interface AgreementWithDisplayDetails {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string;
  rent_amount_pcm: number;
  start_date: string;
  tenancy_type: string;
  status: string;
  properties_v2: AgreementPropertyDetails | null;
  rooms_v2: AgreementRoomDetails | null;
}

export const TENANT_TYPES = [
  { value: 'private', label: 'Private' },
  { value: 'dss_hb', label: 'DSS/HB' },
  { value: 'uc', label: 'Universal Credit' },
  { value: 'council_placement', label: 'Council' },
  { value: 'supported_housing', label: 'Supported' },
] as const;

export const TENANT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'prospective', label: 'Prospective' },
  { value: 'in_notice', label: 'In Notice' },
  { value: 'departed', label: 'Departed' },
  { value: 'evicted', label: 'Evicted' },
  { value: 'archived', label: 'Archived' },
] as const;

export const REFERRAL_SOURCES = [
  { value: 'direct', label: 'Direct' },
  { value: 'agent', label: 'Agent' },
  { value: 'council', label: 'Council' },
  { value: 'housing_association', label: 'Housing Association' },
  { value: 'supported_housing', label: 'Supported Housing' },
  { value: 'referral', label: 'Referral' },
  { value: 'online_ad', label: 'Online Ad' },
] as const;

export function useTenantsV2(status?: TenantStatusV2, options?: { page?: number; pageSize?: number }) {
  const page = options?.page;
  const pageSize = options?.pageSize ?? 50;

  return useQuery({
    queryKey: ['tenants_v2', status, page, pageSize],
    queryFn: async () => {
      let query = supabaseAny
        .from('tenants_v2')
        .select('id, org_id, first_name, last_name, email, phone, date_of_birth, national_insurance, referral_source, tenant_type, status, emergency_contact_name, emergency_contact_phone, notes, created_at, updated_at', { count: 'exact' })
        .order('last_name', { ascending: true });
      if (status) query = query.eq('status', status);

      if (page) {
        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      const items = (data ?? []) as TenantV2[];
      const total = count ?? items.length;
      return {
        items,
        total,
        page: page ?? 1,
        pageSize: page ? pageSize : total || 1,
        totalPages: page ? Math.ceil(total / pageSize) : 1,
      };
    },
  });
}

export function useTenantsV2WithTenancy() {
  return useQuery({
    queryKey: ['tenants_v2', 'with-tenancy'],
    queryFn: async () => {
      const { data: tenants, error: te } = await supabaseAny
        .from('tenants_v2')
        .select('id, org_id, first_name, last_name, email, phone, date_of_birth, national_insurance, referral_source, tenant_type, status, emergency_contact_name, emergency_contact_phone, notes, created_at, updated_at')
        .order('last_name');
      if (te) throw te;

      const { data: agreements, error: ae } = await supabaseAny
        .from('tenancy_agreements')
        .select(`
          id, tenant_id, property_id, room_id, rent_amount_pcm, start_date, tenancy_type, status,
          properties_v2(address_line_1, city, postcode),
          rooms_v2(room_name)
        `)
        .in('status', ['active', 'notice_period']);
      if (ae) throw ae;

      const tenancyMap = new Map<string, AgreementWithDisplayDetails>();
      for (const a of (agreements ?? []) as AgreementWithDisplayDetails[]) {
        if (!tenancyMap.has(a.tenant_id)) tenancyMap.set(a.tenant_id, a);
      }

      return (tenants || []).map(t => {
        const a = tenancyMap.get(t.id);
        return {
          ...t,
          current_tenancy: a ? {
            id: a.id,
            property_id: a.property_id,
            room_id: a.room_id,
            rent_amount_pcm: a.rent_amount_pcm,
            start_date: a.start_date,
            tenancy_type: a.tenancy_type,
            status: a.status,
            property_address: a.properties_v2 ? `${a.properties_v2.address_line_1}, ${a.properties_v2.city}` : undefined,
            room_name: a.rooms_v2?.room_name ?? undefined,
          } : null,
        } as TenantWithCurrentTenancy;
      });
    },
  });
}

export function useTenantV2(id: string | undefined) {
  return useQuery({
    queryKey: ['tenant_v2', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabaseAny
        .from('tenants_v2')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as TenantV2 | null;
    },
    enabled: !!id,
  });
}

export function useCreateTenantV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tenant: Omit<TenantV2, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('tenants_v2')
        .insert({ ...tenant, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants_v2'] });
    },
  });
}

export function useUpdateTenantV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TenantV2> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('tenants_v2')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tenants_v2'] });
      qc.invalidateQueries({ queryKey: ['tenant_v2', data.id] });
    },
  });
}
