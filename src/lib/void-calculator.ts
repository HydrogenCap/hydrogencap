/**
 * Void Cost Calculator
 *
 * Calculates financial impact of void periods including carrying costs,
 * lost rent, portfolio void rate, and average turnaround time.
 */

export interface VoidCostInputs {
  mortgagePaymentMonthly?: number;
  insuranceMonthly?: number;
  councilTaxMonthly?: number;
  utilitiesMonthly?: number;
}

export interface VoidCostResult {
  dailyCost: number;
  totalCost: number;
  breakdown: {
    mortgage: number;
    insurance: number;
    councilTax: number;
    utilities: number;
  };
}

/**
 * Calculate the carrying cost of a void property over a given number of days.
 * Carrying costs = mortgage + insurance + council_tax + utilities for the period.
 */
export function calculateVoidCost(
  inputs: VoidCostInputs,
  voidDays: number,
): VoidCostResult {
  const mortgage = inputs.mortgagePaymentMonthly ?? 0;
  const insurance = inputs.insuranceMonthly ?? 0;
  const councilTax = inputs.councilTaxMonthly ?? 0;
  const utilities = inputs.utilitiesMonthly ?? 0;

  const totalMonthly = mortgage + insurance + councilTax + utilities;
  const dailyCost = totalMonthly / 30;
  const totalCost = dailyCost * voidDays;

  return {
    dailyCost: Math.round(dailyCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    breakdown: {
      mortgage: Math.round((mortgage / 30) * voidDays * 100) / 100,
      insurance: Math.round((insurance / 30) * voidDays * 100) / 100,
      councilTax: Math.round((councilTax / 30) * voidDays * 100) / 100,
      utilities: Math.round((utilities / 30) * voidDays * 100) / 100,
    },
  };
}

/**
 * Calculate lost rent for a void period.
 * Lost rent = void_days * (monthly_rent / 30)
 */
export function calculateLostRent(monthlyRent: number, voidDays: number): number {
  const dailyRent = monthlyRent / 30;
  return Math.round(dailyRent * voidDays * 100) / 100;
}

/**
 * Calculate portfolio void rate as a percentage.
 * Void rate = (total void days / total possible days) * 100
 *
 * @param totalVoidDays Sum of void days across all properties/rooms
 * @param totalPossibleDays Total lettable unit-days in the period (units * days)
 */
export function calculatePortfolioVoidRate(
  totalVoidDays: number,
  totalPossibleDays: number,
): number {
  if (totalPossibleDays <= 0) return 0;
  return Math.round((totalVoidDays / totalPossibleDays) * 100 * 10) / 10;
}

/**
 * Calculate average turnaround time between tenancies.
 * Takes an array of completed void durations (in days) and returns the mean.
 */
export function calculateAverageTurnaround(voidDurations: number[]): number {
  if (voidDurations.length === 0) return 0;
  const total = voidDurations.reduce((sum, d) => sum + d, 0);
  return Math.round(total / voidDurations.length);
}

/**
 * Calculate void days between two dates.
 * If endDate is null, uses today.
 */
export function calculateVoidDays(startDate: string, endDate?: string | null): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Calculate total financial impact of a void period.
 * Combines carrying costs and lost rent.
 */
export function calculateTotalVoidImpact(
  monthlyRent: number,
  costInputs: VoidCostInputs,
  voidDays: number,
): { lostRent: number; carryingCosts: number; totalImpact: number } {
  const lostRent = calculateLostRent(monthlyRent, voidDays);
  const { totalCost: carryingCosts } = calculateVoidCost(costInputs, voidDays);
  return {
    lostRent,
    carryingCosts,
    totalImpact: Math.round((lostRent + carryingCosts) * 100) / 100,
  };
}
