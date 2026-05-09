/**
 * income-pair-completeness.test.ts
 *
 * Income migration parity (2026-05-06). V1 `income` was DROPPED in the same
 * migration as the V2 `property_income_budgets` create+backfill (per #32
 * audit: 0 inbound FKs). Snapshot was captured pre-drop and now serves as the
 * V2-only invariant: 21 V2 rows, unique ids, unique (property_id, tax_year),
 * and yearToTaxYear round-trip.
 */
import { describe, it, expect } from 'vitest';
import snapshot from './fixtures/income-pair-snapshot.json';
import { yearToTaxYear } from '@/hooks/usePropertyIncomeBudgets';

interface Pair {
  v1_income_id: string;
  v2_property_id: string;
  year: number;
  tax_year: string;
  annual_rent_gbp: string;
}

describe('V1 income → V2 property_income_budgets pair completeness', () => {
  const pairs = snapshot.pairs as Pair[];

  it('snapshot covers all 21 backfilled rows', () => {
    expect(pairs.length).toBe(21);
  });

  it('every V1 income id is unique (1:1)', () => {
    const ids = pairs.map((p) => p.v1_income_id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('every (v2_property_id, tax_year) pair is unique', () => {
    const keys = pairs.map((p) => `${p.v2_property_id}|${p.tax_year}`);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });

  it('V1 year integer round-trips through yearToTaxYear to match V2 tax_year', () => {
    for (const p of pairs) {
      expect(yearToTaxYear(p.year)).toBe(p.tax_year);
    }
  });
});
