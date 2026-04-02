import { describe, it, expect } from 'vitest';
import {
  calculateSection24,
  buildSA105,
  buildAnnualSummary,
  generateSA105CSV,
  type MarginalTaxRate,
  type SA105PropertyData,
} from '../propertyTax';

// ── Section 24 Calculation ──────────────────────────────────────────────

describe('calculateSection24', () => {
  it('calculates basic rate taxpayer correctly', () => {
    const result = calculateSection24(10000, 20000, 0.20);
    expect(result.totalMortgageInterest).toBe(10000);
    expect(result.taxReliefAt20Percent).toBe(2000);
    expect(result.taxSavedVsOldRules).toBe(2000);
    // Basic rate: no additional cost since old rules = 20% and credit = 20%
    expect(result.additionalTaxDueToS24).toBe(0);
  });

  it('calculates higher rate taxpayer correctly', () => {
    const result = calculateSection24(10000, 20000, 0.40);
    expect(result.taxReliefAt20Percent).toBe(2000);
    expect(result.taxSavedVsOldRules).toBe(4000);
    expect(result.additionalTaxDueToS24).toBe(2000);
  });

  it('calculates additional rate taxpayer correctly', () => {
    const result = calculateSection24(10000, 20000, 0.45);
    expect(result.taxReliefAt20Percent).toBe(2000);
    expect(result.taxSavedVsOldRules).toBe(4500);
    expect(result.additionalTaxDueToS24).toBe(2500);
  });

  it('calculates effective tax rate correctly for higher-rate payer', () => {
    const result = calculateSection24(5000, 30000, 0.40);
    // Tax on profit = 30000 * 0.40 = 12000
    // Credit = 5000 * 0.20 = 1000
    // Net = 11000
    // Effective = (11000 / 30000) * 100 = 36.67%
    expect(result.effectiveTaxRate).toBeCloseTo(36.67, 1);
  });

  it('handles zero mortgage interest', () => {
    const result = calculateSection24(0, 20000, 0.40);
    expect(result.totalMortgageInterest).toBe(0);
    expect(result.taxReliefAt20Percent).toBe(0);
    expect(result.additionalTaxDueToS24).toBe(0);
  });

  it('handles zero taxable profit', () => {
    const result = calculateSection24(5000, 0, 0.40);
    expect(result.effectiveTaxRate).toBe(0);
  });

  it('never returns negative additionalTaxDueToS24', () => {
    // Edge case: basic rate payer always has 0 additional tax
    const result = calculateSection24(1000, 500, 0.20);
    expect(result.additionalTaxDueToS24).toBe(0);
  });

  it('handles large values without overflow', () => {
    const result = calculateSection24(500000, 2000000, 0.45);
    expect(result.taxReliefAt20Percent).toBe(100000);
    expect(result.taxSavedVsOldRules).toBe(225000);
    expect(result.additionalTaxDueToS24).toBe(125000);
  });
});

// ── SA105 Builder ───────────────────────────────────────────────────────

describe('buildSA105', () => {
  const baseExpenses: Record<string, number> = {
    insurance: 500,
    management_fees: 1200,
    accountancy: 300,
    ground_rent: 200,
    service_charges: 1000,
    travel: 100,
    other: 50,
  };

  it('builds SA105 data with itemised expenses', () => {
    const result = buildSA105(
      'p1', '123 High St', 'e1', 'My SPV', 'spv',
      24000, 6000, 800, baseExpenses, false
    );
    expect(result.totalRentalIncome).toBe(24000);
    expect(result.insurance).toBe(500);
    expect(result.managementFees).toBe(1200);
    expect(result.accountingFees).toBe(300);
    expect(result.groundRent).toBe(200);
    expect(result.serviceCharges).toBe(1000);
    expect(result.otherAllowableExpenses).toBe(150); // travel 100 + other 50
    expect(result.repairs).toBe(800);
    // Total = 800 + 500 + 1200 + 300 + 200 + 1000 + 150 = 4150
    expect(result.totalAllowableExpenses).toBe(4150);
    expect(result.residentialFinanceCosts).toBe(6000);
  });

  it('calculates adjusted profit correctly', () => {
    const result = buildSA105(
      'p1', '123 High St', null, null, null,
      24000, 6000, 800, baseExpenses, false
    );
    // Profit = 24000 - 4150 = 19850
    expect(result.adjustedProfit).toBe(19850);
  });

  it('calculates 20% tax credit on mortgage interest', () => {
    const result = buildSA105(
      'p1', '123 High St', null, null, null,
      24000, 6000, 0, {}, false
    );
    expect(result.taxCreditAt20Percent).toBe(1200);
  });

  it('uses property allowance when enabled (capped at £1000)', () => {
    const result = buildSA105(
      'p1', '123 High St', null, null, null,
      24000, 6000, 800, baseExpenses, true
    );
    expect(result.usePropertyAllowance).toBe(true);
    expect(result.totalAllowableExpenses).toBe(1000);
  });

  it('caps property allowance at rental income if income < £1000', () => {
    const result = buildSA105(
      'p1', '123 High St', null, null, null,
      500, 0, 0, {}, true
    );
    expect(result.totalAllowableExpenses).toBe(500);
  });

  it('never produces negative adjusted profit', () => {
    const result = buildSA105(
      'p1', '123 High St', null, null, null,
      100, 0, 5000, baseExpenses, false
    );
    expect(result.adjustedProfit).toBe(0);
  });

  it('handles empty manual expenses', () => {
    const result = buildSA105(
      'p1', '123 High St', null, null, null,
      12000, 3000, 500, {}, false
    );
    expect(result.insurance).toBe(0);
    expect(result.managementFees).toBe(0);
    expect(result.totalAllowableExpenses).toBe(500); // just repairs
  });

  it('preserves entity metadata', () => {
    const result = buildSA105(
      'p1', '123 High St', 'e-abc', 'SPV Holdings Ltd', 'spv',
      10000, 0, 0, {}, false
    );
    expect(result.entityId).toBe('e-abc');
    expect(result.entityName).toBe('SPV Holdings Ltd');
    expect(result.entityType).toBe('spv');
  });
});

// ── Annual Summary ──────────────────────────────────────────────────────

describe('buildAnnualSummary', () => {
  function makeProperty(overrides: Partial<SA105PropertyData> = {}): SA105PropertyData {
    return {
      propertyId: 'p1',
      propertyAddress: '1 Test Lane',
      entityId: null,
      entityName: null,
      entityType: null,
      totalRentalIncome: 12000,
      usePropertyAllowance: false,
      repairs: 500,
      insurance: 300,
      managementFees: 600,
      accountingFees: 200,
      groundRent: 0,
      serviceCharges: 0,
      otherAllowableExpenses: 0,
      totalAllowableExpenses: 1600,
      residentialFinanceCosts: 3000,
      adjustedProfit: 10400,
      taxCreditAt20Percent: 600,
      ...overrides,
    };
  }

  it('aggregates totals across properties', () => {
    const props = [
      makeProperty({ totalRentalIncome: 12000, totalAllowableExpenses: 2000 }),
      makeProperty({ propertyId: 'p2', totalRentalIncome: 18000, totalAllowableExpenses: 3000 }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.40, 0.19);
    expect(summary.totalRentalIncome).toBe(30000);
    expect(summary.totalAllowableExpenses).toBe(5000);
    expect(summary.netPropertyIncome).toBe(25000);
  });

  it('applies corporation tax rate to SPV entities', () => {
    const props = [
      makeProperty({
        entityId: 'spv1', entityName: 'SPV Ltd', entityType: 'spv',
        totalRentalIncome: 20000, totalAllowableExpenses: 5000,
        residentialFinanceCosts: 3000,
      }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.40, 0.19);
    const spvBreakdown = summary.perEntityBreakdown[0];
    expect(spvBreakdown.applicableTaxRate).toBe(0.19);
    // SPV deducts interest: profit = 20000 - 5000 = 15000, after interest = 12000
    // Tax = 12000 * 0.19 = 2280
    expect(spvBreakdown.estimatedTax).toBe(2280);
    expect(spvBreakdown.section24Credit).toBe(0);
  });

  it('applies Section 24 to personal entities', () => {
    const props = [
      makeProperty({
        entityId: null, entityName: null, entityType: 'personal',
        totalRentalIncome: 20000, totalAllowableExpenses: 5000,
        residentialFinanceCosts: 3000,
      }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.40, 0.19);
    const breakdown = summary.perEntityBreakdown[0];
    expect(breakdown.applicableTaxRate).toBe(0.40);
    // Personal: tax on profit = 15000 * 0.40 = 6000
    // S24 credit = 3000 * 0.20 = 600
    expect(breakdown.estimatedTax).toBe(6000);
    expect(breakdown.section24Credit).toBe(600);
    expect(breakdown.netTax).toBe(5400);
  });

  it('treats limited_company same as spv', () => {
    const props = [
      makeProperty({
        entityId: 'lc1', entityName: 'LC Ltd', entityType: 'limited_company',
        totalRentalIncome: 10000, totalAllowableExpenses: 2000,
        residentialFinanceCosts: 1000,
      }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.40, 0.25);
    expect(summary.perEntityBreakdown[0].applicableTaxRate).toBe(0.25);
  });

  it('groups properties by entity', () => {
    const props = [
      makeProperty({ entityId: 'e1', entityName: 'SPV1', entityType: 'spv' }),
      makeProperty({ propertyId: 'p2', entityId: 'e1', entityName: 'SPV1', entityType: 'spv' }),
      makeProperty({ propertyId: 'p3', entityId: null, entityName: null, entityType: null }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.20, 0.19);
    expect(summary.perEntityBreakdown).toHaveLength(2);
  });

  it('handles empty properties array', () => {
    const summary = buildAnnualSummary('2024/25', [], 0.40, 0.19);
    expect(summary.totalRentalIncome).toBe(0);
    expect(summary.perEntityBreakdown).toHaveLength(0);
    expect(summary.estimatedTaxLiability).toBe(0);
  });

  it('never returns negative netTax', () => {
    const props = [
      makeProperty({
        entityId: null, entityName: null, entityType: 'personal',
        totalRentalIncome: 1000, totalAllowableExpenses: 900,
        residentialFinanceCosts: 50000, // huge mortgage interest
      }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.20, 0.19);
    const breakdown = summary.perEntityBreakdown[0];
    expect(breakdown.netTax).toBeGreaterThanOrEqual(0);
  });
});

// ── SA105 CSV Export ────────────────────────────────────────────────────

describe('generateSA105CSV', () => {
  it('generates CSV with headers and data row', () => {
    const sa105 = buildSA105('p1', '10 Downing St', null, null, null, 12000, 3000, 500, {}, false);
    const csv = generateSA105CSV([sa105]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Property Address');
    expect(lines[0]).toContain('Adjusted Profit');
    expect(lines[1]).toContain('"10 Downing St"');
  });

  it('handles multiple properties', () => {
    const props = [
      buildSA105('p1', 'Addr 1', null, null, null, 12000, 0, 0, {}, false),
      buildSA105('p2', 'Addr 2', null, null, null, 18000, 0, 0, {}, false),
    ];
    const csv = generateSA105CSV(props);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it('uses Personal when entityName is null', () => {
    const sa105 = buildSA105('p1', 'Addr', null, null, null, 12000, 0, 0, {}, false);
    const csv = generateSA105CSV([sa105]);
    expect(csv).toContain('"Personal"');
  });

  it('handles empty array', () => {
    const csv = generateSA105CSV([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1); // header only
  });
});

// ══════════════════════════════════════════════════════════════════════
// Part 2: tax-engine.ts module tests — CGT, Income Tax, SA105 (new module)
// ══════════════════════════════════════════════════════════════════════

import {
  calculateSection24 as calcS24Module,
  calculateCGT,
  calculateIncomeTax,
  calculateSA105,
  PERSONAL_ALLOWANCE,
  BASIC_RATE_LIMIT,
  HIGHER_RATE_LIMIT,
  BASIC_RATE,
  HIGHER_RATE,
  ADDITIONAL_RATE,
  CGT_ANNUAL_EXEMPT,
  CGT_BASIC_RATE_RESIDENTIAL,
  CGT_HIGHER_RATE_RESIDENTIAL,
  PROPERTY_ALLOWANCE,
} from '../tax-engine';

describe('tax-engine: calculateSection24', () => {
  it('basic rate relief at 20%', () => {
    const r = calcS24Module({ annualMortgageInterest: 10_000, rentalProfit: 20_000, marginalRate: BASIC_RATE });
    expect(r.basicRateRelief).toBe(2_000);
    expect(r.additionalTaxDueToS24).toBe(0);
  });

  it('higher rate additional tax', () => {
    const r = calcS24Module({ annualMortgageInterest: 10_000, rentalProfit: 20_000, marginalRate: HIGHER_RATE });
    expect(r.additionalTaxDueToS24).toBe(2_000);
  });

  it('effective tax rate for higher rate', () => {
    const r = calcS24Module({ annualMortgageInterest: 10_000, rentalProfit: 20_000, marginalRate: HIGHER_RATE });
    expect(r.effectiveTaxRate).toBeCloseTo(30, 1);
  });

  it('handles negative inputs', () => {
    const r = calcS24Module({ annualMortgageInterest: -5_000, rentalProfit: -10_000, marginalRate: -0.2 });
    expect(r.basicRateRelief).toBe(0);
    expect(r.effectiveTaxRate).toBe(0);
  });

  it('zero profit returns zero effective rate', () => {
    const r = calcS24Module({ annualMortgageInterest: 5_000, rentalProfit: 0, marginalRate: HIGHER_RATE });
    expect(r.effectiveTaxRate).toBe(0);
  });
});

describe('tax-engine: calculateCGT', () => {
  it('calculates gain correctly', () => {
    const r = calculateCGT({ salePrice: 300_000, purchasePrice: 200_000, allowableCosts: 10_000, taxableIncome: 30_000 });
    expect(r.gain).toBe(90_000);
    expect(r.exemption).toBe(CGT_ANNUAL_EXEMPT);
    expect(r.taxableGain).toBe(90_000 - CGT_ANNUAL_EXEMPT);
  });

  it('all basic rate when within band', () => {
    const r = calculateCGT({ salePrice: 210_000, purchasePrice: 200_000, allowableCosts: 0, taxableIncome: 30_000 });
    expect(r.basicRateAmount).toBe(7_000);
    expect(r.higherRateAmount).toBe(0);
    expect(r.totalCGT).toBeCloseTo(7_000 * CGT_BASIC_RATE_RESIDENTIAL, 2);
  });

  it('all higher rate when income exceeds basic band', () => {
    const r = calculateCGT({ salePrice: 300_000, purchasePrice: 200_000, allowableCosts: 0, taxableIncome: 60_000 });
    expect(r.basicRateAmount).toBe(0);
    expect(r.totalCGT).toBeCloseTo(r.taxableGain * CGT_HIGHER_RATE_RESIDENTIAL, 2);
  });

  it('zero CGT on a loss', () => {
    const r = calculateCGT({ salePrice: 180_000, purchasePrice: 200_000, allowableCosts: 5_000, taxableIncome: 30_000 });
    expect(r.gain).toBe(0);
    expect(r.totalCGT).toBe(0);
  });

  it('gain smaller than exempt amount', () => {
    const r = calculateCGT({ salePrice: 202_000, purchasePrice: 200_000, allowableCosts: 0, taxableIncome: 30_000 });
    expect(r.taxableGain).toBe(0);
    expect(r.totalCGT).toBe(0);
  });

  it('custom annual exempt amount', () => {
    const r = calculateCGT({ salePrice: 220_000, purchasePrice: 200_000, allowableCosts: 0, annualExemptAmount: 6_000, taxableIncome: 30_000 });
    expect(r.exemption).toBe(6_000);
    expect(r.taxableGain).toBe(14_000);
  });
});

describe('tax-engine: calculateIncomeTax', () => {
  it('zero tax within personal allowance', () => {
    const r = calculateIncomeTax({ grossIncome: 10_000 });
    expect(r.totalTax).toBe(0);
    expect(r.marginalRate).toBe(0);
  });

  it('basic rate tax', () => {
    const r = calculateIncomeTax({ grossIncome: 30_000 });
    expect(r.taxableIncome).toBe(17_430);
    expect(r.basicRateTax).toBeCloseTo(17_430 * BASIC_RATE, 2);
    expect(r.marginalRate).toBe(BASIC_RATE);
  });

  it('higher rate tax', () => {
    const r = calculateIncomeTax({ grossIncome: 80_000 });
    expect(r.basicRateTax).toBeCloseTo(7_540, 2);
    expect(r.higherRateTax).toBeCloseTo(11_892, 2);
    expect(r.marginalRate).toBe(HIGHER_RATE);
  });

  it('additional rate tax', () => {
    const r = calculateIncomeTax({ grossIncome: 200_000 });
    expect(r.additionalRateTax).toBeGreaterThan(0);
    expect(r.marginalRate).toBe(ADDITIONAL_RATE);
  });

  it('tapers personal allowance above £100k', () => {
    const r = calculateIncomeTax({ grossIncome: 110_000 });
    expect(r.personalAllowance).toBe(PERSONAL_ALLOWANCE - 5_000);
  });

  it('fully tapered PA at £125,140+', () => {
    const r = calculateIncomeTax({ grossIncome: 130_000 });
    expect(r.personalAllowance).toBe(0);
  });

  it('handles negative income', () => {
    const r = calculateIncomeTax({ grossIncome: -5_000 });
    expect(r.totalTax).toBe(0);
  });

  it('respects PA override', () => {
    const r = calculateIncomeTax({ grossIncome: 50_000, personalAllowance: 0 });
    expect(r.personalAllowance).toBe(0);
    expect(r.taxableIncome).toBe(50_000);
  });
});

describe('tax-engine: calculateSA105', () => {
  it('calculates with actual expenses', () => {
    const r = calculateSA105({ rentalIncome: 12_000, mortgageInterest: 5_000, repairs: 1_000, insurance: 500, managementFees: 1_200, otherExpenses: 300, usePropertyAllowance: false });
    expect(r.totalExpenses).toBe(3_000);
    expect(r.adjustedProfit).toBe(9_000);
    expect(r.taxReduction).toBe(1_000);
  });

  it('uses property allowance when elected', () => {
    const r = calculateSA105({ rentalIncome: 12_000, mortgageInterest: 5_000, repairs: 1_000, insurance: 500, managementFees: 1_200, otherExpenses: 300, usePropertyAllowance: true });
    expect(r.propertyAllowance).toBe(PROPERTY_ALLOWANCE);
    expect(r.totalExpenses).toBe(PROPERTY_ALLOWANCE);
  });

  it('caps property allowance at income', () => {
    const r = calculateSA105({ rentalIncome: 500, mortgageInterest: 0, repairs: 0, insurance: 0, managementFees: 0, otherExpenses: 0, usePropertyAllowance: true });
    expect(r.propertyAllowance).toBe(500);
    expect(r.adjustedProfit).toBe(0);
  });

  it('adjusted profit cannot go negative', () => {
    const r = calculateSA105({ rentalIncome: 5_000, mortgageInterest: 3_000, repairs: 4_000, insurance: 2_000, managementFees: 1_000, otherExpenses: 500, usePropertyAllowance: false });
    expect(r.adjustedProfit).toBe(0);
  });

  it('negative expenses clamped to 0', () => {
    const r = calculateSA105({ rentalIncome: 10_000, mortgageInterest: -2_000, repairs: -500, insurance: 200, managementFees: 0, otherExpenses: 0, usePropertyAllowance: false });
    expect(r.totalExpenses).toBe(200);
    expect(r.residentialFinanceCosts).toBe(0);
  });
});
