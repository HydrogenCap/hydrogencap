/**
 * costs-frozen.test.ts
 *
 * Costs Prompt E guard: V1 `costs` is frozen at both the client
 * (throwV1Frozen — Costs Prompt B / src/lib/v1Frozen.ts) and the database
 * (v1_freeze_guard BEFORE INSERT/UPDATE/DELETE trigger — Costs Prompt E).
 *
 * Mirror of loans-frozen.test.ts (#47). DB-side guarantee verified manually
 * via psql post-migration; recorded in costs-reconciliation-plan.
 */
import { describe, it, expect } from 'vitest';
import { throwV1Frozen } from '@/lib/v1Frozen';

describe("V1 'costs' freeze guard (client layer mirrors DB trigger)", () => {
  it.each(['useUpsertCosts', 'useDeleteCosts', 'useUpdateCosts'])(
    'throws for %s with the canonical V2 redirect message',
    (op) => {
      expect(() => throwV1Frozen('costs', op)).toThrow(
        /V1 table 'costs' is frozen.*property_cost_budgets_v2/,
      );
    },
  );

  it('mentions the attempted op in the error so triage can attribute it', () => {
    expect(() => throwV1Frozen('costs', 'useUpsertCosts')).toThrow(/useUpsertCosts/);
  });
});
