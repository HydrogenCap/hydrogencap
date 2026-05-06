/**
 * costs-pair-completeness.test.ts
 *
 * Mirror of loans-pair-completeness.test.ts (Prompt #44). Guards the V1
 * `costs` ↔ V2 `property_cost_budgets_v2` 1:1 bridge established by the
 * Costs D backfill (2026-05-06, docs/release/costs-reconciliation-plan-2026-05-04.md).
 *
 * Refresh procedure: see plan §Costs D. Re-run the bridge SELECT and replace
 * the `pairs` array in fixtures/costs-pair-snapshot.json. Do NOT update the
 * count without first investigating whether V1 grew (V1 freeze should block).
 */
import { describe, it, expect } from 'vitest';
import snapshot from './fixtures/costs-pair-snapshot.json';
import { yearToTaxYear } from '@/hooks/usePropertyCostBudgets';

interface Pair {
  v1_cost_id: string;
  v2_budget_id: string;
  property_id: string;
  year: number;
  tax_year: string;
}

describe('V1 costs ↔ V2 property_cost_budgets_v2 pair completeness', () => {
  const pairs = snapshot.pairs as Pair[];

  it('snapshot covers all 3 V1 costs rows (no unpaired ids)', () => {
    expect(pairs.length).toBe(3);
  });

  it('every V1 cost id is unique (1:1 not 1:many)', () => {
    const ids = pairs.map(p => p.v1_cost_id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('every V2 budget id is unique (1:1 not many:1)', () => {
    const ids = pairs.map(p => p.v2_budget_id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('every (property_id, tax_year) pair is unique (matches V2 UNIQUE constraint)', () => {
    const keys = pairs.map(p => `${p.property_id}|${p.tax_year}`);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });

  it('V1 year integer round-trips through yearToTaxYear to match V2 tax_year', () => {
    for (const p of pairs) {
      expect(yearToTaxYear(p.year)).toBe(p.tax_year);
    }
  });
});
