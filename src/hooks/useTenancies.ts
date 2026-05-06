/**
 * V1 → V2 cutover (Prompt #53):
 *
 * Reads now go through `tenancy_agreements` (V2). The V2 schema is parity with V1
 * for the columns this hook surfaces, so the only "remap" is:
 *   - table name      tenancies        → tenancy_agreements
 *   - status enum     'notice'         → 'notice_period' (mapped at the boundary
 *                                        so the public API/types don't change)
 *   - end_date        end_date         ← coalesce(actual_end_date, initial_end_date)
 *   - relations       properties.address_line   → properties_v2.address_line_1 (alias)
 *
 * Mutations are frozen via throwV1Frozen('tenancies', …) — write paths must use
 * `useTenancyAgreements` instead. There are currently no in-repo callers of the
 * V1 mutation hooks (verified during cutover).
 */
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { throwV1Frozen } from '@/lib/v1Frozen';

export type TenancyStatus = 'pending' | 'active' | 'notice' | 'ended';

export type PaymentMethod = 'bank_transfer' | 'standing_order' | 'direct_debit' | 'cash' | 'cheque';

export interface Tenancy {
  id: string;
  org_id: string;
  tenant_id: string;
  room_id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  rent_amount_pcm: number;
  rent_due_day: number;
  deposit_amount: number | null;
  deposit_scheme: string | null;
  deposit_reference: string | null;
  deposit_protected_date: string | null;
  tenancy_agreement_url: string | null;
  status: TenancyStatus;
  notice_date: string | null;
  notice_period_weeks: number;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenancyWithDetails extends Tenancy {
  tenant: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
  room: {
    id: string;
    room_name: string;
    room_type: string;
  };
  property: {
    id: string;
    address_line: string;
    postcode: string | null;
  };
}

// Map V2 row → V1-shaped TenancyWithDetails so existing consumers don't change.
function mapAgreementRow(row: any): TenancyWithDetails {
  const v2Status: string | null = row?.status ?? null;
  const status: TenancyStatus =
    v2Status === 'notice_period' ? 'notice'
    : v2Status === 'terminated' ? 'ended'
    : (v2Status as TenancyStatus) ?? 'pending';

  const property = row?.property
    ? {
        id: row.property.id,
        address_line: row.property.address_line_1 ?? '',
        postcode: row.property.postcode ?? null,
      }
    : { id: '', address_line: '', postcode: null };

  return {
    id: row.id,
    org_id: row.org_id,
    tenant_id: row.tenant_id,
    room_id: row.room_id,
    property_id: row.property_id,
    start_date: row.start_date,
    end_date: row.actual_end_date ?? row.initial_end_date ?? null,
    rent_amount_pcm: Number(row.rent_amount_pcm ?? 0),
    rent_due_day: row.rent_due_day ?? 1,
    deposit_amount: row.deposit_amount ?? null,
    deposit_scheme: row.deposit_scheme ?? null,
    deposit_reference: row.deposit_reference ?? null,
    deposit_protected_date: row.deposit_protected_date ?? null,
    tenancy_agreement_url: row.tenancy_agreement_url ?? null,
    status,
    notice_date: row.notice_served_date ?? null,
    notice_period_weeks: row.notice_period_weeks ?? 4,
    payment_method: (row.payment_method ?? null) as PaymentMethod | null,
    payment_reference: row.payment_reference ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    tenant: row.tenant ?? { id: '', first_name: '', last_name: '', email: null, phone: null },
    room: row.room ?? { id: '', room_name: '', room_type: '' },
    property,
  };
}

const V2_SELECT = `
  *,
  tenant:tenants_v2(id, first_name, last_name, email, phone),
  room:rooms_v2(id, room_name, room_type),
  property:properties_v2(id, address_line_1, postcode)
`;

export function useTenancies(filters?: { status?: TenancyStatus; tenantId?: string; propertyId?: string }) {
  return useQuery({
    queryKey: ['tenancies', filters],
    queryFn: async () => {
      let query = supabaseAny
        .from('tenancy_agreements')
        .select(V2_SELECT)
        .order('start_date', { ascending: false });

      if (filters?.status) {
        const v2Status = filters.status === 'notice' ? 'notice_period' : filters.status;
        query = query.eq('status', v2Status);
      }
      if (filters?.tenantId) query = query.eq('tenant_id', filters.tenantId);
      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);

      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as any[]).map(mapAgreementRow);
    },
  });
}

export function useTenancy(tenancyId: string) {
  return useQuery({
    queryKey: ['tenancies', tenancyId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('tenancy_agreements')
        .select(V2_SELECT)
        .eq('id', tenancyId)
        .single();
      if (error) throw error;
      return mapAgreementRow(data);
    },
    enabled: !!tenancyId,
  });
}

// ─── Mutations: FROZEN. Use useTenancyAgreements instead. ───────────────────
export function useCreateTenancy() {
  return useMutation({
    mutationFn: async (_t: Omit<Tenancy, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
      throwV1Frozen('tenancies', 'useCreateTenancy');
    },
  });
}

export function useUpdateTenancy() {
  return useMutation({
    mutationFn: async (_t: Partial<Tenancy> & { id: string }) => {
      throwV1Frozen('tenancies', 'useUpdateTenancy');
    },
  });
}

export function useActivateTenancy() {
  return useMutation({
    mutationFn: async (_tenancyId: string) => {
      throwV1Frozen('tenancies', 'useActivateTenancy');
    },
  });
}

export function useEndTenancy() {
  return useMutation({
    mutationFn: async (_args: { tenancyId: string; endDate: string }) => {
      throwV1Frozen('tenancies', 'useEndTenancy');
    },
  });
}

export function useGiveNotice() {
  return useMutation({
    mutationFn: async (_args: { tenancyId: string; noticeDate: string; endDate: string }) => {
      throwV1Frozen('tenancies', 'useGiveNotice');
    },
  });
}
