import { describe, it, expect, vi } from 'vitest';
import {
  isTerminalStatus,
  snapshotMonthFromDate,
  sumMaintenanceCosts,
  syncWorkOrderToFinancialSnapshot,
  TERMINAL_WO_STATUSES,
} from './workOrderFinancialSync';

describe('workOrderFinancialSync — pure helpers', () => {
  describe('isTerminalStatus', () => {
    it('matches the exported TERMINAL_WO_STATUSES list', () => {
      for (const s of TERMINAL_WO_STATUSES) {
        expect(isTerminalStatus(s)).toBe(true);
      }
    });

    it.each(['draft', 'submitted', 'approved', 'rejected', 'in_progress', 'cancelled'] as const)(
      'returns false for non-terminal status %s',
      (s) => {
        expect(isTerminalStatus(s)).toBe(false);
      }
    );
  });

  describe('snapshotMonthFromDate', () => {
    it('returns first of month for a mid-month date', () => {
      expect(snapshotMonthFromDate('2026-04-16')).toBe('2026-04-01');
    });

    it('handles ISO timestamps', () => {
      expect(snapshotMonthFromDate('2026-12-31T23:59:59Z')).toBe('2026-12-01');
    });

    it('returns null for null/undefined/empty', () => {
      expect(snapshotMonthFromDate(null)).toBeNull();
      expect(snapshotMonthFromDate(undefined)).toBeNull();
      expect(snapshotMonthFromDate('')).toBeNull();
    });

    it('returns null for unparseable input', () => {
      expect(snapshotMonthFromDate('not-a-date')).toBeNull();
    });
  });

  describe('sumMaintenanceCosts', () => {
    it('sums actual_cost values', () => {
      expect(sumMaintenanceCosts([{ actual_cost: 100 }, { actual_cost: 250.5 }])).toBe(350.5);
    });

    it('treats null as zero', () => {
      expect(sumMaintenanceCosts([{ actual_cost: 100 }, { actual_cost: null }])).toBe(100);
    });

    it('returns 0 for an empty list', () => {
      expect(sumMaintenanceCosts([])).toBe(0);
    });
  });
});

// ── Integration-style tests with a stubbed supabase client ──────────────

type FinancialSnapshotRow = { id: string; is_locked: boolean };
type WorkOrderCostRow = { actual_cost: number | null };

interface StubDataset {
  snapshot: FinancialSnapshotRow | null;
  workOrders: WorkOrderCostRow[];
  readError?: Error;
  woError?: Error;
  upsertError?: Error;
}

function makeStubSupabase(dataset: StubDataset) {
  const upsertCalls: { values: Record<string, unknown>; opts: { onConflict: string } }[] = [];

  const snapshotReader = {
    maybeSingle: () => Promise.resolve({ data: dataset.snapshot, error: dataset.readError ?? null }),
  };

  const woReader = {
    data: dataset.workOrders,
    error: dataset.woError ?? null,
  };

  const client = {
    from: (table: string) => {
      if (table === 'financial_snapshots') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => snapshotReader,
            }),
          }),
          upsert: (values: Record<string, unknown>, opts: { onConflict: string }) => {
            upsertCalls.push({ values, opts });
            return Promise.resolve({ error: dataset.upsertError ?? null });
          },
        };
      }
      if (table === 'work_orders') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                gte: () => ({
                  lt: () => Promise.resolve(woReader),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table in stub: ${table}`);
    },
  };

  return { client: client as never, upsertCalls };
}

const baseInput = {
  workOrderId: 'wo-1',
  orgId: 'org-1',
  propertyId: 'prop-1',
  entityId: 'entity-1',
  actualCompletionDate: '2026-04-16',
};

describe('syncWorkOrderToFinancialSnapshot', () => {
  it('skips when the WO has no property', async () => {
    const { client, upsertCalls } = makeStubSupabase({ snapshot: null, workOrders: [] });
    const outcome = await syncWorkOrderToFinancialSnapshot(client, {
      ...baseInput,
      propertyId: null,
    });
    expect(outcome).toEqual({ status: 'skipped_no_property' });
    expect(upsertCalls).toHaveLength(0);
  });

  it('skips when the WO has no completion date', async () => {
    const { client, upsertCalls } = makeStubSupabase({ snapshot: null, workOrders: [] });
    const outcome = await syncWorkOrderToFinancialSnapshot(client, {
      ...baseInput,
      actualCompletionDate: null,
    });
    expect(outcome).toEqual({ status: 'skipped_no_completion_date' });
    expect(upsertCalls).toHaveLength(0);
  });

  it('does not write when the target snapshot is locked', async () => {
    const { client, upsertCalls } = makeStubSupabase({
      snapshot: { id: 'snap-1', is_locked: true },
      workOrders: [{ actual_cost: 500 }],
    });
    const outcome = await syncWorkOrderToFinancialSnapshot(client, baseInput);
    expect(outcome).toEqual({
      status: 'skipped_snapshot_locked',
      propertyId: 'prop-1',
      snapshotMonth: '2026-04-01',
    });
    expect(upsertCalls).toHaveLength(0);
  });

  it('upserts the summed terminal WO costs for the month', async () => {
    const { client, upsertCalls } = makeStubSupabase({
      snapshot: { id: 'snap-1', is_locked: false },
      workOrders: [{ actual_cost: 120.5 }, { actual_cost: 30 }, { actual_cost: null }],
    });
    const outcome = await syncWorkOrderToFinancialSnapshot(client, baseInput);
    expect(outcome).toEqual({
      status: 'synced',
      propertyId: 'prop-1',
      snapshotMonth: '2026-04-01',
      maintenanceCosts: 150.5,
    });
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toEqual({
      values: {
        org_id: 'org-1',
        property_id: 'prop-1',
        entity_id: 'entity-1',
        snapshot_month: '2026-04-01',
        maintenance_costs: 150.5,
      },
      opts: { onConflict: 'property_id,snapshot_month' },
    });
  });

  it('upserts zero when no terminal WOs remain in the month (WO cancelled/demoted)', async () => {
    const { client, upsertCalls } = makeStubSupabase({
      snapshot: { id: 'snap-1', is_locked: false },
      workOrders: [],
    });
    const outcome = await syncWorkOrderToFinancialSnapshot(client, baseInput);
    expect(outcome).toEqual({
      status: 'synced',
      propertyId: 'prop-1',
      snapshotMonth: '2026-04-01',
      maintenanceCosts: 0,
    });
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].values.maintenance_costs).toBe(0);
  });

  it('returns an error outcome when the upsert fails', async () => {
    const { client } = makeStubSupabase({
      snapshot: null,
      workOrders: [{ actual_cost: 100 }],
      upsertError: new Error('rls denied'),
    });
    const outcome = await syncWorkOrderToFinancialSnapshot(client, baseInput);
    expect(outcome).toEqual({ status: 'error', message: 'rls denied' });
  });

  it('returns an error outcome when the snapshot read fails', async () => {
    const { client } = makeStubSupabase({
      snapshot: null,
      workOrders: [],
      readError: new Error('network'),
    });
    const outcome = await syncWorkOrderToFinancialSnapshot(client, baseInput);
    expect(outcome).toEqual({ status: 'error', message: 'network' });
  });

  it('creates a new snapshot (no existing row) by upserting', async () => {
    const { client, upsertCalls } = makeStubSupabase({
      snapshot: null,
      workOrders: [{ actual_cost: 75 }],
    });
    const outcome = await syncWorkOrderToFinancialSnapshot(client, baseInput);
    expect(outcome.status).toBe('synced');
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].values.maintenance_costs).toBe(75);
  });

  it('month boundary: a late-March completion stays in March, not April', async () => {
    const { client, upsertCalls } = makeStubSupabase({
      snapshot: null,
      workOrders: [{ actual_cost: 200 }],
    });
    const outcome = await syncWorkOrderToFinancialSnapshot(client, {
      ...baseInput,
      actualCompletionDate: '2026-03-31',
    });
    expect(outcome).toMatchObject({ status: 'synced', snapshotMonth: '2026-03-01' });
    expect(upsertCalls[0].values.snapshot_month).toBe('2026-03-01');
  });
});

describe('syncWorkOrderToFinancialSnapshot — no unexpected tables', () => {
  it('does not query any table other than financial_snapshots and work_orders', async () => {
    const seen: string[] = [];
    const client = {
      from: (table: string) => {
        seen.push(table);
        if (table === 'financial_snapshots') {
          return {
            select: () => ({
              eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
            }),
            upsert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === 'work_orders') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({ gte: () => ({ lt: () => Promise.resolve({ data: [], error: null }) }) }),
              }),
            }),
          };
        }
        throw new Error(`unexpected: ${table}`);
      },
    };
    const spy = vi.spyOn(client, 'from');
    await syncWorkOrderToFinancialSnapshot(client as never, baseInput);
    expect(new Set(seen)).toEqual(new Set(['financial_snapshots', 'work_orders']));
    spy.mockRestore();
  });
});
