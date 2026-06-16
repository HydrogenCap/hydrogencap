/**
 * Metrics Configuration — shared helpers
 */
import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { formatGBP, getEffectiveCosts, calculateMonthlyMortgagePayment } from '@/lib/calculations';
import type { PropertyBreakdownRow, EntityBreakdownRow } from './types';

/** Read current-year financial inputs for a property. */
export function getCurrentYearData(property: PropertyWithFinancials) {
  const currentYear = new Date().getFullYear();
  const loan = property.loans?.[0];
  const income = property.income?.find(i => i.year === currentYear);
  const costs = property.costs?.find(c => c.year === currentYear);

  const value = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
  const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
  const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;

  const effectiveCosts = getEffectiveCosts(rent, value, costs);

  const storedPayment = loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null;
  const paymentOverride = loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : storedPayment;

  const mortgagePaymentResult = calculateMonthlyMortgagePayment({
    balance: mortgage || null,
    interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
    termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
    isInterestOnly: loan?.capital_or_interest === 'interest',
    paymentOverride: paymentOverride,
  });

  return { loan, income, costs, value, mortgage, rent, effectiveCosts, mortgagePaymentResult };
}

/** Roll up property rows into one row per owning entity. */
export function rollupByEntity(
  rows: PropertyBreakdownRow[],
  sumKeys: string[],
  displayKeys: Record<string, string>,
): EntityBreakdownRow[] {
  const map = new Map<string, { count: number; sums: Record<string, number> }>();
  for (const row of rows) {
    const name = row.entityName || 'Unassigned';
    const bucket = map.get(name) ?? { count: 0, sums: Object.fromEntries(sumKeys.map(k => [k, 0])) };
    bucket.count += 1;
    for (const k of sumKeys) {
      bucket.sums[k] += Number(row.values[k] ?? 0);
    }
    map.set(name, bucket);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].sums[sumKeys[0]] - a[1].sums[sumKeys[0]])
    .map(([entityName, b]) => {
      const values: Record<string, string | number | null> = {
        entityName,
        count: b.count,
      };
      for (const k of sumKeys) {
        values[displayKeys[k]] = formatGBP(b.sums[k]);
      }
      return { entityName, values };
    });
}
