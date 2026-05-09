/**
 * V2 property_income_budgets read helper for edge functions (Income migration, 2026-05-06).
 *
 * Mirrors propertyCostBudget.ts. Provides PROPERTY_INCOME_BUDGET_SELECT,
 * propertyIncomeBudgetToLegacyShape, taxYearToYearShim (re-export from cost helper).
 */

export {
  taxYearToYear as taxYearToYearShim,
  yearToTaxYearShim,
} from "./propertyCostBudget.ts";

import { taxYearToYear } from "./propertyCostBudget.ts";

export const PROPERTY_INCOME_BUDGET_SELECT = `
  id,
  org_id,
  property_id,
  tax_year,
  annual_rent_gbp,
  created_at,
  updated_at
`.trim();

export interface PropertyIncomeBudgetRow {
  id: string;
  org_id: string;
  property_id: string;
  tax_year: string;
  annual_rent_gbp: number | string | null;
}

export interface LegacyIncomeShape {
  id: string;
  org_id: string;
  property_id: string;
  year: number;
  annual_rent_gbp: number;
}

export function propertyIncomeBudgetToLegacyShape(
  row: PropertyIncomeBudgetRow,
): LegacyIncomeShape {
  let year: number;
  try {
    year = taxYearToYear(row.tax_year);
  } catch {
    year = new Date().getFullYear();
  }
  const rent =
    row.annual_rent_gbp == null
      ? 0
      : typeof row.annual_rent_gbp === "string"
        ? parseFloat(row.annual_rent_gbp)
        : row.annual_rent_gbp;
  return {
    id: row.id,
    org_id: row.org_id,
    property_id: row.property_id,
    year,
    annual_rent_gbp: rent,
  };
}
