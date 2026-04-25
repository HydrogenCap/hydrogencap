import { describe, it, expect } from 'vitest';
import {
  calculateSection24,
  buildSA105,
  buildAnnualSummary,
  generateSA105CSV,
  TAX_EXPENSE_CATEGORIES,
  type SA105PropertyData,
} from '../propertyTax';

// ── calculateSection24 ──

describe('calculateSection24', () => {
  it('calculates basic-rate taxpayer correctly', () => {
    const result = calculateSection24(10_000, 20_000, 0.20);
    expect(result.totalMortgageInterest).toBe(10_000);
    expect(result.taxReliefAt20Percent).toBe(2_000);
    // Basic rate: old rules saving = 10k * 0.20 = 2k, same as credit → no extra
    expect(result.additionalTaxDueToS24).toBe(0);
  });

  it('calculates higher-rate taxpayer correctly', () => {
    const result = calculateSection24(10_000, 20_000, 0.40);
    expect(result.totalMortgageInterest).toBe(10_000);
    expect(result.taxReliefAt20Percent).toBe(2_000);
    // Old rules: 10k * 0.40 = 4k, credit = 2k → extra = 2k
    expect(result.additionalTaxDueToS24).toBe(2_000);
    expect(result.taxSavedVsOldRules).toBe(4_000);
  });

  it('calculates additional-rate taxpayer correctly', () => {
    const result = calculateSection24(10_000, 20_000, 0.45);
    expect(result.taxReliefAt20Percent).toBe(2_000);
    expect(result.additionalTaxDueToS24).toBe(2_500);
  });

  it('calculates effective tax rate', () => {
    const result = calculateSection24(5_000, 30_000, 0.40);
    // Tax on profit = 30k * 0.40 = 12k, credit = 5k * 0.20 = 1k, net = 11k
    // Effective = (11k / 30k) * 100 = 36.67%
    expect(result.effectiveTaxRate).toBeCloseTo(36.67, 1);
  });

  it('returns 0 effective rate when no profit', () => {
    const result = calculateSection24(5_000, 0, 0.40);
    expect(result.effectiveTaxRate).toBe(0);
  });

  it('never returns negative additionalTaxDueToS24', () => {
    const result = calculateSection24(0, 10_000, 0.20);
    expect(result.additionalTaxDueToS24).toBe(0);
  });

  it('handles zero interest', () => {
    const result = calculateSection24(0, 50_000, 0.40);
    expect(result.taxReliefAt20Percent).toBe(0);
    expect(result.additionalTaxDueToS24).toBe(0);
  });
});

// ── buildSA105 ──

describe('buildSA105', () => {
  const baseArgs = [
    'prop-1', '123 High St', 'entity-1', 'My SPV', 'spv',
    24_000, 6_000, 2_000,
  ] as const;

  it('calculates total allowable expenses from manual entries', () => {
    const result = buildSA105(
      ...baseArgs,
      { insurance: 500, management_fees: 1_200, accountancy: 300, ground_rent: 100, service_charges: 400, travel: 200, other: 100 },
      false,
    );
    expect(result.insurance).toBe(500);
    expect(result.managementFees).toBe(1_200);
    expect(result.accountingFees).toBe(300);
    expect(result.groundRent).toBe(100);
    expect(result.serviceCharges).toBe(400);
    expect(result.otherAllowableExpenses).toBe(300); // travel + other
    // Total = repairs(2k) + 500 + 1200 + 300 + 100 + 400 + 300 = 4800
    expect(result.totalAllowableExpenses).toBe(4_800);
  });

  it('calculates adjusted profit as income minus expenses (floor 0)', () => {
    const result = buildSA105(
      'p1', 'Addr', null, null, null,
      10_000, 0, 500, {}, false,
    );
    expect(result.adjustedProfit).toBe(9_500);
  });

  it('floors adjusted profit at zero', () => {
    const result = buildSA105(
      'p1', 'Addr', null, null, null,
      1_000, 0, 5_000, {}, false,
    );
    expect(result.adjustedProfit).toBe(0);
  });

  it('applies property allowance (capped at £1000)', () => {
    const result = buildSA105(
      'p1', 'Addr', null, null, null,
      24_000, 0, 5_000,
      { insurance: 2_000 },
      true,
    );
    expect(result.totalAllowableExpenses).toBe(1_000);
    expect(result.usePropertyAllowance).toBe(true);
  });

  it('caps property allowance at rental income', () => {
    const result = buildSA105(
      'p1', 'Addr', null, null, null,
      500, 0, 0, {}, true,
    );
    expect(result.totalAllowableExpenses).toBe(500);
  });

  it('calculates 20% tax credit on mortgage interest', () => {
    const result = buildSA105(
      'p1', 'Addr', null, null, null,
      20_000, 8_000, 0, {}, false,
    );
    expect(result.taxCreditAt20Percent).toBe(1_600);
    expect(result.residentialFinanceCosts).toBe(8_000);
  });

  it('handles empty manual expenses', () => {
    const result = buildSA105(
      'p1', 'Addr', null, null, null,
      12_000, 0, 1_000, {}, false,
    );
    expect(result.insurance).toBe(0);
    expect(result.managementFees).toBe(0);
    expect(result.totalAllowableExpenses).toBe(1_000);
  });
});

// ── buildAnnualSummary ──

describe('buildAnnualSummary', () => {
  function makeProperty(overrides: Partial<SA105PropertyData> = {}): SA105PropertyData {
    return {
      propertyId: 'p1',
      propertyAddress: '1 Test St',
      entityId: null,
      entityName: null,
      entityType: null,
      totalRentalIncome: 12_000,
      usePropertyAllowance: false,
      repairs: 1_000,
      insurance: 200,
      managementFees: 500,
      accountingFees: 100,
      groundRent: 0,
      serviceCharges: 0,
      otherAllowableExpenses: 0,
      totalAllowableExpenses: 1_800,
      residentialFinanceCosts: 3_000,
      adjustedProfit: 10_200,
      taxCreditAt20Percent: 600,
      ...overrides,
    };
  }

  it('aggregates totals across properties', () => {
    const props = [
      makeProperty({ totalRentalIncome: 10_000, totalAllowableExpenses: 2_000, residentialFinanceCosts: 1_000 }),
      makeProperty({ propertyId: 'p2', totalRentalIncome: 15_000, totalAllowableExpenses: 3_000, residentialFinanceCosts: 2_000 }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.40, 0.25);
    expect(summary.totalRentalIncome).toBe(25_000);
    expect(summary.totalAllowableExpenses).toBe(5_000);
    expect(summary.totalResidentialFinanceCosts).toBe(3_000);
    expect(summary.netPropertyIncome).toBe(20_000);
  });

  it('applies Section 24 for personal entities', () => {
    const props = [
      makeProperty({
        entityType: 'personal',
        totalRentalIncome: 20_000,
        totalAllowableExpenses: 5_000,
        residentialFinanceCosts: 4_000,
        adjustedProfit: 15_000,
      }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.40, 0.25);
    const personal = summary.perEntityBreakdown[0];
    expect(personal.section24Credit).toBe(800); // 4000 * 0.20
    expect(personal.estimatedTax).toBe(6_000); // 15000 * 0.40
    expect(personal.netTax).toBe(5_200); // 6000 - 800
  });

  it('deducts interest for SPV entities (no Section 24)', () => {
    const props = [
      makeProperty({
        entityId: 'spv-1',
        entityName: 'My SPV Ltd',
        entityType: 'spv',
        totalRentalIncome: 20_000,
        totalAllowableExpenses: 5_000,
        residentialFinanceCosts: 4_000,
      }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.40, 0.25);
    const spv = summary.perEntityBreakdown[0];
    expect(spv.section24Credit).toBe(0);
    // profit = 20k - 5k = 15k, after interest = 15k - 4k = 11k, tax = 11k * 0.25 = 2750
    expect(spv.estimatedTax).toBe(2_750);
    expect(spv.netTax).toBe(2_750);
  });

  it('groups properties by entity', () => {
    const props = [
      makeProperty({ entityId: 'e1', entityName: 'SPV A', entityType: 'spv' }),
      makeProperty({ propertyId: 'p2', entityId: 'e1', entityName: 'SPV A', entityType: 'spv' }),
      makeProperty({ propertyId: 'p3', entityId: null, entityName: null, entityType: null }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.40, 0.25);
    expect(summary.perEntityBreakdown).toHaveLength(2);
  });

  it('handles limited_company like SPV', () => {
    const props = [
      makeProperty({
        entityId: 'lc-1',
        entityName: 'Ltd Co',
        entityType: 'limited_company',
        totalRentalIncome: 10_000,
        totalAllowableExpenses: 2_000,
        residentialFinanceCosts: 1_000,
      }),
    ];
    const summary = buildAnnualSummary('2024/25', props, 0.40, 0.19);
    const entity = summary.perEntityBreakdown[0];
    expect(entity.applicableTaxRate).toBe(0.19);
    expect(entity.section24Credit).toBe(0);
  });

  it('handles empty properties array', () => {
    const summary = buildAnnualSummary('2024/25', [], 0.40, 0.25);
    expect(summary.totalRentalIncome).toBe(0);
    expect(summary.perEntityBreakdown).toHaveLength(0);
  });
});

// ── generateSA105CSV ──

describe('generateSA105CSV', () => {
  it('generates CSV with correct headers', () => {
    const csv = generateSA105CSV([]);
    const headers = csv.split('\n')[0];
    expect(headers).toContain('Property Address');
    expect(headers).toContain('Total Rental Income');
    expect(headers).toContain('Tax Credit (20%)');
  });

  it('includes property rows', () => {
    const prop: SA105PropertyData = {
      propertyId: 'p1',
      propertyAddress: '1 Test Street',
      entityId: null,
      entityName: null,
      entityType: null,
      totalRentalIncome: 12_000,
      usePropertyAllowance: false,
      repairs: 500,
      insurance: 200,
      managementFees: 300,
      accountingFees: 100,
      groundRent: 0,
      serviceCharges: 0,
      otherAllowableExpenses: 0,
      totalAllowableExpenses: 1_100,
      residentialFinanceCosts: 2_000,
      adjustedProfit: 10_900,
      taxCreditAt20Percent: 400,
    };
    const csv = generateSA105CSV([prop]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[1]).toContain('1 Test Street');
    expect(lines[1]).toContain('12000');
  });
});

// ── TAX_EXPENSE_CATEGORIES ──

describe('TAX_EXPENSE_CATEGORIES', () => {
  it('contains expected categories', () => {
    const values = TAX_EXPENSE_CATEGORIES.map(c => c.value);
    expect(values).toContain('insurance');
    expect(values).toContain('management_fees');
    expect(values).toContain('accountancy');
    expect(values).toContain('other');
  });

  it('has labels for all categories', () => {
    for (const cat of TAX_EXPENSE_CATEGORIES) {
      expect(cat.label).toBeTruthy();
      expect(cat.value).toBeTruthy();
    }
  });
});
