/**
 * Mortgage payment calculation utilities
 */

export interface MortgageCalculationInputs {
  balance: number | null;
  interestRatePercent: number | null;
  termYears?: number | null;
  termMonths?: number | null;
  capitalOrInterest: 'capital' | 'interest' | null;
  paymentOverride?: number | null;
}

export interface MortgageCalculationResult {
  autoCalculated: number | null;
  effective: number | null;
  source: 'auto' | 'manual' | null;
  needsTerm: boolean;
  formula: string | null;
}

/**
 * Calculate monthly mortgage payment
 * 
 * Interest Only:
 *   monthly_payment = (balance * (rate / 100)) / 12
 * 
 * Capital & Interest (Repayment):
 *   r = (rate / 100) / 12  (monthly rate)
 *   n = term_months
 *   payment = balance * (r * (1 + r)^n) / ((1 + r)^n - 1)
 */
export function calculateMortgagePaymentDetailed(
  inputs: MortgageCalculationInputs
): MortgageCalculationResult {
  const { balance, interestRatePercent, termYears, termMonths, capitalOrInterest, paymentOverride } = inputs;

  // If there's a manual override, use it
  if (paymentOverride !== null && paymentOverride !== undefined && paymentOverride > 0) {
    // Still calculate auto for display purposes
    const auto = calculateAutoPayment(balance, interestRatePercent, termYears, termMonths, capitalOrInterest);
    return {
      autoCalculated: auto.payment,
      effective: paymentOverride,
      source: 'manual',
      needsTerm: auto.needsTerm,
      formula: auto.formula,
    };
  }

  const auto = calculateAutoPayment(balance, interestRatePercent, termYears, termMonths, capitalOrInterest);
  
  return {
    autoCalculated: auto.payment,
    effective: auto.payment,
    source: auto.payment !== null ? 'auto' : null,
    needsTerm: auto.needsTerm,
    formula: auto.formula,
  };
}

function calculateAutoPayment(
  balance: number | null,
  interestRatePercent: number | null,
  termYears: number | null | undefined,
  termMonths: number | null | undefined,
  capitalOrInterest: 'capital' | 'interest' | null
): { payment: number | null; needsTerm: boolean; formula: string | null } {
  // Need balance and rate for any calculation
  if (!balance || balance <= 0 || !interestRatePercent || interestRatePercent <= 0) {
    return { payment: null, needsTerm: false, formula: null };
  }

  const monthlyRate = interestRatePercent / 100 / 12;

  // Interest Only calculation
  if (capitalOrInterest === 'interest') {
    const payment = balance * (interestRatePercent / 100) / 12;
    return {
      payment: Math.round(payment * 100) / 100,
      needsTerm: false,
      formula: `£${balance.toLocaleString()} × ${interestRatePercent}% ÷ 12`,
    };
  }

  // Capital & Interest (Repayment) calculation
  if (capitalOrInterest === 'capital') {
    // Calculate term in months
    let n: number | null = null;
    if (termMonths && termMonths > 0) {
      n = termMonths;
    } else if (termYears && termYears > 0) {
      n = termYears * 12;
    }

    if (!n) {
      return { payment: null, needsTerm: true, formula: null };
    }

    // Amortization formula: P * (r * (1 + r)^n) / ((1 + r)^n - 1)
    const compoundFactor = Math.pow(1 + monthlyRate, n);
    const payment = balance * (monthlyRate * compoundFactor) / (compoundFactor - 1);
    
    return {
      payment: Math.round(payment * 100) / 100,
      needsTerm: false,
      formula: `Amortization over ${n} months`,
    };
  }

  // No payment type selected
  return { payment: null, needsTerm: false, formula: null };
}

/**
 * Format payment amount as GBP with decimals
 */
export function formatPaymentGBP(amount: number | null): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate rent per bedroom
 */
export interface RentPerBedroomResult {
  annual: number | null;
  monthly: number | null;
}

export function calculateRentPerBedroom(
  annualRent: number | null,
  bedrooms: number | null
): RentPerBedroomResult {
  if (!annualRent || !bedrooms || bedrooms <= 0) {
    return { annual: null, monthly: null };
  }

  const annual = annualRent / bedrooms;
  const monthly = annual / 12;

  return {
    annual: Math.round(annual * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
  };
}

/**
 * Calculate portfolio average rent per bedroom
 */
export function calculatePortfolioRentPerBedroom(
  properties: Array<{ annualRent: number | null; bedrooms: number | null }>
): RentPerBedroomResult {
  let totalRent = 0;
  let totalBedrooms = 0;

  properties.forEach(({ annualRent, bedrooms }) => {
    if (annualRent && bedrooms && bedrooms > 0) {
      totalRent += annualRent;
      totalBedrooms += bedrooms;
    }
  });

  if (totalBedrooms === 0) {
    return { annual: null, monthly: null };
  }

  const annual = totalRent / totalBedrooms;
  const monthly = annual / 12;

  return {
    annual: Math.round(annual * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
  };
}
