/**
 * V2 property_cost_budgets read helper (Costs Prompt C, 2026-05-04).
 *
 * Mirrors the loanFacility helper pattern. Provides:
 *   - PROPERTY_COST_BUDGET_SELECT — canonical .select() string.
 *   - taxYearToYear — inverse of yearToTaxYear; parses 'YYYY/(YY+1)' → YYYY.
 *   - propertyCostBudgetToLegacyShape — V2 row → V1 `costs` row shape
 *     (legacy `*_gbp` effective amounts + integer `year`).
 *   - warnIfLegacyYearMissing — log-only alarm for unparsable tax_year.
 */

export const PROPERTY_COST_BUDGET_SELECT = `
  id,
  org_id,
  property_id,
  tax_year,
  management_rule_enabled,
  management_rule_percent_of_rent,
  management_gbp_manual,
  management_gbp_calculated,
  repairs_rule_enabled,
  repairs_rule_percent_of_rent,
  repairs_gbp_manual,
  repairs_gbp_calculated,
  insurance_rule_enabled,
  insurance_rule_percent_of_value,
  insurance_gbp_manual,
  insurance_gbp_calculated,
  bills_gbp_manual,
  compliance_gbp_manual,
  other_gbp_manual,
  created_at,
  updated_at
`.trim();

const TAX_YEAR_RE = /^(\d{4})\/(\d{2})$/;

/** Parse V2 tax_year string ('2025/26') → V1 year integer (2025). Throws on bad format. */
export function taxYearToYear(taxYear: string): number {
  const m = TAX_YEAR_RE.exec(taxYear ?? "");
  if (!m) throw new Error(`Invalid tax_year format: ${taxYear}`);
  return parseInt(m[1], 10);
}

/** V1 year integer (2025) → V2 tax_year string ('2025/26'). Mirrors the src/ helper. */
export function yearToTaxYearShim(year: number): string {
  const next = (year + 1) % 100;
  return `${year}/${String(next).padStart(2, "0")}`;
}

/** Log-only: warn (don't throw) when a row has unparsable tax_year. */
export function warnIfLegacyYearMissing(
  context: string,
  rows: Array<{ id?: string; tax_year?: string | null }>,
): void {
  for (const r of rows) {
    const tx = r.tax_year ?? "";
    if (!TAX_YEAR_RE.test(tx)) {
      console.warn(
        `[${context}] property_cost_budgets row id=${r.id ?? "?"} has unparsable tax_year='${tx}'`,
      );
    }
  }
}

export interface PropertyCostBudgetRow {
  id: string;
  org_id: string;
  property_id: string;
  tax_year: string;
  management_rule_enabled: boolean | null;
  management_rule_percent_of_rent: number | null;
  management_gbp_manual: number | null;
  management_gbp_calculated: number | null;
  repairs_rule_enabled: boolean | null;
  repairs_rule_percent_of_rent: number | null;
  repairs_gbp_manual: number | null;
  repairs_gbp_calculated: number | null;
  insurance_rule_enabled: boolean | null;
  insurance_rule_percent_of_value: number | null;
  insurance_gbp_manual: number | null;
  insurance_gbp_calculated: number | null;
  bills_gbp_manual: number | null;
  compliance_gbp_manual: number | null;
  other_gbp_manual: number | null;
}

export interface LegacyCostsShape {
  id: string;
  org_id: string;
  property_id: string;
  year: number;
  management_gbp: number | null;
  insurance_gbp: number | null;
  maintenance_gbp: number | null;
  repairs_gbp: number | null;
  bills_gbp: number | null;
  compliance_gbp: number | null;
  other_gbp: number | null;
  // pass-through manual/calculated/rules so V1 _manual consumers keep working
  management_gbp_manual: number | null;
  repairs_gbp_manual: number | null;
  insurance_gbp_manual: number | null;
  bills_gbp_manual: number | null;
  compliance_gbp_manual: number | null;
  other_gbp_manual: number | null;
  management_rule_enabled: boolean | null;
  management_rule_percent_of_rent: number | null;
  repairs_rule_enabled: boolean | null;
  repairs_rule_percent_of_rent: number | null;
  insurance_rule_enabled: boolean | null;
  insurance_rule_percent_of_value: number | null;
}

const eff = (manual: number | null, calc: number | null): number | null =>
  manual !== null && manual !== undefined ? manual : calc;

/** V2 row → legacy V1 `costs` shape (effective `*_gbp` + integer `year`). */
export function propertyCostBudgetToLegacyShape(
  row: PropertyCostBudgetRow,
): LegacyCostsShape {
  let year: number;
  try {
    year = taxYearToYear(row.tax_year);
  } catch {
    // Fall back to current year so downstream math doesn't crash. The
    // warnIfLegacyYearMissing helper logs the alarm.
    year = new Date().getFullYear();
  }
  const management = eff(row.management_gbp_manual, row.management_gbp_calculated);
  const repairs = eff(row.repairs_gbp_manual, row.repairs_gbp_calculated);
  const insurance = eff(row.insurance_gbp_manual, row.insurance_gbp_calculated);
  return {
    id: row.id,
    org_id: row.org_id,
    property_id: row.property_id,
    year,
    management_gbp: management,
    insurance_gbp: insurance,
    maintenance_gbp: repairs,
    repairs_gbp: repairs,
    bills_gbp: row.bills_gbp_manual,
    compliance_gbp: row.compliance_gbp_manual,
    other_gbp: row.other_gbp_manual,
    management_gbp_manual: row.management_gbp_manual,
    repairs_gbp_manual: row.repairs_gbp_manual,
    insurance_gbp_manual: row.insurance_gbp_manual,
    bills_gbp_manual: row.bills_gbp_manual,
    compliance_gbp_manual: row.compliance_gbp_manual,
    other_gbp_manual: row.other_gbp_manual,
    management_rule_enabled: row.management_rule_enabled,
    management_rule_percent_of_rent: row.management_rule_percent_of_rent,
    repairs_rule_enabled: row.repairs_rule_enabled,
    repairs_rule_percent_of_rent: row.repairs_rule_percent_of_rent,
    insurance_rule_enabled: row.insurance_rule_enabled,
    insurance_rule_percent_of_value: row.insurance_rule_percent_of_value,
  };
}
