import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { WOStatus } from '@/hooks/useWorkOrders';

/**
 * Statuses at which a work order's actual_cost is considered final enough
 * to post to financial_snapshots.maintenance_costs.
 */
export const TERMINAL_WO_STATUSES: readonly WOStatus[] = [
  'completed',
  'invoiced',
  'closed',
] as const;

export function isTerminalStatus(status: WOStatus): boolean {
  return (TERMINAL_WO_STATUSES as readonly string[]).includes(status);
}

/**
 * Returns the ISO date (YYYY-MM-01) for the first day of the month
 * containing the given date. Returns null if input is not a parseable date.
 */
export function snapshotMonthFromDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

/**
 * Sum non-null actual_cost values. Pure helper.
 */
export function sumMaintenanceCosts(
  rows: readonly { actual_cost: number | null }[]
): number {
  return rows.reduce((sum, row) => sum + (row.actual_cost ?? 0), 0);
}

export type WorkOrderSyncOutcome =
  | { status: 'synced'; propertyId: string; snapshotMonth: string; maintenanceCosts: number }
  | { status: 'skipped_no_property' }
  | { status: 'skipped_no_completion_date' }
  | { status: 'skipped_snapshot_locked'; propertyId: string; snapshotMonth: string }
  | { status: 'error'; message: string };

interface SyncInput {
  workOrderId: string;
  orgId: string;
  propertyId: string | null;
  entityId: string;
  actualCompletionDate: string | null;
}

/**
 * Recompute financial_snapshots.maintenance_costs for the (property, month)
 * that a work order belongs to, summing actual_cost across every terminal WO
 * in that bucket. Treats a locked snapshot as a no-op (returns
 * 'skipped_snapshot_locked') so accountant-locked periods cannot be rewritten.
 *
 * Safe to call after any WO mutation that may change cost, status, or date.
 * Failures are returned as a result rather than thrown so callers can decide
 * whether to surface them — the WO mutation itself should not be rolled back.
 */
export async function syncWorkOrderToFinancialSnapshot(
  supabase: SupabaseClient<Database>,
  input: SyncInput
): Promise<WorkOrderSyncOutcome> {
  const { orgId, propertyId, entityId, actualCompletionDate } = input;

  if (!propertyId) return { status: 'skipped_no_property' };

  const snapshotMonth = snapshotMonthFromDate(actualCompletionDate);
  if (!snapshotMonth) return { status: 'skipped_no_completion_date' };

  const { data: existing, error: readErr } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (c: string, v: unknown) => {
          eq: (c: string, v: unknown) => {
            maybeSingle: () => Promise<{ data: { id: string; is_locked: boolean } | null; error: Error | null }>;
          };
        };
      };
    };
  })
    .from('financial_snapshots')
    .select('id, is_locked')
    .eq('property_id', propertyId)
    .eq('snapshot_month', snapshotMonth)
    .maybeSingle();

  if (readErr) return { status: 'error', message: readErr.message };

  if (existing?.is_locked) {
    return { status: 'skipped_snapshot_locked', propertyId, snapshotMonth };
  }

  const monthStart = snapshotMonth;
  const monthEnd = nextMonthStart(snapshotMonth);

  const { data: woRows, error: woErr } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (c: string, v: unknown) => {
          in: (c: string, v: unknown[]) => {
            gte: (c: string, v: unknown) => {
              lt: (c: string, v: unknown) => Promise<{
                data: { actual_cost: number | null }[] | null;
                error: Error | null;
              }>;
            };
          };
        };
      };
    };
  })
    .from('work_orders')
    .select('actual_cost')
    .eq('property_id', propertyId)
    .in('status', TERMINAL_WO_STATUSES as unknown as string[])
    .gte('actual_completion_date', monthStart)
    .lt('actual_completion_date', monthEnd);

  if (woErr) return { status: 'error', message: woErr.message };

  const maintenanceCosts = sumMaintenanceCosts(woRows ?? []);

  const upsertPayload = {
    org_id: orgId,
    property_id: propertyId,
    entity_id: entityId,
    snapshot_month: snapshotMonth,
    maintenance_costs: maintenanceCosts,
  };

  const { error: upsertErr } = await (supabase as unknown as {
    from: (t: string) => {
      upsert: (
        values: Record<string, unknown>,
        opts: { onConflict: string }
      ) => Promise<{ error: Error | null }>;
    };
  })
    .from('financial_snapshots')
    .upsert(upsertPayload, { onConflict: 'property_id,snapshot_month' });

  if (upsertErr) return { status: 'error', message: upsertErr.message };

  return { status: 'synced', propertyId, snapshotMonth, maintenanceCosts };
}

function nextMonthStart(firstOfMonth: string): string {
  const [y, m] = firstOfMonth.split('-').map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return `${nextY}-${String(nextM).padStart(2, '0')}-01`;
}
