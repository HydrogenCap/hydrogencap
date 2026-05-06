/**
 * V1 Freeze Stage A — runtime guard.
 *
 * V1 tables (`properties`, `rooms`, `tenants`, `loans`) are frozen for writes.
 * Reads are still permitted during the transition. Any attempt to call a
 * V1 mutation hook (Create/Update/Delete/Upsert) will throw via this helper.
 *
 * Stage B (backfill) and Stage C (delete hooks + drop V1) follow in later sessions.
 *
 * Replacement targets:
 *   - properties → properties_v2
 *   - rooms      → rooms_v2
 *   - tenants    → tenants_v2
 *   - loans      → loan_facilities
 */
export function throwV1Frozen(v1Table: 'properties' | 'rooms' | 'tenants' | 'loans' | 'costs' | 'income', op: string): never {
  const v2Map = {
    properties: 'properties_v2',
    rooms: 'rooms_v2',
    tenants: 'tenants_v2',
    loans: 'loan_facilities',
    costs: 'property_cost_budgets_v2',
    income: 'property_income_budgets_v2',
  } as const;
  throw new Error(
    `V1 table '${v1Table}' is frozen — write to '${v2Map[v1Table]}' instead. ` +
    `(Attempted: ${op})`
  );
}
