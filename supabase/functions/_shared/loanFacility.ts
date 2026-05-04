// Shared helper: map a V2 `loan_facilities` row to the legacy V1 `loans` row
// shape that the existing edge-function consumers expect (financial-forecast,
// portfolio-chat tool-executor, generate-investor-report, analyse-acquisition,
// generate-ai-valuation).
//
// Per docs/release/loans-reconciliation-plan-2026-05-02.md §7.C — V1 loans is
// being read-frozen; this helper avoids rewriting each function's downstream
// math by translating column names at the boundary:
//
//   V1                                  V2 loan_facilities
//   ─────────────────────────────────   ─────────────────────────
//   current_mortgage_balance_gbp    →   current_balance
//   interest_rate_percent           →   interest_rate
//   mortgage_payment_gbp            →   monthly_payment
//   fixed_or_variable               →   rate_type
//   fixed_rate_expires              →   rate_expiry_date
//   reversion_rate_percent          →   revert_rate
//   capital_or_interest             →   repayment_type / interest_only
//   mortgage_type                   →   facility_type
//   lender (text)                   →   resolved via lender_id → lenders.lender_name
//
// V1 columns with no V2 equivalent (broker_name, broker_contact, payment_*
// override variants, loan_term_months, term_years, refinance_target_date,
// loan_start_date, payment_source, notes) → returned as null. The audit
// confirmed these are 0/24 populated in V1 today, so loss is theoretical.
//
// Property id semantics WARNING: `loan_facilities.property_id` references
// `properties_v2.id`, not the V1 `properties.id`. Functions that still join
// against V1 `properties` will see zero matches; the helper logs once per
// invocation when this is detected so silent zeros don't make it into
// forecasts. A follow-up prompt should migrate those functions to
// properties_v2 alongside the property_id space change.

export interface LoanFacilityRow {
  id: string;
  property_id: string;
  org_id?: string | null;
  lender_id: string | null;
  facility_type: string | null;
  current_balance: number | null;
  original_amount: number | null;
  interest_rate: number | null;
  rate_type: string | null;
  rate_expiry_date: string | null;
  revert_rate: number | null;
  monthly_payment: number | null;
  term_start_date: string | null;
  term_end_date: string | null;
  interest_only: boolean | null;
  repayment_type: string | null;
  product_name: string | null;
  status: string | null;
}

export interface LoanLegacyShape {
  id: string;
  property_id: string;
  lender: string | null; // resolved name from lenders table when available
  lender_id: string | null;
  current_mortgage_balance_gbp: number | null;
  interest_rate_percent: number | null;
  mortgage_payment_gbp: number | null;
  fixed_or_variable: string | null;
  fixed_rate_expires: string | null;
  fixed_rate_end_date: string | null; // alias used by portfolio-chat
  reversion_rate_percent: number | null;
  capital_or_interest: string | null;
  mortgage_type: string | null;
  loan_amount: number | null;
  current_balance: number | null;
  monthly_payment: number | null;
  maturity_date: string | null;
  loan_type: string | null;
  // Fields the V1 audit flagged as 0/24 populated:
  loan_start_date: null;
  term_years: null;
  loan_term_months: null;
  payment_override_gbp: null;
  payment_auto_calculated_gbp: null;
  payment_source: null;
  broker_name: null;
  broker_contact: null;
  refinance_target_date: null;
  notes: null;
}

/**
 * Select clause for fetching loan_facilities rows compatible with this helper.
 * Includes the embedded lender name so the legacy `lender` text field can be
 * resolved without a second round-trip.
 */
export const LOAN_FACILITY_SELECT =
  "id, property_id, org_id, lender_id, facility_type, current_balance, original_amount, " +
  "interest_rate, rate_type, rate_expiry_date, revert_rate, monthly_payment, " +
  "term_start_date, term_end_date, interest_only, repayment_type, product_name, status, " +
  "lenders:lender_id(lender_name)";

type WithLenderName = LoanFacilityRow & {
  lenders?: { lender_name: string | null } | { lender_name: string | null }[] | null;
};

function pickLenderName(row: WithLenderName): string | null {
  const l = row.lenders;
  if (!l) return null;
  if (Array.isArray(l)) return l[0]?.lender_name ?? null;
  return l.lender_name ?? null;
}

export function loanFacilityToLegacyShape(row: WithLenderName): LoanLegacyShape {
  const capitalOrInterest =
    row.interest_only === true
      ? "interest"
      : row.repayment_type === "capital_repayment" || row.repayment_type === "capital"
      ? "capital"
      : row.repayment_type ?? null;

  return {
    id: row.id,
    property_id: row.property_id,
    lender: pickLenderName(row),
    lender_id: row.lender_id ?? null,
    current_mortgage_balance_gbp: row.current_balance ?? null,
    interest_rate_percent: row.interest_rate ?? null,
    mortgage_payment_gbp: row.monthly_payment ?? null,
    fixed_or_variable: row.rate_type ?? null,
    fixed_rate_expires: row.rate_expiry_date ?? null,
    fixed_rate_end_date: row.rate_expiry_date ?? null,
    reversion_rate_percent: row.revert_rate ?? null,
    capital_or_interest: capitalOrInterest,
    mortgage_type: row.facility_type ?? null,
    loan_amount: row.original_amount ?? null,
    current_balance: row.current_balance ?? null,
    monthly_payment: row.monthly_payment ?? null,
    maturity_date: row.term_end_date ?? null,
    loan_type: row.facility_type ?? null,
    loan_start_date: null,
    term_years: null,
    loan_term_months: null,
    payment_override_gbp: null,
    payment_auto_calculated_gbp: null,
    payment_source: null,
    broker_name: null,
    broker_contact: null,
    refinance_target_date: null,
    notes: null,
  };
}

/**
 * Warn (once per invocation) if the loan_facilities batch and the candidate
 * property_id list have no overlap — almost certainly a V1↔V2 property_id
 * space mismatch. Caller still gets the (empty) match-set; this helper is
 * just the alarm bell so silent-zero forecasts are visible in logs.
 */
export function warnIfPropertyIdSpaceMismatch(
  fnName: string,
  facilities: { id: string; property_id: string }[],
  candidatePropertyIds: string[],
): void {
  if (!facilities.length || !candidatePropertyIds.length) return;
  const candSet = new Set(candidatePropertyIds);
  const overlap = facilities.some((f) => candSet.has(f.property_id));
  if (!overlap) {
    const sampleIds = facilities.slice(0, 3).map((f) => f.id).join(",");
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        fn: fnName,
        outcome: "loan_property_id_space_mismatch",
        message:
          "loan_facilities returned but no property_id overlapped the candidate property list — " +
          "likely V1 properties.id vs V2 properties_v2.id drift. Forecast/joins will be empty until " +
          "the function is migrated to properties_v2.",
        sample_loan_facility_ids: sampleIds,
        facility_count: facilities.length,
        candidate_property_count: candidatePropertyIds.length,
      }),
    );
  }
}
