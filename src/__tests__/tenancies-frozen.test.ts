/**
 * tenancies-frozen.test.ts
 *
 * Tenancies Prompt #54 guard: V1 `tenancies` is frozen at both the client
 * (throwV1Frozen — Prompt #53 / src/lib/v1Frozen.ts) and the database
 * (v1_freeze_guard BEFORE INSERT/UPDATE/DELETE trigger — this prompt).
 *
 * Mirror of loans-frozen.test.ts (#47) and costs-frozen.test.ts (#49e).
 * DB-side guarantee verified manually post-migration via psql.
 */
import { describe, it, expect } from 'vitest';
import { throwV1Frozen } from '@/lib/v1Frozen';

describe("V1 'tenancies' freeze guard (client layer mirrors DB trigger)", () => {
  it.each([
    'useCreateTenancy',
    'useUpdateTenancy',
    'useActivateTenancy',
    'useEndTenancy',
    'useGiveNotice',
  ])('throws for %s with the canonical V2 redirect message', (op) => {
    expect(() => throwV1Frozen('tenancies', op)).toThrow(
      /V1 table 'tenancies' is frozen.*tenancy_agreements/,
    );
  });

  it('mentions the attempted op in the error so triage can attribute it', () => {
    expect(() => throwV1Frozen('tenancies', 'useCreateTenancy')).toThrow(
      /useCreateTenancy/,
    );
  });
});
