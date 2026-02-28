import { describe, it, expect } from 'vitest';
import {
  calculateMortgagePaymentDetailed,
  formatPaymentGBP,
  calculateRentPerBedroom,
} from './mortgageCalculations';

describe('calculateMortgagePaymentDetailed', () => {
  it('returns null payment when balance is null', () => {
    const result = calculateMortgagePaymentDetailed({
      balance: null,
      interestRatePercent: 5,
      capitalOrInterest: 'interest',
    });
    expect(result.effective).toBeNull();
    expect(result.source).toBeNull();
  });

  it('returns null payment when rate is null', () => {
    const result = calculateMortgagePaymentDetailed({
      balance: 200000,
      interestRatePercent: null,
      capitalOrInterest: 'interest',
    });
    expect(result.effective).toBeNull();
  });

  it('calculates interest-only correctly', () => {
    const result = calculateMortgagePaymentDetailed({
      balance: 200000,
      interestRatePercent: 6,
      capitalOrInterest: 'interest',
    });
    // £200,000 * 6% / 12 = £1,000
    expect(result.effective).toBeCloseTo(1000, 0);
    expect(result.source).toBe('auto');
    expect(result.formula).toBeTruthy();
  });

  it('calculates capital & interest (repayment) correctly', () => {
    const result = calculateMortgagePaymentDetailed({
      balance: 200000,
      interestRatePercent: 5,
      termYears: 25,
      capitalOrInterest: 'capital',
    });
    expect(result.effective).not.toBeNull();
    // Repayment should be higher than interest-only (£833.33)
    expect(result.effective!).toBeGreaterThan(833);
    expect(result.source).toBe('auto');
  });

  it('uses manual override when provided', () => {
    const result = calculateMortgagePaymentDetailed({
      balance: 200000,
      interestRatePercent: 5,
      capitalOrInterest: 'interest',
      paymentOverride: 1500,
    });
    expect(result.effective).toBe(1500);
    expect(result.source).toBe('manual');
    // Auto-calculated should still be populated
    expect(result.autoCalculated).not.toBeNull();
  });

  it('flags needsTerm when capital repayment has no term', () => {
    const result = calculateMortgagePaymentDetailed({
      balance: 200000,
      interestRatePercent: 5,
      capitalOrInterest: 'capital',
      // No termYears or termMonths
    });
    expect(result.needsTerm).toBe(true);
  });

  it('handles zero balance', () => {
    const result = calculateMortgagePaymentDetailed({
      balance: 0,
      interestRatePercent: 5,
      capitalOrInterest: 'interest',
    });
    expect(result.effective).toBeNull();
  });
});

describe('formatPaymentGBP', () => {
  it('formats a payment amount', () => {
    expect(formatPaymentGBP(1234.56)).toMatch(/1,234/);
  });

  it('handles null', () => {
    const result = formatPaymentGBP(null);
    expect(result).toBe('—');
  });
});

describe('calculateRentPerBedroom', () => {
  it('calculates rent per bedroom', () => {
    const result = calculateRentPerBedroom(1200, 3);
    expect(result.annual).toBeCloseTo(400, 0);
  });

  it('handles null rent', () => {
    const result = calculateRentPerBedroom(null, 3);
    expect(result.annual).toBeNull();
  });

  it('handles zero bedrooms', () => {
    const result = calculateRentPerBedroom(1200, 0);
    expect(result.annual).toBeNull();
  });
});
