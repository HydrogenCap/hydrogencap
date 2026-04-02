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
