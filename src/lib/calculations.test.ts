import { describe, it, expect } from 'vitest';
import {
  formatGBP,
  formatGBPDecimal,
  formatGBPCompact,
  formatPercent,
  formatDateUK,
  formatDateShort,
  calculateMonthlyMortgagePayment,
  calculateLTV,
  extractPostcodeArea,
} from './calculations';

describe('formatGBP', () => {
  it('formats positive amounts', () => {
    expect(formatGBP(250000)).toBe('£250,000');
  });

  it('handles null/undefined', () => {
    expect(formatGBP(null)).toBe('—');
    expect(formatGBP(undefined)).toBe('—');
  });

  it('formats zero', () => {
    expect(formatGBP(0)).toBe('£0');
  });
});

describe('formatGBPDecimal', () => {
  it('formats with 2 decimal places', () => {
    expect(formatGBPDecimal(1234.5)).toBe('£1,234.50');
  });

  it('handles null', () => {
    expect(formatGBPDecimal(null)).toBe('—');
  });
});

describe('formatGBPCompact', () => {
  it('formats millions', () => {
    expect(formatGBPCompact(1200000)).toBe('£1.2M');
  });

  it('formats thousands', () => {
    expect(formatGBPCompact(450000)).toBe('£450K');
  });

  it('formats small amounts', () => {
    expect(formatGBPCompact(500)).toBe('£500');
  });

  it('handles null', () => {
    expect(formatGBPCompact(null)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('formats with default 1 decimal', () => {
    expect(formatPercent(75.123)).toBe('75.1%');
  });

  it('formats with custom decimals', () => {
    expect(formatPercent(75.123, 2)).toBe('75.12%');
  });

  it('handles null', () => {
    expect(formatPercent(null)).toBe('—');
  });
});

describe('formatDateUK', () => {
  it('formats ISO string to DD/MM/YYYY', () => {
    const result = formatDateUK('2024-03-15');
    expect(result).toBe('15/03/2024');
  });

  it('handles null', () => {
    expect(formatDateUK(null)).toBe('—');
  });
});

describe('formatDateShort', () => {
  it('formats to short UK date', () => {
    const result = formatDateShort('2024-03-15');
    expect(result).toMatch(/15 Mar 2024/);
  });

  it('handles null', () => {
    expect(formatDateShort(null)).toBe('—');
  });
});

describe('calculateMonthlyMortgagePayment', () => {
  it('calculates interest-only payment', () => {
    const result = calculateMonthlyMortgagePayment({
      balance: 200000,
      interestRate: 5,
      termMonths: 300,
      isInterestOnly: true,
      paymentOverride: null,
    });
    expect(result.effective).toBeCloseTo(833.33, 0);
    expect(result.source).toBe('auto');
  });

  it('uses manual override when provided', () => {
    const result = calculateMonthlyMortgagePayment({
      balance: 200000,
      interestRate: 5,
      termMonths: 300,
      isInterestOnly: false,
      paymentOverride: 1000,
    });
    expect(result.effective).toBe(1000);
    expect(result.source).toBe('manual');
  });

  it('returns null when balance is null', () => {
    const result = calculateMonthlyMortgagePayment({
      balance: null,
      interestRate: 5,
      termMonths: 300,
      isInterestOnly: false,
      paymentOverride: null,
    });
    expect(result.effective).toBeNull();
  });

  it('calculates repayment mortgage', () => {
    const result = calculateMonthlyMortgagePayment({
      balance: 200000,
      interestRate: 5,
      termMonths: 300,
      isInterestOnly: false,
      paymentOverride: null,
    });
    expect(result.effective).not.toBeNull();
    expect(result.effective!).toBeGreaterThan(833); // More than interest-only
    expect(result.source).toBe('auto');
  });
});

describe('calculateLTV', () => {
  it('calculates LTV percentage', () => {
    expect(calculateLTV(150000, 200000)).toBeCloseTo(75.0);
  });

  it('returns null for null inputs', () => {
    expect(calculateLTV(null, 200000)).toBeNull();
    expect(calculateLTV(150000, null)).toBeNull();
    expect(calculateLTV(150000, 0)).toBeNull();
  });
});

describe('extractPostcodeArea', () => {
  it('extracts area from standard postcode', () => {
    expect(extractPostcodeArea('OX1 1AA')).toBe('OX');
  });

  it('handles London postcodes', () => {
    expect(extractPostcodeArea('SW1A 1AA')).toBe('SW');
  });

  it('handles null', () => {
    expect(extractPostcodeArea(null)).toBeNull();
  });
});
