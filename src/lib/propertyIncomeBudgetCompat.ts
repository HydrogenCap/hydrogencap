/**
 * V2 property_income_budgets read shim for src/ (Income migration, 2026-05-06).
 *
 * Mirrors propertyCostBudgetCompat. Kept duplicated from supabase/functions/
 * because src/ and supabase/functions/ cannot import each other.
 */

import { taxYearToYear } from '@/lib/propertyCostBudgetCompat';
export { taxYearToYear } from '@/lib/propertyCostBudgetCompat';

export interface PropertyIncomeBudgetRowLite {
  id: string;
  org_id?: string;
  property_id: string;
  tax_year: string;
  annual_rent_gbp: number | string | null;
}

/** V2 row → V1 `income` legacy shape with integer `year`. */
export function propertyIncomeBudgetToLegacyShape(row: PropertyIncomeBudgetRowLite) {
  let year: number;
  try {
    year = taxYearToYear(row.tax_year);
  } catch {
    year = new Date().getFullYear();
  }
  const rent =
    row.annual_rent_gbp == null
      ? 0
      : typeof row.annual_rent_gbp === 'string'
        ? parseFloat(row.annual_rent_gbp)
        : row.annual_rent_gbp;
  return {
    id: row.id,
    property_id: row.property_id,
    year,
    annual_rent_gbp: rent,
  };
}
