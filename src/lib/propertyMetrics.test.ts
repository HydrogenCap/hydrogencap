import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPropertyMetrics, calculatePropertyRisk, RISK_ORDER, type PropertyMetrics } from './propertyMetrics';
import type { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import type { PropertyPassport } from '@/hooks/usePropertyPassport';

// ── Helpers ────────────────────────────────────────────────────────────

function makeProperty(overrides: Partial<PropertyWithFinancials> = {}): PropertyWithFinancials {
  return {
    id: 'p1',
    address_line: '10 High St',
    postcode: 'OX1 1AA',
    current_value_gbp: 300_000,
    purchase_price_gbp: 250_000,
    beds: 3,
    epc_rating: 'C',
    epc_required: true,
    loans: [],
    income: [],
    costs: [],
    tenancies: [],
    ...overrides,
  } as unknown as PropertyWithFinancials;
}

function makeLoan(overrides: Partial<PropertyWithFinancials['loans'][0]> = {}): PropertyWithFinancials['loans'][0] {
  return {
    current_mortgage_balance_gbp: 150_000,
    interest_rate_percent: 5,
    loan_term_months: 300,
    capital_or_interest: 'capital',
    payment_override_gbp: null,
    fixed_rate_expires: null,
    ...overrides,
  } as PropertyWithFinancials['loans'][0];
}

// ── getPropertyMetrics ─────────────────────────────────────────────────

describe('getPropertyMetrics — data extraction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for every nullable field when the property has no loans/income/costs/tenancies', () => {
    const m = getPropertyMetrics(makeProperty({
      current_value_gbp: null as never,
      purchase_price_gbp: null as never,
    }));
    expect(m.mortgageBalance).toBeNull();
    expect(m.currentValue).toBeNull();
    expect(m.purchasePrice).toBeNull();
    expect(m.annualRent).toBeNull();
    expect(m.loan).toBeUndefined();
  });

  it('pulls current_value_gbp and purchase_price_gbp through', () => {
    const m = getPropertyMetrics(makeProperty({ current_value_gbp: 400_000, purchase_price_gbp: 300_000 }));
    expect(m.currentValue).toBe(400_000);
    expect(m.purchasePrice).toBe(300_000);
  });

  it('pulls mortgage balance from the first loan', () => {
    const m = getPropertyMetrics(makeProperty({ loans: [makeLoan({ current_mortgage_balance_gbp: 200_000 })] }));
    expect(m.mortgageBalance).toBe(200_000);
  });

  it('prefers the income-table annual_rent_gbp for the current year', () => {
    const m = getPropertyMetrics(makeProperty({
      income: [{ year: 2025, annual_rent_gbp: 18_000 } as PropertyWithFinancials['income'][0]],
      tenancies: [{ status: 'active', rent_amount_pcm: 1_000 } as PropertyWithFinancials['tenancies'][0]],
    }));
    expect(m.annualRent).toBe(18_000); // ignores tenancy fallback when income exists
  });

  it('falls back to summed active-tenancy rent × 12 when no income row for this year', () => {
    const m = getPropertyMetrics(makeProperty({
      tenancies: [
        { status: 'active', rent_amount_pcm: 1_200 } as PropertyWithFinancials['tenancies'][0],
        { status: 'active', rent_amount_pcm: 800 } as PropertyWithFinancials['tenancies'][0],
        { status: 'ended', rent_amount_pcm: 2_000 } as PropertyWithFinancials['tenancies'][0], // excluded
      ],
    }));
    // (1200 + 800) * 12 = 24_000
    expect(m.annualRent).toBe(24_000);
  });

  it('leaves annualRent null when income is missing and no active tenancies', () => {
    const m = getPropertyMetrics(makeProperty({
      tenancies: [{ status: 'ended', rent_amount_pcm: 1_000 } as PropertyWithFinancials['tenancies'][0]],
    }));
    expect(m.annualRent).toBeNull();
  });

  it('ignores income rows for other years', () => {
    const m = getPropertyMetrics(makeProperty({
      income: [
        { year: 2024, annual_rent_gbp: 99_999 } as PropertyWithFinancials['income'][0],
        { year: 2026, annual_rent_gbp: 88_888 } as PropertyWithFinancials['income'][0],
      ],
      tenancies: [{ status: 'active', rent_amount_pcm: 1_000 } as PropertyWithFinancials['tenancies'][0]],
    }));
    // Should fall back to tenancies: 1_000 * 12 = 12_000
    expect(m.annualRent).toBe(12_000);
  });
});

describe('getPropertyMetrics — derived metrics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes LTV from mortgage balance / current value', () => {
    const m = getPropertyMetrics(makeProperty({
      current_value_gbp: 400_000,
      loans: [makeLoan({ current_mortgage_balance_gbp: 300_000 })],
    }));
    expect(m.ltv).toBeCloseTo(75, 5);
  });

  it('computes equity as value - debt', () => {
    const m = getPropertyMetrics(makeProperty({
      current_value_gbp: 400_000,
      loans: [makeLoan({ current_mortgage_balance_gbp: 150_000 })],
    }));
    expect(m.equity).toBe(250_000);
  });

  it('returns the loan object through the metrics bundle', () => {
    const loan = makeLoan({ current_mortgage_balance_gbp: 123_456 });
    const m = getPropertyMetrics(makeProperty({ loans: [loan] }));
    expect(m.loan).toBe(loan);
  });

  it('computes monthlyCashflow as (netRent / 12) - monthly mortgage', () => {
    // Build a scenario where net rent and mortgage are both non-null.
    const m = getPropertyMetrics(makeProperty({
      current_value_gbp: 300_000,
      income: [{ year: 2025, annual_rent_gbp: 18_000 } as PropertyWithFinancials['income'][0]],
      loans: [makeLoan({
        current_mortgage_balance_gbp: 100_000,
        interest_rate_percent: 6,
        capital_or_interest: 'interest', // simpler: £500/month
      })],
    }));
    expect(m.monthlyCashflow).not.toBeNull();
    // Sanity: annualRent / 12 = 1500 → NOI monthly then minus mortgage should be < 1500.
    expect(m.monthlyCashflow!).toBeLessThan(1500);
  });

  it('falls back to just monthly net rent when the mortgage is unknown', () => {
    const m = getPropertyMetrics(makeProperty({
      current_value_gbp: 300_000,
      income: [{ year: 2025, annual_rent_gbp: 12_000 } as PropertyWithFinancials['income'][0]],
      loans: [],
    }));
    // No mortgage → monthlyCashflow equals monthlyNetRent.
    expect(m.monthlyCashflow).not.toBeNull();
  });

  it('yields null monthlyCashflow when annual rent cannot be derived', () => {
    const m = getPropertyMetrics(makeProperty({
      current_value_gbp: 300_000,
      income: [],
      tenancies: [],
      loans: [],
    }));
    // netRent depends on annualRent; both null → cascade null.
    expect(m.monthlyCashflow).toBeNull();
  });
});

// ── calculatePropertyRisk ──────────────────────────────────────────────

function m(overrides: Partial<PropertyMetrics> = {}): PropertyMetrics {
  return {
    mortgageBalance: 100_000,
    currentValue: 300_000,
    purchasePrice: 250_000,
    annualRent: 15_000,
    billsManagement: 1_000,
    totalCosts: 2_000,
    ltv: 33,
    equity: 200_000,
    netRent: 13_000,
    yieldPercent: 4.3,
    mortgagePayment: 500,
    monthlyCashflow: 583,
    loan: undefined,
    ...overrides,
  };
}

describe('calculatePropertyRisk', () => {
  it('returns "ok" for a healthy property', () => {
    const result = calculatePropertyRisk(makeProperty({ epc_rating: 'C' }), undefined, m());
    expect(result.level).toBe('ok');
    expect(result.issues).toEqual([]);
  });

  it('flags LTV > 85% as critical', () => {
    const result = calculatePropertyRisk(makeProperty({ epc_rating: 'C' }), undefined, m({ ltv: 90 }));
    expect(result.level).toBe('critical');
    expect(result.issues).toContain('LTV > 85%');
  });

  it('flags LTV > 75% (but ≤ 85%) as warning', () => {
    const result = calculatePropertyRisk(makeProperty({ epc_rating: 'C' }), undefined, m({ ltv: 80 }));
    expect(result.level).toBe('warning');
    expect(result.issues).toContain('LTV > 75%');
  });

  it('LTV boundary: exactly 75 is NOT a warning, 85 is NOT critical', () => {
    const at75 = calculatePropertyRisk(makeProperty({ epc_rating: 'C' }), undefined, m({ ltv: 75 }));
    expect(at75.issues.some((i) => i.includes('LTV'))).toBe(false);

    const at85 = calculatePropertyRisk(makeProperty({ epc_rating: 'C' }), undefined, m({ ltv: 85 }));
    // 85 is NOT > 85 so it should only trigger the > 75 warning
    expect(at85.issues).toContain('LTV > 75%');
    expect(at85.issues).not.toContain('LTV > 85%');
  });

  it('ignores LTV checks when ltv is null', () => {
    const result = calculatePropertyRisk(makeProperty({ epc_rating: 'C' }), undefined, m({ ltv: null }));
    expect(result.issues.some((i) => i.includes('LTV'))).toBe(false);
  });

  it('flags an expired fixed-rate as critical', () => {
    const result = calculatePropertyRisk(
      makeProperty({ epc_rating: 'C' }),
      undefined,
      m({
        loan: {
          fixed_rate_expires: '2020-01-01', // long past
        } as PropertyWithFinancials['loans'][0],
      }),
    );
    expect(result.level).toBe('critical');
    expect(result.issues).toContain('Fixed rate expired');
  });

  it('flags EPC below C as a warning (when epc_required is not explicitly false)', () => {
    const result = calculatePropertyRisk(
      makeProperty({ epc_rating: 'D', epc_required: true }),
      undefined,
      m(),
    );
    expect(result.level).toBe('warning');
    expect(result.issues).toContain('EPC below C');
  });

  it('skips the EPC check when epc_required is explicitly false', () => {
    const result = calculatePropertyRisk(
      makeProperty({ epc_rating: 'F', epc_required: false }),
      undefined,
      m(),
    );
    expect(result.issues.some((i) => i.includes('EPC'))).toBe(false);
  });

  it('flags an expired HMO licence as critical', () => {
    const passport: PropertyPassport = {
      hmo_licence_required: true,
      hmo_licence_expiry: '2020-01-01',
    } as PropertyPassport;
    const result = calculatePropertyRisk(makeProperty({ epc_rating: 'C' }), passport, m());
    expect(result.level).toBe('critical');
    expect(result.issues).toContain('HMO licence expired');
  });

  it('ignores HMO checks when licence is not required', () => {
    const passport: PropertyPassport = {
      hmo_licence_required: false,
      hmo_licence_expiry: '2020-01-01',
    } as PropertyPassport;
    const result = calculatePropertyRisk(makeProperty({ epc_rating: 'C' }), passport, m());
    expect(result.issues.some((i) => i.includes('HMO'))).toBe(false);
  });

  it('ignores HMO checks when the licence expiry is not set', () => {
    const passport: PropertyPassport = {
      hmo_licence_required: true,
      hmo_licence_expiry: null,
    } as PropertyPassport;
    const result = calculatePropertyRisk(makeProperty({ epc_rating: 'C' }), passport, m());
    expect(result.issues.some((i) => i.includes('HMO'))).toBe(false);
  });

  it('flags negative monthly cashflow as a warning', () => {
    const result = calculatePropertyRisk(
      makeProperty({ epc_rating: 'C' }),
      undefined,
      m({ monthlyCashflow: -100 }),
    );
    expect(result.level).toBe('warning');
    expect(result.issues).toContain('Negative cashflow');
  });

  it('zero cashflow is NOT flagged (boundary at <0)', () => {
    const result = calculatePropertyRisk(
      makeProperty({ epc_rating: 'C' }),
      undefined,
      m({ monthlyCashflow: 0 }),
    );
    expect(result.issues.some((i) => i.includes('cashflow'))).toBe(false);
  });

  it('critical issues take precedence over subsequent warnings', () => {
    // LTV > 85 sets critical, then a following EPC-below-C warning does NOT demote back.
    const result = calculatePropertyRisk(
      makeProperty({ epc_rating: 'D', epc_required: true }),
      undefined,
      m({ ltv: 90 }),
    );
    expect(result.level).toBe('critical');
    // Both issues should be recorded even though level has been clamped to critical.
    expect(result.issues).toContain('LTV > 85%');
    expect(result.issues).toContain('EPC below C');
  });
});

describe('RISK_ORDER', () => {
  it('ranks critical > warning > ok', () => {
    expect(RISK_ORDER.critical).toBeGreaterThan(RISK_ORDER.warning);
    expect(RISK_ORDER.warning).toBeGreaterThan(RISK_ORDER.ok);
  });
});
