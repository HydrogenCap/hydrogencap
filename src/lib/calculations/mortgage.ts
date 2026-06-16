/**
 * Mortgage payment calculations.
 */

export interface MortgagePaymentInputs {
  balance: number | null;
  interestRate: number | null;
  termMonths: number | null;
  isInterestOnly: boolean;
  paymentOverride: number | null;
}

export function calculateMonthlyMortgagePayment(inputs: MortgagePaymentInputs): {
  autoCalculated: number | null;
  effective: number | null;
  source: 'auto' | 'manual' | null;
} {
  const { balance, interestRate, termMonths, isInterestOnly, paymentOverride } = inputs;

  if (paymentOverride !== null && paymentOverride > 0) {
    return {
      autoCalculated: calculateAutoPayment(balance, interestRate, termMonths, isInterestOnly),
      effective: paymentOverride,
      source: 'manual',
    };
  }

  const autoCalc = calculateAutoPayment(balance, interestRate, termMonths, isInterestOnly);
  return {
    autoCalculated: autoCalc,
    effective: autoCalc,
    source: autoCalc !== null ? 'auto' : null,
  };
}

function calculateAutoPayment(
  balance: number | null,
  interestRate: number | null,
  termMonths: number | null,
  isInterestOnly: boolean
): number | null {
  if (balance === null || balance <= 0) return null;
  if (interestRate === null || interestRate <= 0) return null;

  const monthlyRate = (interestRate / 100) / 12;

  if (isInterestOnly) {
    return balance * monthlyRate;
  }

  if (termMonths === null || termMonths <= 0) return null;

  const n = termMonths;
  const r = monthlyRate;

  const numerator = r * Math.pow(1 + r, n);
  const denominator = Math.pow(1 + r, n) - 1;

  if (denominator === 0) return null;

  return balance * (numerator / denominator);
}
