import { describe, it, expect } from 'vitest';
import {
  calculateIncomeTax,
  calculateSection24Impact,
  calculateCGT,
  getMarginalRate,
  CGT_RATES,
} from '../tax-engine';

describe('calculateIncomeTax', () => {
  it('returns 0 for income within personal allowance', () => {
    expect(calculateIncomeTax(12_570, 12_570)).toBe(0);
  });

  it('returns 0 for zero income', () => {
    expect(calculateIncomeTax(0, 12_570)).toBe(0);
  });

  it('calculates basic rate tax correctly', () => {
    // £20,000 income: taxable = 20000 - 12570 = 7430 at 20%
    expect(calculateIncomeTax(20_000, 12_570)).toBe(7_430 * 0.2);
  });

  it('calculates tax at the top of the basic rate band', () => {
    // £50,270 income: taxable = 50270 - 12570 = 37700 at 20%
    expect(calculateIncomeTax(50_270, 12_570)).toBe(37_700 * 0.2);
  });

  it('calculates higher rate tax correctly', () => {
    // £60,000 income: basic = 37700 at 20%, higher = (60000-12570-37700) = 9730 at 40%
    const basicTax = 37_700 * 0.2;
    const higherTax = 9_730 * 0.4;
    expect(calculateIncomeTax(60_000, 12_570)).toBe(basicTax + higherTax);
  });

  it('calculates tax at the higher-additional boundary (£125,140)', () => {
    // At £125,140, PA is fully tapered to 0: reduction = (125140-100000)/2 = 12570
    // taxable = 125140, basic band width = 50270-12570 = 37700
    // basic tax = 37700 * 0.20 = 7540
    // remaining = 125140 - 37700 = 87440; higher band width = 125140-50270 = 74870
    // higher tax = 74870 * 0.40 = 29948
    // additional = 87440 - 74870 = 12570 at 0.45 = 5656.50
    // total = 7540 + 29948 + 5656.50 = 43144.50
    expect(calculateIncomeTax(125_140, 12_570)).toBe(43_144.5);
  });

  it('calculates additional rate tax correctly', () => {
    // £200,000: PA fully tapered, taxable = 200000
    const basicBand = 37_700;
    const higherBand = 125_140 - 50_270; // 74870
    const additionalBand = 200_000 - basicBand - higherBand; // above basic+higher taxable
    const basicTax = basicBand * 0.2;
    const higherTax = higherBand * 0.4;
    const additionalTax = (200_000 - basicBand - higherBand) * 0.45;
    expect(calculateIncomeTax(200_000, 12_570)).toBe(basicTax + higherTax + additionalTax);
  });

  it('tapers personal allowance above £100k', () => {
    // £110,000: reduction = (110000-100000)/2 = 5000, effective PA = 7570
    // taxable = 110000 - 7570 = 102430
    const taxAt110k = calculateIncomeTax(110_000, 12_570);
    // Same income but with 0 PA (no tapering benefit) would be higher
    const taxNoPA = calculateIncomeTax(110_000, 0);
    expect(taxAt110k).toBeLessThan(taxNoPA);
  });

  it('fully tapers personal allowance at £125,140', () => {
    // At £125,140, reduction = (125140-100000)/2 = 12570, PA = 0
    const taxWithPA = calculateIncomeTax(125_140, 12_570);
    const taxNoPA = calculateIncomeTax(125_140, 0);
    expect(taxWithPA).toBe(taxNoPA);
  });

  it('handles custom personal allowance', () => {
    const tax = calculateIncomeTax(20_000, 0);
    // No allowance: full 20000 is taxable at basic rate
    expect(tax).toBe(20_000 * 0.2);
  });
});

describe('getMarginalRate', () => {
  it('returns 0 for income within personal allowance', () => {
    expect(getMarginalRate(10_000, 12_570)).toBe(0);
  });

  it('returns basic rate for income in basic band', () => {
    expect(getMarginalRate(30_000, 12_570)).toBe(0.2);
  });

  it('returns higher rate for income in higher band', () => {
    expect(getMarginalRate(80_000, 12_570)).toBe(0.4);
  });

  it('returns additional rate for income above £125,140', () => {
    expect(getMarginalRate(200_000, 12_570)).toBe(0.45);
  });
});

describe('calculateSection24Impact', () => {
  const baseParams = {
    grossRent: 24_000,
    allowableExpenses: 4_000,
    financeCosts: 6_000,
    otherIncome: 30_000,
    personalAllowance: 12_570,
  };

  it('calculates old system tax (finance costs deducted)', () => {
    const result = calculateSection24Impact(baseParams);
    // Old net = max(0, 24000-4000-6000) = 14000; total = 44000
    expect(result.oldSystemTax).toBeGreaterThan(0);
  });

  it('calculates new system tax (finance credit at 20%)', () => {
    const result = calculateSection24Impact(baseParams);
    // New net = max(0, 24000-4000) = 20000; total = 50000; credit = 6000*0.2 = 1200
    expect(result.financeCredit).toBe(6_000 * 0.2);
  });

  it('shows additional tax due to section 24', () => {
    const result = calculateSection24Impact(baseParams);
    expect(result.additionalTaxDueToSection24).toBe(
      Math.max(0, result.newSystemTax - result.oldSystemTax)
    );
  });

  it('returns 0 additional tax when no finance costs', () => {
    const result = calculateSection24Impact({ ...baseParams, financeCosts: 0 });
    expect(result.additionalTaxDueToSection24).toBe(0);
    expect(result.financeCredit).toBe(0);
  });

  it('calculates effective rates', () => {
    const result = calculateSection24Impact(baseParams);
    expect(result.effectiveRate).toBeGreaterThan(0);
    expect(result.oldEffectiveRate).toBeGreaterThan(0);
  });

  it('handles zero gross rent', () => {
    const result = calculateSection24Impact({ ...baseParams, grossRent: 0 });
    expect(result.effectiveRate).toBe(0);
  });
});

describe('calculateCGT', () => {
  it('calculates basic rate CGT at 18%', () => {
    const result = calculateCGT({
      purchasePrice: 200_000,
      currentValue: 300_000,
      improvementCosts: 10_000,
      annualExemptAmount: 3_000,
      taxpayerRate: 'basic',
    });
    // gain = 300000 - 200000 - 10000 = 90000
    // taxableGain = 90000 - 3000 = 87000
    expect(result.gain).toBe(90_000);
    expect(result.taxableGain).toBe(87_000);
    expect(result.cgt).toBe(87_000 * 0.18);
    expect(result.rate).toBe(0.18);
  });

  it('calculates higher rate CGT at 24%', () => {
    const result = calculateCGT({
      purchasePrice: 200_000,
      currentValue: 300_000,
      improvementCosts: 10_000,
      annualExemptAmount: 3_000,
      taxpayerRate: 'higher',
    });
    expect(result.cgt).toBe(87_000 * 0.24);
    expect(result.rate).toBe(0.24);
  });

  it('applies annual exempt amount correctly', () => {
    const result = calculateCGT({
      purchasePrice: 200_000,
      currentValue: 203_000,
      improvementCosts: 0,
      annualExemptAmount: 3_000,
      taxpayerRate: 'basic',
    });
    // gain = 3000, exempt = 3000 → taxable = 0
    expect(result.gain).toBe(3_000);
    expect(result.taxableGain).toBe(0);
    expect(result.cgt).toBe(0);
  });

  it('handles zero gain', () => {
    const result = calculateCGT({
      purchasePrice: 200_000,
      currentValue: 200_000,
      improvementCosts: 0,
      annualExemptAmount: 3_000,
      taxpayerRate: 'basic',
    });
    expect(result.gain).toBe(0);
    expect(result.taxableGain).toBe(0);
    expect(result.cgt).toBe(0);
  });

  it('handles negative gain (loss)', () => {
    const result = calculateCGT({
      purchasePrice: 200_000,
      currentValue: 180_000,
      improvementCosts: 5_000,
      annualExemptAmount: 3_000,
      taxpayerRate: 'higher',
    });
    // gain = 180000 - 200000 - 5000 = -25000
    expect(result.gain).toBe(-25_000);
    expect(result.taxableGain).toBe(0);
    expect(result.cgt).toBe(0);
  });

  it('preserves annual exempt amount in result', () => {
    const result = calculateCGT({
      purchasePrice: 100_000,
      currentValue: 150_000,
      improvementCosts: 0,
      annualExemptAmount: CGT_RATES.annualExemptAmount,
      taxpayerRate: 'basic',
    });
    expect(result.annualExemptAmount).toBe(3_000);
  });
});
