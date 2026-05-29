/**
 * Regression tests for useBulkEpcEnrichV2.
 *
 * Thin wrapper around the `bulk-epc-enrich-v2` edge function — tests just
 * verify it passes the mode through and surfaces errors via toast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderAppHook } from '@/test/renderHook';
import { createMockSupabase, type MockSupabase } from './supabaseMock';

let mock: MockSupabase;
const toastSpy = vi.fn();
const toastSuccessSpy = vi.fn();
const toastErrorSpy = vi.fn();
Object.assign(toastSpy, { success: toastSuccessSpy, error: toastErrorSpy });

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mock;
  },
  get supabaseAny() { return mock; },
}));

vi.mock('sonner', () => ({
  toast: toastSpy,
}));

beforeEach(() => {
  toastSpy.mockReset();
  toastSuccessSpy.mockReset();
  toastErrorSpy.mockReset();
  Object.assign(toastSpy, { success: toastSuccessSpy, error: toastErrorSpy });
  mock = createMockSupabase(() => ({ data: null, error: null }));
});

describe('useBulkEpcEnrichV2', () => {
  it('invokes bulk-epc-enrich-v2 with the given mode and toasts success', async () => {
    mock.functions.invoke.mockResolvedValueOnce({
      data: { success: true, updated: 10, failed: 0, total: 10 },
      error: null,
    });

    const { useBulkEpcEnrichV2 } = await import('@/hooks/useBulkEpcEnrichV2');
    const { result } = renderAppHook(() => useBulkEpcEnrichV2());

    await act(async () => {
      await result.current.enrichAll('all');
    });

    expect(mock.functions.invoke).toHaveBeenCalledWith('bulk-epc-enrich-v2', {
      body: { mode: 'all' },
    });
    expect(toastSpy).toHaveBeenCalledWith(
      'EPC Enrichment Complete',
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('defaults mode to "missing-only" when called with no args', async () => {
    mock.functions.invoke.mockResolvedValueOnce({
      data: { success: true, updated: 0, failed: 0, total: 0 },
      error: null,
    });

    const { useBulkEpcEnrichV2 } = await import('@/hooks/useBulkEpcEnrichV2');
    const { result } = renderAppHook(() => useBulkEpcEnrichV2());

    await act(async () => {
      await result.current.enrichAll();
    });

    expect(mock.functions.invoke).toHaveBeenCalledWith('bulk-epc-enrich-v2', {
      body: { mode: 'missing-only' },
    });
  });

  it('surfaces the error message via destructive toast when data.success is false', async () => {
    mock.functions.invoke.mockResolvedValueOnce({
      data: { success: false, error: 'API quota exceeded' },
      error: null,
    });

    const { useBulkEpcEnrichV2 } = await import('@/hooks/useBulkEpcEnrichV2');
    const { result } = renderAppHook(() => useBulkEpcEnrichV2());

    await act(async () => {
      await result.current.enrichAll();
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'EPC Enrichment Failed',
        description: 'API quota exceeded',
        variant: 'destructive',
      }),
    );
  });
});
