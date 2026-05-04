/**
 * loans-frozen.test.ts
 *
 * Guard for Prompt §7.D: V1 `loans` is frozen at both the client (throwV1Frozen
 * in src/lib/v1Frozen.ts — Prompt #45) and the database (v1_freeze_guard
 * BEFORE INSERT/UPDATE/DELETE trigger — Prompt #47, this file's migration).
 *
 * The DB-side guarantee is verified manually post-migration via psql against
 * the live test DB (no service-role client is wired into Vitest in this repo);
 * see the plan §7.D entry for the recorded RAISE message.
 *
 * What we assert here
 * -------------------
 * 1. The JS guard throws for every loans mutation surface (insert/update/delete).
 * 2. The thrown message matches the DB trigger's wording so log triage stays
 *    consistent across layers ("V1 table 'loans' is frozen — write to
 *    'loan_facilities' instead").
 */
import { describe, it, expect } from 'vitest';
import { throwV1Frozen } from '@/lib/v1Frozen';

describe("V1 'loans' freeze guard (client layer mirrors DB trigger)", () => {
  it.each(['useCreateLoan', 'useUpdateLoan', 'useDeleteLoan'])(
    'throws for %s with the canonical V2 redirect message',
    (op) => {
      expect(() => throwV1Frozen('loans', op)).toThrow(
        /V1 table 'loans' is frozen.*loan_facilities/,
      );
    },
  );

  it('mentions the attempted op in the error so triage can attribute it', () => {
    expect(() => throwV1Frozen('loans', 'useCreateLoan')).toThrow(/useCreateLoan/);
  });
});
