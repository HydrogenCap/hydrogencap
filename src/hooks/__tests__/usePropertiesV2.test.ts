/**
 * Regression tests for usePropertiesV2 — the V2 property hook.
 *
 * Locks in the behaviour the V1 consumers rely on after consolidation:
 *   - list query flattens `legal_entities!inner(...)` into entity_name/type
 *   - single query respects `enabled: !!id`
 *   - mutations stamp `org_id` on insert and target `properties_v2`
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
  get supabaseAny() { return mock; },
}));

vi.mock('@/hooks/useUserOrg', () => ({
  fetchUserOrgId: vi.fn(async () => 'org-1'),
  useUserOrg: () => ({ data: 'org-1', isLoading: false }),
}));

beforeEach(() => {
  mock = createMockSupabase(({ table, op, filters }) => {
    if (table === 'properties_v2' && op === 'select') {
      const idFilter = filters.id as { eq: string } | undefined;
      const entityFilter = filters.entity_id as { eq: string } | undefined;

      const allRows = [
        {
          id: 'p1',
          org_id: 'org-1',
          entity_id: 'e1',
          address_line_1: '10 High St',
          address_line_2: null,
          city: 'Oxford',
          postcode: 'OX1 1AA',
          property_type: 'hmo_licensed',
          lifecycle_stage: 'stabilised',
          listing_grade: 'none',
          rent_basis: 'room',
          legal_entities: { entity_name: 'Acme Ltd', entity_type: 'ltd' },
        },
        {
          id: 'p2',
          org_id: 'org-1',
          entity_id: 'e2',
          address_line_1: '5 Low Rd',
          address_line_2: null,
          city: 'Witney',
          postcode: 'OX2 2BB',
          property_type: 'single_let',
          lifecycle_stage: 'letting',
          listing_grade: 'none',
          rent_basis: 'whole_house',
          legal_entities: { entity_name: 'Beta LLP', entity_type: 'llp' },
        },
      ];

      if (idFilter) {
        const row = allRows.find((r) => r.id === idFilter.eq) ?? null;
        return { data: row, error: null };
      }
      if (entityFilter) {
        const rows = allRows.filter((r) => r.entity_id === entityFilter.eq);
        return { data: rows, error: null };
      }
      return { data: allRows, error: null };
    }

    if (table === 'properties_v2' && op === 'insert') {
      return { data: { id: 'p-new', ...(filters as object), ...(mock.__lastCall()?.payload as object ?? {}) }, error: null };
    }

    if (table === 'properties_v2' && op === 'update') {
      return { data: { id: 'p1', ...(mock.__lastCall()?.payload as object ?? {}) }, error: null };
    }

    if (table === 'properties_v2' && op === 'delete') {
      return { data: null, error: null };
    }

    return { data: null, error: null };
  });
});

describe('usePropertiesV2', () => {
  it('returns properties with flattened entity_name/entity_type', async () => {
    const { usePropertiesV2 } = await import('@/hooks/usePropertiesV2');
    const { result } = renderAppHook(() => usePropertiesV2());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].entity_name).toBe('Acme Ltd');
    expect(result.current.data?.[0].entity_type).toBe('ltd');
    // legal_entities is stripped
    expect((result.current.data?.[0] as unknown as { legal_entities?: unknown }).legal_entities).toBeUndefined();
  });
});

describe('usePropertyV2', () => {
  it('is disabled when id is undefined', async () => {
    const { usePropertyV2 } = await import('@/hooks/usePropertiesV2');
    const { result } = renderAppHook(() => usePropertyV2(undefined));

    // No fetch should fire
    expect(result.current.fetchStatus).toBe('idle');
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('returns a single flattened property for a valid id', async () => {
    const { usePropertyV2 } = await import('@/hooks/usePropertiesV2');
    const { result } = renderAppHook(() => usePropertyV2('p1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe('p1');
    expect(result.current.data?.entity_name).toBe('Acme Ltd');
  });
});

describe('useEntityPropertiesV2', () => {
  it('filters properties by entity_id', async () => {
    const { useEntityPropertiesV2 } = await import('@/hooks/usePropertiesV2');
    const { result } = renderAppHook(() => useEntityPropertiesV2('e1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe('p1');
  });
});

describe('useCreatePropertyV2', () => {
  it('stamps org_id on insert payload', async () => {
    const { useCreatePropertyV2 } = await import('@/hooks/usePropertiesV2');
    const { result } = renderAppHook(() => useCreatePropertyV2());

    await act(async () => {
      await result.current.mutateAsync({
        entity_id: 'e1',
        address_line_1: 'New Place',
        address_line_2: null,
        city: 'London',
        county: null,
        postcode: 'E1 1AA',
        country: 'United Kingdom',
        property_type: 'single_let',
        lifecycle_stage: 'pipeline',
        council_name: null,
        council_area: null,
        listing_grade: 'none',
        rent_basis: 'whole_house',
        whole_house_rent_pcm: null,
        has_gas_supply: null,
        year_built: null,
        total_floors: null,
        total_lettable_rooms: null,
        purchase_date: null,
        purchase_price: null,
        current_valuation: null,
        valuation_date: null,
        latitude: null,
        longitude: null,
        notes: null,
      });
    });

    const insertCall = mock.__calls.find((c) => c.op === 'insert' && c.table === 'properties_v2');
    expect(insertCall).toBeDefined();
    expect((insertCall?.payload as { org_id?: string })?.org_id).toBe('org-1');
    expect((insertCall?.payload as { address_line_1?: string })?.address_line_1).toBe('New Place');
  });
});

describe('useUpdatePropertyV2', () => {
  it('sends partial payload with id filter and DOES NOT include id in the payload', async () => {
    const { useUpdatePropertyV2 } = await import('@/hooks/usePropertiesV2');
    const { result } = renderAppHook(() => useUpdatePropertyV2());

    await act(async () => {
      await result.current.mutateAsync({ id: 'p1', current_valuation: 400_000 });
    });

    const updateCall = mock.__calls.find((c) => c.op === 'update' && c.table === 'properties_v2');
    expect(updateCall).toBeDefined();
    expect(updateCall?.filters.id).toEqual({ eq: 'p1' });
    // The hook must strip id out of the payload (otherwise Postgres errors)
    expect((updateCall?.payload as { id?: string })?.id).toBeUndefined();
    expect((updateCall?.payload as { current_valuation?: number })?.current_valuation).toBe(400_000);
  });
});

describe('useDeletePropertyV2', () => {
  it('deletes by id', async () => {
    const { useDeletePropertyV2 } = await import('@/hooks/usePropertiesV2');
    const { result } = renderAppHook(() => useDeletePropertyV2());

    await act(async () => {
      await result.current.mutateAsync('p1');
    });

    const deleteCall = mock.__calls.find((c) => c.op === 'delete' && c.table === 'properties_v2');
    expect(deleteCall).toBeDefined();
    expect(deleteCall?.filters.id).toEqual({ eq: 'p1' });
  });
});
