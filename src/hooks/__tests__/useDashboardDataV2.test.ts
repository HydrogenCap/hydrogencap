/**
 * Regression tests for useDashboardDataV2 — the bridge hook.
 *
 * This file locks in the V2 → V1 `PropertyWithFinancials` mapping that
 * dashboard components depend on. If the consolidation work changes the
 * shape, these tests fail loudly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderAppHook } from '@/test/renderHook';
import { createMockSupabase, type MockSupabase } from './supabaseMock';

let mock: MockSupabase;

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mock;
  },
  get supabaseAny() { return mock; },
}));

vi.mock('@/hooks/useUserOrg', () => ({
  useUserOrg: () => ({ data: 'org-1', isLoading: false }),
  fetchUserOrgId: vi.fn(async () => 'org-1'),
}));

beforeEach(() => {
  mock = createMockSupabase(({ table, op }) => {
    if (table === 'properties_v2' && op === 'select') {
      return {
        data: [
          {
            id: 'p1',
            org_id: 'org-1',
            address_line_1: '10 High St',
            address_line_2: null,
            city: 'Oxford',
            county: 'Oxon',
            postcode: 'OX1 1AA',
            latitude: 51.7,
            longitude: -1.2,
            property_type: 'hmo_licensed',
            lifecycle_stage: 'stabilised',
            listing_grade: 'none',
            purchase_date: '2022-01-01',
            purchase_price: 280_000,
            current_valuation: 350_000,
            total_lettable_rooms: 4,
            epc_rating: 'C',
            created_at: '2022-01-01',
            updated_at: '2025-01-01',
            legal_entities: { entity_name: 'Acme', entity_type: 'ltd' },
          },
        ],
        error: null,
      };
    }
    if (table === 'loan_facilities' && op === 'select') {
      return {
        data: [
          {
            id: 'l1',
            property_id: 'p1',
            org_id: 'org-1',
            current_balance: 200_000,
            interest_rate: 5.25,
            interest_only: true,
            rate_expiry_date: '2028-06-01',
            monthly_payment: 875,
            status: 'active',
            created_at: '2022-01-01',
            updated_at: '2025-01-01',
            lenders: { lender_name: 'MegaBank' },
          },
        ],
        error: null,
      };
    }
    if (table === 'tenancy_agreements' && op === 'select') {
      return {
        data: [
          {
            id: 'a1',
            property_id: 'p1',
            room_id: 'r1',
            tenant_id: 't1',
            rent_amount_pcm: 650,
            start_date: '2025-06-01',
            initial_end_date: '2026-06-01',
            actual_end_date: null,
            status: 'active',
            tenants_v2: { first_name: 'Alice', last_name: 'Smith' },
            rooms_v2: { room_name: 'Room 1' },
            properties_v2: { address_line_1: '10 High St' },
          },
          {
            id: 'a2',
            property_id: 'p1',
            room_id: 'r2',
            tenant_id: 't2',
            rent_amount_pcm: 500,
            start_date: '2025-06-01',
            initial_end_date: '2026-06-01',
            actual_end_date: null,
            status: 'active',
            tenants_v2: { first_name: 'Bob', last_name: 'Jones' },
            rooms_v2: { room_name: 'Room 2' },
            properties_v2: { address_line_1: '10 High St' },
          },
        ],
        error: null,
      };
    }
    if (table === 'rooms_v2' && op === 'select') {
      return {
        data: [
          { id: 'r1', property_id: 'p1', room_name: 'Room 1', occupancy_status: 'occupied', is_lettable: true },
          { id: 'r2', property_id: 'p1', room_name: 'Room 2', occupancy_status: 'vacant', is_lettable: true },
        ],
        error: null,
      };
    }
    return { data: null, error: null };
  });
});

describe('useDashboardPropertiesV2', () => {
  it('maps V2 into V1 PropertyWithFinancials shape with derived fields', async () => {
    const { useDashboardPropertiesV2 } = await import('@/hooks/useDashboardDataV2');
    const { result } = renderAppHook(() => useDashboardPropertiesV2());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The hook casts its result through `as unknown as PropertyWithFinancials`
    // and tacks on `city` and `entity_name` fields at runtime. This test asserts
    // that runtime contract, so we widen the type locally.
    const prop = result.current.data?.[0] as
      | (NonNullable<typeof result.current.data>[number] & { city?: string | null; entity_name?: string | null })
      | undefined;
    expect(prop).toBeDefined();

    // V1 shape invariants
    expect(prop?.address_line).toBe('10 High St'); // no address_line_2 suffix
    expect(prop?.postcode).toBe('OX1 1AA');
    expect(prop?.city).toBe('Oxford');
    expect(prop?.current_value_gbp).toBe(350_000);
    expect(prop?.purchase_price_gbp).toBe(280_000);
    expect(prop?.beds).toBe(4);
    expect(prop?.entity_name).toBe('Acme');

    // HMO inference from property_type prefix
    expect(prop?.is_hmo_licensed).toBe(true);

    // lifecycle_stage -> lifecycle_type mapping
    expect(prop?.lifecycle_type).toBe('core_rental');

    // Loan rolled up with interest_only -> 'interest'
    expect(prop?.loans).toHaveLength(1);
    expect(prop?.loans?.[0].current_mortgage_balance_gbp).toBe(200_000);
    expect(prop?.loans?.[0].capital_or_interest).toBe('interest');
    expect(prop?.loans?.[0].lender).toBe('MegaBank');

    // Annual rent computed from summed monthly tenancies (650 + 500) * 12 = 13_800
    expect(prop?.income?.[0]?.annual_rent_gbp).toBe(13_800);
  });
});

describe('useDashboardTenanciesV2', () => {
  it('flattens nested relations into tenant/room/property objects', async () => {
    const { useDashboardTenanciesV2 } = await import('@/hooks/useDashboardDataV2');
    const { result } = renderAppHook(() => useDashboardTenanciesV2());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const tenancy = result.current.data?.find((t) => t.id === 'a1');
    expect(tenancy?.tenant.first_name).toBe('Alice');
    expect(tenancy?.tenant.last_name).toBe('Smith');
    expect(tenancy?.room.room_name).toBe('Room 1');
    expect(tenancy?.property.address_line).toBe('10 High St');
    // end_date falls back to initial_end_date when actual_end_date is null
    expect(tenancy?.end_date).toBe('2026-06-01');
  });
});

describe('useDashboardRoomsV2', () => {
  it('derives a binary occupied/vacant status from occupancy_status', async () => {
    const { useDashboardRoomsV2 } = await import('@/hooks/useDashboardDataV2');
    const { result } = renderAppHook(() => useDashboardRoomsV2());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    const occupied = result.current.data?.find((r) => r.id === 'r1');
    const vacant = result.current.data?.find((r) => r.id === 'r2');
    expect((occupied as unknown as { status: string }).status).toBe('occupied');
    expect((vacant as unknown as { status: string }).status).toBe('vacant');
  });
});
