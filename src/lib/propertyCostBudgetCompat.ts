/**
 * V2 property_cost_budgets read shim for the src/ side (Costs Prompt C, 2026-05-04).
 *
 * Mirrors supabase/functions/_shared/propertyCostBudget.ts. Kept duplicated
 * because src/ and supabase/functions/ cannot import each other.
 */

const TAX_YEAR_RE = /^(\d{4})\/(\d{2})$/;

export function taxYearToYear(taxYear: string): number {
  const m = TAX_YEAR_RE.exec(taxYear ?? '');
  if (!m) throw new Error(`Invalid tax_year format: ${taxYear}`);
  return parseInt(m[1], 10);
}

export function warnIfLegacyYearMissing(
  context: string,
  rows: Array<{ id?: string; tax_year?: string | null }>,
): void {
  for (const r of rows) {
    const tx = r.tax_year ?? '';
    if (!TAX_YEAR_RE.test(tx)) {
      console.warn(
        `[${context}] property_cost_budgets row id=${r.id ?? '?'} has unparsable tax_year='${tx}'`,
      );
    }
  }
}

export interface PropertyCostBudgetRowLite {
  id: string;
  org_id?: string;
  property_id: string;
  tax_year: string;
  management_rule_enabled?: boolean | null;
  management_rule_percent_of_rent?: number | null;
  management_gbp_manual?: number | null;
  management_gbp_calculated?: number | null;
  repairs_rule_enabled?: boolean | null;
  repairs_rule_percent_of_rent?: number | null;
  repairs_gbp_manual?: number | null;
  repairs_gbp_calculated?: number | null;
  insurance_rule_enabled?: boolean | null;
  insurance_rule_percent_of_value?: number | null;
  insurance_gbp_manual?: number | null;
  insurance_gbp_calculated?: number | null;
  bills_gbp_manual?: number | null;
  compliance_gbp_manual?: number | null;
  other_gbp_manual?: number | null;
}

const eff = (m: number | null | undefined, c: number | null | undefined) =>
  (m ?? null) !== null ? (m as number) : (c ?? null);

/** V2 row → V1 `costs` legacy shape with integer `year`. */
export function propertyCostBudgetToLegacyShape(row: PropertyCostBudgetRowLite) {
  let year: number;
  try {
    year = taxYearToYear(row.tax_year);
  } catch {
    year = new Date().getFullYear();
  }
  const management = eff(row.management_gbp_manual ?? null, row.management_gbp_calculated ?? null);
  const repairs = eff(row.repairs_gbp_manual ?? null, row.repairs_gbp_calculated ?? null);
  const insurance = eff(row.insurance_gbp_manual ?? null, row.insurance_gbp_calculated ?? null);
  return {
    id: row.id,
    property_id: row.property_id,
    year,
    management_gbp: management,
    insurance_gbp: insurance,
    maintenance_gbp: repairs,
    repairs_gbp: repairs,
    bills_gbp: row.bills_gbp_manual ?? null,
    compliance_gbp: row.compliance_gbp_manual ?? null,
    other_gbp: row.other_gbp_manual ?? null,
    management_gbp_manual: row.management_gbp_manual ?? null,
    repairs_gbp_manual: row.repairs_gbp_manual ?? null,
    insurance_gbp_manual: row.insurance_gbp_manual ?? null,
    bills_gbp_manual: row.bills_gbp_manual ?? null,
    compliance_gbp_manual: row.compliance_gbp_manual ?? null,
    other_gbp_manual: row.other_gbp_manual ?? null,
    management_rule_enabled: row.management_rule_enabled ?? null,
    management_rule_percent_of_rent: row.management_rule_percent_of_rent ?? null,
    repairs_rule_enabled: row.repairs_rule_enabled ?? null,
    repairs_rule_percent_of_rent: row.repairs_rule_percent_of_rent ?? null,
    insurance_rule_enabled: row.insurance_rule_enabled ?? null,
    insurance_rule_percent_of_value: row.insurance_rule_percent_of_value ?? null,
  };
}
