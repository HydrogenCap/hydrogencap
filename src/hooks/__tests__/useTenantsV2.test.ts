/**
 * Regression tests for useTenantsV2.
 *
 * Focuses on the non-trivial shapes:
 *   - paginated list response (items, total, page, pageSize, totalPages)
 *   - useTenantsV2WithTenancy merges `tenancy_agreements` onto tenants,
 *     deriving `property_address` and `room_name`
 *   - mutations stamp `org_id`
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderAppHook } from '@/test/renderHook';
import { createMockSupabase, type MockSupabase } from './supabaseMock';

let mock: MockSupabase;

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mock;
  },
}));

vi.mock('@/hooks/useUserOrg', () => ({
  fetchUserOrgId: vi.fn(async () => 'org-1'),
  useUserOrg: () => ({ data: 'org-1', isLoading: false }),
}));

const tenantRows = [
  {
    id: 't1', org_id: 'org-1', first_name: 'Alice', last_name: 'Smith',
    email: 'a@x.com', phone: null, date_of_birth: null, national_insurance: null,
    referral_source: null, tenant_type: 'private', status: 'active',
    emergency_contact_name: null, emergency_contact_phone: null, notes: null,
    created_at: '2025-01-01', updated_at: '2025-01-01',
  },
  {
    id: 't2', org_id: 'org-1', first_name: 'Bob', last_name: 'Jones',
    email: null, phone: null, date_of_birth: null, national_insurance: null,
    referral_source: null, tenant_type: 'dss_hb', status: 'active',
    emergency_contact_name: null, emergency_contact_phone: null, notes: null,
    created_at: '2025-01-01', updated_at: '2025-01-01',
  },
];

beforeEach(() => {
  mock = createMockSupabase(({ table, op, filters }) => {
    if (table === 'tenants_v2' && op === 'select') {
      const idFilter = filters.id as { eq: string } | undefined;
      if (idFilter) {
        const row = tenantRows.find((r) => r.id === idFilter.eq) ?? null;
        return { data: row, error: null };
      }
      return { data: tenantRows, error: null, count: tenantRows.length };
    }
    if (table === 'tenancy_agreements' && op === 'select') {
      return {
        data: [
          {
            id: 'a1',
            tenant_id: 't1',
            property_id: 'p1',
            room_id: 'r1',
            rent_amount_pcm: 650,
            start_date: '2025-06-01',
            tenancy_type: 'ast',
            status: 'active',
            properties_v2: { address_line_1: '10 High St', city: 'Oxford', postcode: 'OX1 1AA' },
            rooms_v2: { room_name: 'Room 1' },
          },
        ],
        error: null,
      };
    }
    if (table === 'tenants_v2' && (op === 'insert' || op === 'update')) {
      return {
        data: { id: 't-new', ...((mock.__lastCall()?.payload as object) ?? {}) },
        error: null,
      };
    }
    return { data: null, error: null };
  });
});

describe('useTenantsV2', () => {
  it('returns paginated wrapper (items, total, page, pageSize, totalPages)', async () => {
    const { useTenantsV2 } = await import('@/hooks/useTenantsV2');
    const { result } = renderAppHook(() => useTenantsV2('active', { page: 1, pageSize: 50 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
    expect(result.current.data?.page).toBe(1);
    expect(result.current.data?.pageSize).toBe(50);
    expect(result.current.data?.totalPages).toBe(1);
  });

  it('filters by status when provided', async () => {
    const { useTenantsV2 } = await import('@/hooks/useTenantsV2');
    const { result } = renderAppHook(() => useTenantsV2('prospective'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const selectCall = mock.__calls.find((c) => c.table === 'tenants_v2' && c.op === 'select');
    expect(selectCall?.filters.status).toEqual({ eq: 'prospective' });
  });
});

describe('useTenantsV2WithTenancy', () => {
  it('joins tenants with their current tenancy and derives property_address / room_name', async () => {
    const { useTenantsV2WithTenancy } = await import('@/hooks/useTenantsV2');
    const { result } = renderAppHook(() => useTenantsV2WithTenancy());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const alice = result.current.data?.find((t) => t.id === 't1');
    const bob = result.current.data?.find((t) => t.id === 't2');

    expect(alice?.current_tenancy).not.toBeNull();
    expect(alice?.current_tenancy?.property_address).toBe('10 High St, Oxford');
    expect(alice?.current_tenancy?.room_name).toBe('Room 1');
    expect(alice?.current_tenancy?.rent_amount_pcm).toBe(650);
    // Bob has no tenancy
    expect(bob?.current_tenancy).toBeNull();
  });
});

describe('useCreateTenantV2', () => {
  it('stamps org_id on insert', async () => {
    const { useCreateTenantV2 } = await import('@/hooks/useTenantsV2');
    const { result } = renderAppHook(() => useCreateTenantV2());

    await act(async () => {
      await result.current.mutateAsync({
        first_name: 'New', last_name: 'Tenant', email: null, phone: null,
        date_of_birth: null, national_insurance: null, referral_source: null,
        tenant_type: 'private', status: 'prospective',
        emergency_contact_name: null, emergency_contact_phone: null, notes: null,
      });
    });

    const insertCall = mock.__calls.find((c) => c.op === 'insert' && c.table === 'tenants_v2');
    expect((insertCall?.payload as { org_id?: string })?.org_id).toBe('org-1');
    expect((insertCall?.payload as { first_name?: string })?.first_name).toBe('New');
  });
});

describe('useUpdateTenantV2', () => {
  it('updates by id and strips id from payload', async () => {
    const { useUpdateTenantV2 } = await import('@/hooks/useTenantsV2');
    const { result } = renderAppHook(() => useUpdateTenantV2());

    await act(async () => {
      await result.current.mutateAsync({ id: 't1', status: 'in_notice' });
    });

    const updateCall = mock.__calls.find((c) => c.op === 'update' && c.table === 'tenants_v2');
    expect(updateCall?.filters.id).toEqual({ eq: 't1' });
    expect((updateCall?.payload as { id?: string })?.id).toBeUndefined();
    expect((updateCall?.payload as { status?: string })?.status).toBe('in_notice');
  });
});
