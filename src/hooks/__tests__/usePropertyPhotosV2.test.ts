/**
 * Regression tests for usePropertyPhotosV2 - bridges V2 properties to V1
 * cover photos via postcode + address-prefix matching. This matching logic
 * is brittle and must be preserved during consolidation.
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
}));

describe('usePropertyPhotosV2', () => {
  beforeEach(() => {
    mock = createMockSupabase(({ table, op, filters }) => {
      if (table === 'properties_v2' && op === 'select') {
        return {
          data: [
            { id: 'v2-1', address_line_1: '10 High Street', postcode: 'OX1 1AA' },
            { id: 'v2-2', address_line_1: '5 Low Rd', postcode: 'OX2 2BB' },
            { id: 'v2-3', address_line_1: 'No Match Ave', postcode: 'ZZ9 9ZZ' },
          ],
          error: null,
        };
      }
      if (table === 'properties' && op === 'select') {
        return {
          data: [
            { id: 'v1-1', address_line: '10 High Street, Oxford', postcode: 'OX1 1AA' },
            { id: 'v1-2', address_line: '5 Low Road', postcode: 'OX2 2BB' },
          ],
          error: null,
        };
      }
      if (table === 'photos' && op === 'select') {
        const isCover = filters.is_cover as { eq: boolean } | undefined;
        if (isCover?.eq === true) {
          return {
            data: [
              { property_id: 'v1-1', file_url: 'p/v1-1/cover.jpg', is_cover: true },
              { property_id: 'v1-2', file_url: 'p/v1-2/cover.jpg', is_cover: true },
            ],
            error: null,
          };
        }
      }
      return { data: [], error: null };
    });
  });

  it('matches V2 -> V1 via (postcode, first address segment) and returns signed URLs', async () => {
    const { usePropertyPhotosV2 } = await import('@/hooks/usePropertyPhotosV2');
    const { result } = renderAppHook(() => usePropertyPhotosV2());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const photoMap = result.current.data;
    expect(photoMap).toBeInstanceOf(Map);

    // v2-1 "10 High Street" in OX1 1AA -> matches v1-1 -> signed URL
    expect(photoMap?.get('v2-1')).toBe('https://signed.test/p/v1-1/cover.jpg');
    // v2-3 has no postcode match at all -> absent
    expect(photoMap?.has('v2-3')).toBe(false);
  });

  it('returns an empty map when there are no cover photos', async () => {
    // Override the photos branch to return empty
    mock = createMockSupabase(({ table, op }) => {
      if (table === 'properties_v2' && op === 'select') {
        return { data: [{ id: 'v2-1', address_line_1: 'X', postcode: 'X' }], error: null };
      }
      if (table === 'properties' && op === 'select') {
        return { data: [{ id: 'v1-1', address_line: 'X', postcode: 'X' }], error: null };
      }
      if (table === 'photos' && op === 'select') {
        return { data: [], error: null };
      }
      return { data: [], error: null };
    });

    const { usePropertyPhotosV2 } = await import('@/hooks/usePropertyPhotosV2');
    const { result } = renderAppHook(() => usePropertyPhotosV2());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.size).toBe(0);
  });
});
