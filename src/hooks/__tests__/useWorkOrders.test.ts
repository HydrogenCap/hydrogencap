/**
 * Regression tests for useCompleteWorkOrder.
 *
 * Locks in the behaviour of the snapshot sync path added to fix the TODO:
 *   - when completing a WO with cost > 0 and a property, we upsert
 *     financial_snapshots.maintenance_costs for the property's current month
 *   - if a snapshot already exists for that (property, month), we ADD to its
 *     maintenance_costs (don't overwrite)
 *   - if the WO was already completed, we skip the sync (no double-counting)
 *   - if the WO has no property, we skip the sync
 *   - if cost is zero, we skip the sync
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderAppHook } from '@/test/renderHook';
import { createMockSupabase, type MockSupabase } from './supabaseMock';

let mock: MockSupabase;

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mock;
  },
  get supabaseAny() { return mock; },
}));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

vi.mock('@/hooks/useUserOrg', () => ({
  useUserOrg: () => ({ data: 'org-1', isLoading: false }),
  fetchUserOrgId: vi.fn(async () => 'org-1'),
}));

// Per-test state that the supabase mock handler reads.
let workOrder: { org_id: string; entity_id: string; property_id: string | null; status: string } | null;
let existingSnapshot: { id: string; maintenance_costs: number } | null;
let workOrderCosts: { amount: number; vat_amount: number | null }[];

beforeEach(() => {
  workOrder = { org_id: 'org-1', entity_id: 'ent-1', property_id: 'prop-1', status: 'in_progress' };
  existingSnapshot = null;
  workOrderCosts = [];

  mock = createMockSupabase(({ table, op, columns }) => {
    if (table === 'work_orders' && op === 'select') {
      return { data: workOrder, error: null };
    }
    if (table === 'work_orders' && op === 'update') {
      return { data: null, error: null };
    }
    if (table === 'work_order_costs' && op === 'select') {
      return { data: workOrderCosts, error: null };
    }
    if (table === 'financial_snapshots' && op === 'select') {
      return { data: existingSnapshot, error: null };
    }
    if (table === 'financial_snapshots' && (op === 'insert' || op === 'update')) {
      return { data: null, error: null };
    }
    // Unused in these tests but some paths probe other tables.
    void columns;
    return { data: null, error: null };
  });
});

function thisMonthFirst() {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

describe('useCompleteWorkOrder', () => {
  it('updates the WO status to completed with the actual cost', async () => {
    const { useCompleteWorkOrder } = await import('@/hooks/useWorkOrders');
    const { result } = renderAppHook(() => useCompleteWorkOrder());

    await act(async () => {
      await result.current.mutateAsync({ id: 'wo-1', actualCost: 250 });
    });

    const woUpdate = mock.__calls.find((c) => c.table === 'work_orders' && c.op === 'update');
    expect(woUpdate).toBeDefined();
    expect((woUpdate?.payload as { status?: string }).status).toBe('completed');
    expect((woUpdate?.payload as { actual_cost?: number }).actual_cost).toBe(250);
    expect(woUpdate?.filters.id).toEqual({ eq: 'wo-1' });
  });

  it('inserts a new financial_snapshots row when none exists for the month', async () => {
    const { useCompleteWorkOrder } = await import('@/hooks/useWorkOrders');
    const { result } = renderAppHook(() => useCompleteWorkOrder());

    await act(async () => {
      await result.current.mutateAsync({ id: 'wo-1', actualCost: 250 });
    });

    const snapInsert = mock.__calls.find(
      (c) => c.table === 'financial_snapshots' && c.op === 'insert',
    );
    expect(snapInsert).toBeDefined();
    expect(snapInsert?.payload).toMatchObject({
      org_id: 'org-1',
      entity_id: 'ent-1',
      property_id: 'prop-1',
      snapshot_month: thisMonthFirst(),
      maintenance_costs: 250,
    });
  });

  it('adds to existing maintenance_costs when a snapshot already exists', async () => {
    existingSnapshot = { id: 'snap-1', maintenance_costs: 100 };
    const { useCompleteWorkOrder } = await import('@/hooks/useWorkOrders');
    const { result } = renderAppHook(() => useCompleteWorkOrder());

    await act(async () => {
      await result.current.mutateAsync({ id: 'wo-1', actualCost: 250 });
    });

    const snapUpdate = mock.__calls.find(
      (c) => c.table === 'financial_snapshots' && c.op === 'update',
    );
    expect(snapUpdate).toBeDefined();
    expect((snapUpdate?.payload as { maintenance_costs?: number }).maintenance_costs).toBe(350);
    expect(snapUpdate?.filters.id).toEqual({ eq: 'snap-1' });

    const snapInsert = mock.__calls.find(
      (c) => c.table === 'financial_snapshots' && c.op === 'insert',
    );
    expect(snapInsert).toBeUndefined();
  });

  it('skips the snapshot sync when the WO was already completed', async () => {
    workOrder = { org_id: 'org-1', entity_id: 'ent-1', property_id: 'prop-1', status: 'completed' };
    const { useCompleteWorkOrder } = await import('@/hooks/useWorkOrders');
    const { result } = renderAppHook(() => useCompleteWorkOrder());

    await act(async () => {
      await result.current.mutateAsync({ id: 'wo-1', actualCost: 250 });
    });

    const touchedSnapshots = mock.__calls.some(
      (c) => c.table === 'financial_snapshots' && (c.op === 'insert' || c.op === 'update'),
    );
    expect(touchedSnapshots).toBe(false);
  });

  it('skips the snapshot sync when the WO has no property', async () => {
    workOrder = { org_id: 'org-1', entity_id: 'ent-1', property_id: null, status: 'in_progress' };
    const { useCompleteWorkOrder } = await import('@/hooks/useWorkOrders');
    const { result } = renderAppHook(() => useCompleteWorkOrder());

    await act(async () => {
      await result.current.mutateAsync({ id: 'wo-1', actualCost: 250 });
    });

    const touchedSnapshots = mock.__calls.some(
      (c) => c.table === 'financial_snapshots' && (c.op === 'insert' || c.op === 'update'),
    );
    expect(touchedSnapshots).toBe(false);
  });

  it('skips the snapshot sync when cost is zero', async () => {
    const { useCompleteWorkOrder } = await import('@/hooks/useWorkOrders');
    const { result } = renderAppHook(() => useCompleteWorkOrder());

    await act(async () => {
      await result.current.mutateAsync({ id: 'wo-1', actualCost: 0 });
    });

    const touchedSnapshots = mock.__calls.some(
      (c) => c.table === 'financial_snapshots' && (c.op === 'insert' || c.op === 'update'),
    );
    expect(touchedSnapshots).toBe(false);
  });

  it('computes cost from non-estimated work_order_costs when actualCost is not passed', async () => {
    workOrderCosts = [
      { amount: 100, vat_amount: 20 },
      { amount: 50, vat_amount: null },
      { amount: 30, vat_amount: 6 },
    ];
    const { useCompleteWorkOrder } = await import('@/hooks/useWorkOrders');
    const { result } = renderAppHook(() => useCompleteWorkOrder());

    await act(async () => {
      await result.current.mutateAsync({ id: 'wo-1' });
    });

    const woUpdate = mock.__calls.find((c) => c.table === 'work_orders' && c.op === 'update');
    // (100 + 20) + (50 + 0) + (30 + 6) = 206
    expect((woUpdate?.payload as { actual_cost?: number }).actual_cost).toBe(206);

    const snapInsert = mock.__calls.find(
      (c) => c.table === 'financial_snapshots' && c.op === 'insert',
    );
    expect((snapInsert?.payload as { maintenance_costs?: number }).maintenance_costs).toBe(206);
  });
});
