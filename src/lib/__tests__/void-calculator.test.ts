import { describe, it, expect } from 'vitest';
import {
  calculateVoidCost,
  calculateLostRent,
  calculatePortfolioVoidRate,
  calculateAverageTurnaround,
  calculateVoidDays,
  calculateTotalVoidImpact,
} from '../void-calculator';

describe('calculateVoidCost', () => {
  it('calculates carrying cost over 30 days', () => {
    const result = calculateVoidCost({
      mortgagePaymentMonthly: 600,
      insuranceMonthly: 30,
      councilTaxMonthly: 120,
      utilitiesMonthly: 50,
    }, 30);
    // Total monthly = 800, daily = 800/30 ≈ 26.67, total = 26.67*30 = 800
    expect(result.totalCost).toBe(800);
    expect(result.dailyCost).toBeCloseTo(26.67, 2);
  });

  it('calculates carrying cost over 15 days', () => {
    const result = calculateVoidCost({
      mortgagePaymentMonthly: 600,
      insuranceMonthly: 30,
      councilTaxMonthly: 120,
      utilitiesMonthly: 50,
    }, 15);
    expect(result.totalCost).toBe(400);
  });

  it('returns zero cost for 0 void days', () => {
    const result = calculateVoidCost({
      mortgagePaymentMonthly: 600,
      insuranceMonthly: 30,
    }, 0);
    expect(result.totalCost).toBe(0);
    expect(result.dailyCost).toBeCloseTo(21, 0);
  });

  it('handles missing optional inputs (defaults to 0)', () => {
    const result = calculateVoidCost({}, 30);
    expect(result.totalCost).toBe(0);
    expect(result.breakdown.mortgage).toBe(0);
    expect(result.breakdown.insurance).toBe(0);
    expect(result.breakdown.councilTax).toBe(0);
    expect(result.breakdown.utilities).toBe(0);
  });

  it('returns correct breakdown per cost type', () => {
    const result = calculateVoidCost({
      mortgagePaymentMonthly: 300,
      insuranceMonthly: 0,
      councilTaxMonthly: 150,
      utilitiesMonthly: 0,
    }, 30);
    expect(result.breakdown.mortgage).toBe(300);
    expect(result.breakdown.councilTax).toBe(150);
    expect(result.breakdown.insurance).toBe(0);
    expect(result.breakdown.utilities).toBe(0);
  });

  it('calculates correctly for a single day', () => {
    const result = calculateVoidCost({ mortgagePaymentMonthly: 300 }, 1);
    expect(result.totalCost).toBe(10);
    expect(result.dailyCost).toBe(10);
  });
});

describe('calculateLostRent', () => {
  it('calculates lost rent for 30 days (full month)', () => {
    expect(calculateLostRent(1_500, 30)).toBe(1_500);
  });

  it('calculates lost rent for a partial month', () => {
    // 1500/30 * 15 = 750
    expect(calculateLostRent(1_500, 15)).toBe(750);
  });

  it('returns 0 for 0 void days', () => {
    expect(calculateLostRent(1_500, 0)).toBe(0);
  });

  it('returns 0 for 0 monthly rent', () => {
    expect(calculateLostRent(0, 30)).toBe(0);
  });

  it('handles single day correctly', () => {
    expect(calculateLostRent(1_500, 1)).toBe(50);
  });
});

describe('calculatePortfolioVoidRate', () => {
  it('calculates 10% void rate (1 void of 10 units over 30 days)', () => {
    // 30 void days out of 300 possible = 10%
    expect(calculatePortfolioVoidRate(30, 300)).toBe(10);
  });

  it('returns 0 when no voids', () => {
    expect(calculatePortfolioVoidRate(0, 300)).toBe(0);
  });

  it('returns 100 when all void', () => {
    expect(calculatePortfolioVoidRate(300, 300)).toBe(100);
  });

  it('returns 0 when total possible days is 0', () => {
    expect(calculatePortfolioVoidRate(0, 0)).toBe(0);
  });

  it('returns 0 when total possible days is negative', () => {
    expect(calculatePortfolioVoidRate(10, -1)).toBe(0);
  });

  it('rounds to one decimal place', () => {
    // 7 / 90 = 7.777...% → 7.8
    expect(calculatePortfolioVoidRate(7, 90)).toBe(7.8);
  });
});

describe('calculateAverageTurnaround', () => {
  it('calculates average of multiple durations', () => {
    expect(calculateAverageTurnaround([14, 21, 7])).toBe(14);
  });

  it('returns 0 for empty array', () => {
    expect(calculateAverageTurnaround([])).toBe(0);
  });

  it('returns the single value for a one-element array', () => {
    expect(calculateAverageTurnaround([30])).toBe(30);
  });

  it('rounds to nearest integer', () => {
    // (10 + 11) / 2 = 10.5 → 11
    expect(calculateAverageTurnaround([10, 11])).toBe(11);
  });
});

describe('calculateVoidDays', () => {
  it('calculates days between two dates', () => {
    expect(calculateVoidDays('2025-01-01', '2025-01-31')).toBe(30);
  });

  it('returns 0 for same start and end date', () => {
    expect(calculateVoidDays('2025-01-01', '2025-01-01')).toBe(0);
  });

  it('returns 0 when end is before start', () => {
    expect(calculateVoidDays('2025-02-01', '2025-01-01')).toBe(0);
  });
});

describe('calculateTotalVoidImpact', () => {
  it('combines lost rent and carrying costs', () => {
    const result = calculateTotalVoidImpact(
      1_500,
      { mortgagePaymentMonthly: 600, councilTaxMonthly: 120 },
      30,
    );
    expect(result.lostRent).toBe(1_500);
    expect(result.carryingCosts).toBe(720);
    expect(result.totalImpact).toBe(2_220);
  });

  it('returns zero impact for 0 void days', () => {
    const result = calculateTotalVoidImpact(1_500, { mortgagePaymentMonthly: 600 }, 0);
    expect(result.lostRent).toBe(0);
    expect(result.carryingCosts).toBe(0);
    expect(result.totalImpact).toBe(0);
  });
});
