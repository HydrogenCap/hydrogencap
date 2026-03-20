import { describe, it, expect } from 'vitest';
import { calculateHealthScore, getHealthGrade, getHealthStatus } from './calculations';

describe('calculateHealthScore', () => {
  const healthy = {
    annualRent: 12000,
    totalCosts: 2000,
    mortgagePayment: 400,
    ltv: 50,
    fixedRateExpires: null,
    isInterestOnly: false,
    epcRating: 'C',
  };

  it('returns max score for ideal property', () => {
    const result = calculateHealthScore(healthy);
    expect(result.total).toBeGreaterThanOrEqual(85);
    expect(result.cashflow).toBeGreaterThan(0);
    expect(result.leverage).toBe(25);
    expect(result.risk).toBe(25);
    expect(result.compliance).toBe(25);
  });

  it('penalises high LTV', () => {
    const result = calculateHealthScore({ ...healthy, ltv: 85 });
    expect(result.leverage).toBeLessThan(25);
  });

  it('penalises interest-only mortgages', () => {
    const result = calculateHealthScore({ ...healthy, isInterestOnly: true });
    expect(result.risk).toBeLessThan(25);
  });

  it('penalises poor EPC rating', () => {
    const result = calculateHealthScore({ ...healthy, epcRating: 'F' });
    expect(result.compliance).toBeLessThan(25);
  });

  it('penalises missing gas safety', () => {
    const result = calculateHealthScore({ ...healthy, hasGasSafety: false });
    expect(result.compliance).toBe(10); // 25 - 15
  });

  it('penalises missing EICR', () => {
    const result = calculateHealthScore({ ...healthy, hasEICR: false });
    expect(result.compliance).toBe(15); // 25 - 10
  });

  it('handles null rent gracefully', () => {
    const result = calculateHealthScore({ ...healthy, annualRent: null });
    expect(result.cashflow).toBe(0);
  });

  it('no EPC penalty for listed buildings', () => {
    const result = calculateHealthScore({ ...healthy, epcRating: null, epcRequired: false });
    expect(result.compliance).toBe(25);
  });
});

describe('getHealthGrade', () => {
  it('A for >= 85', () => expect(getHealthGrade(90)).toBe('A'));
  it('B for >= 70', () => expect(getHealthGrade(75)).toBe('B'));
  it('C for >= 55', () => expect(getHealthGrade(60)).toBe('C'));
  it('D for >= 40', () => expect(getHealthGrade(45)).toBe('D'));
  it('F for < 40', () => expect(getHealthGrade(30)).toBe('F'));
});

describe('getHealthStatus', () => {
  it('success for A/B', () => {
    expect(getHealthStatus('A')).toBe('success');
    expect(getHealthStatus('B')).toBe('success');
  });
  it('warning for C', () => expect(getHealthStatus('C')).toBe('warning'));
  it('danger for D/F', () => {
    expect(getHealthStatus('D')).toBe('danger');
    expect(getHealthStatus('F')).toBe('danger');
  });
});
