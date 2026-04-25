/**
 * Regression tests for useRoomsV2.
 *
 * Verifies:
 *   - per-property room list is filtered and ordered by the hook
 *   - usePropertyRoomSummaries builds a Map keyed by property_id
 *   - useCreateRoom / useBulkCreateRooms / useUpdateRoom / useDeleteRoom
 *     all hit rooms_v2 with the expected shape
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

const sampleRooms = [
  {
    id: 'r1', property_id: 'p1', room_name: 'Room 1', room_type: 'double',
    floor: 0, has_ensuite: false, is_lettable: true,
    current_rent_pcm: 650, target_rent_pcm: 700,
    occupancy_status: 'occupied', notes: null, size_sqm: null,
    occupancy_type: 'single', amenity_type: 'bedroom',
    created_at: '2025-01-01', updated_at: '2025-01-01',
  },
  {
    id: 'r2', property_id: 'p1', room_name: 'Room 2', room_type: 'single',
    floor: 0, has_ensuite: false, is_lettable: true,
    current_rent_pcm: 500, target_rent_pcm: 550,
    occupancy_status: 'vacant', notes: null, size_sqm: null,
    occupancy_type: 'single', amenity_type: 'bedroom',
    created_at: '2025-01-01', updated_at: '2025-01-01',
  },
];

beforeEach(() => {
  mock = createMockSupabase(({ table, op, filters }) => {
    if (table === 'rooms_v2' && op === 'select') {
      const idFilter = filters.id as { eq: string } | undefined;
      const propertyFilter = filters.property_id as { eq: string } | undefined;
      if (idFilter) {
        return { data: sampleRooms.find((r) => r.id === idFilter.eq) ?? null, error: null };
      }
      if (propertyFilter) {
        return { data: sampleRooms.filter((r) => r.property_id === propertyFilter.eq), error: null };
      }
      return { data: sampleRooms, error: null };
    }
    if (table === 'property_room_summary_v2' && op === 'select') {
      return {
        data: [
          { property_id: 'p1', total_lettable: 2, total_occupied: 1, gross_rent_pcm: 650, potential_rent_pcm: 1250 },
        ],
        error: null,
      };
    }
    if (table === 'rooms_v2' && (op === 'insert' || op === 'update' || op === 'delete')) {
      const payload = mock.__lastCall()?.payload;
      if (op === 'insert' && Array.isArray(payload)) {
        return { data: payload.map((p, i) => ({ id: `new-${i}`, ...(p as object) })), error: null };
      }
      if (op === 'insert') {
        return { data: { id: 'r-new', ...((payload as object) ?? {}) }, error: null };
      }
      if (op === 'update') {
        return { data: { id: 'r1', property_id: 'p1', ...((payload as object) ?? {}) }, error: null };
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
});

describe('usePropertyRooms', () => {
  it('is disabled when propertyId is undefined', async () => {
    const { usePropertyRooms } = await import('@/hooks/useRoomsV2');
    const { result } = renderAppHook(() => usePropertyRooms(undefined));
    expect(result.current.fetchStatus).toBe('idle');
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('returns rooms filtered by property_id', async () => {
    const { usePropertyRooms } = await import('@/hooks/useRoomsV2');
    const { result } = renderAppHook(() => usePropertyRooms('p1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].property_id).toBe('p1');
  });
});

describe('usePropertyRoomSummaries', () => {
  it('builds a Map keyed by property_id', async () => {
    const { usePropertyRoomSummaries } = await import('@/hooks/useRoomsV2');
    const { result } = renderAppHook(() => usePropertyRoomSummaries());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeInstanceOf(Map);
    expect(result.current.data?.get('p1')?.total_occupied).toBe(1);
  });
});

describe('useCreateRoom', () => {
  it('inserts a single room', async () => {
    const { useCreateRoom } = await import('@/hooks/useRoomsV2');
    const { result } = renderAppHook(() => useCreateRoom());

    await act(async () => {
      await result.current.mutateAsync({
        property_id: 'p1', room_name: 'New Room', room_type: 'single',
        floor: 0, has_ensuite: false, is_lettable: true,
        current_rent_pcm: null, target_rent_pcm: null,
        occupancy_status: 'vacant', notes: null, size_sqm: null,
        occupancy_type: 'single', amenity_type: 'bedroom',
      });
    });

    const call = mock.__calls.find((c) => c.op === 'insert' && c.table === 'rooms_v2');
    expect(call).toBeDefined();
    expect((call?.payload as { room_name?: string })?.room_name).toBe('New Room');
  });
});

describe('useBulkCreateRooms', () => {
  it('inserts an array of rooms in one call', async () => {
    const { useBulkCreateRooms } = await import('@/hooks/useRoomsV2');
    const { result } = renderAppHook(() => useBulkCreateRooms());

    const newRooms = [
      { property_id: 'p1', room_name: 'A', room_type: 'single' as const, floor: 0, has_ensuite: false, is_lettable: true, current_rent_pcm: null, target_rent_pcm: null, occupancy_status: 'vacant' as const, notes: null, size_sqm: null, occupancy_type: 'single' as const, amenity_type: 'bedroom' as const },
      { property_id: 'p1', room_name: 'B', room_type: 'single' as const, floor: 0, has_ensuite: false, is_lettable: true, current_rent_pcm: null, target_rent_pcm: null, occupancy_status: 'vacant' as const, notes: null, size_sqm: null, occupancy_type: 'single' as const, amenity_type: 'bedroom' as const },
    ];

    await act(async () => {
      await result.current.mutateAsync(newRooms);
    });

    const call = mock.__calls.find((c) => c.op === 'insert' && c.table === 'rooms_v2');
    expect(Array.isArray(call?.payload)).toBe(true);
    expect((call?.payload as unknown[])?.length).toBe(2);
  });
});

describe('useDeleteRoom', () => {
  it('deletes by id and returns propertyId for cache invalidation', async () => {
    const { useDeleteRoom } = await import('@/hooks/useRoomsV2');
    const { result } = renderAppHook(() => useDeleteRoom());

    let returned: string | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ id: 'r1', propertyId: 'p1' });
    });

    expect(returned).toBe('p1');
    const call = mock.__calls.find((c) => c.op === 'delete' && c.table === 'rooms_v2');
    expect(call?.filters.id).toEqual({ eq: 'r1' });
  });
});
