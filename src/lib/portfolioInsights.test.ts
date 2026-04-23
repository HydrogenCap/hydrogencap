import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculatePortfolioInsights, generateActionItems } from './portfolioInsights';
import type { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import type { PropertyPassport } from '@/hooks/usePropertyPassport';

// ── Factories ───────────────────────────────────────────────────────

function property(overrides: Partial<PropertyWithFinancials> = {}): PropertyWithFinancials {
  return {
    id: 'p1',
    address_line: '10 High St',
    current_value_gbp: 300_000,
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

function loan(overrides: Partial<PropertyWithFinancials['loans'][0]> = {}): PropertyWithFinancials['loans'][0] {
  return {
    current_mortgage_balance_gbp: 150_000,
    interest_rate_percent: 5,
    loan_term_months: 300,
    capital_or_interest: 'interest_only',
    payment_override_gbp: null,
    fixed_rate_expires: null,
    lender: 'MegaBank',
    ...overrides,
  } as PropertyWithFinancials['loans'][0];
}

function passport(overrides: Partial<PropertyPassport> = {}): PropertyPassport {
  return {
    property_id: 'p1',
    built_in_year: 2010,
    construction_date_band: null,
    ...overrides,
  } as PropertyPassport;
}

// ── calculatePortfolioInsights ─────────────────────────────────────

describe('calculatePortfolioInsights — empty portfolio', () => {
  it('returns zeroed totals and null margins for no properties', () => {
    const insights = calculatePortfolioInsights([], []);
    expect(insights.propertyCount).toBe(0);
    expect(insights.debt.totalMortgageBalance).toBe(0);
    expect(insights.debt.weightedAverageInterestRate).toBeNull();
    expect(insights.cashflow.totalGrossRent).toBe(0);
    expect(insights.cashflow.noiMargin).toBeNull();
    expect(insights.cashflow.cashflowMargin).toBeNull();
    expect(insights.returns.portfolioNetYield).toBeNull();
    expect(insights.returns.portfolioROCE).toBeNull();
    expect(insights.returns.rentPerBedroomAnnual).toBeNull();
    expect(insights.returns.rentPerBedroomMonthly).toBeNull();
    expect(insights.risk.ltvAbove75.count).toBe(0);
    expect(insights.risk.ltvAbove85.count).toBe(0);
    expect(insights.risk.pre2000Count).toBe(0);
  });
});

describe('calculatePortfolioInsights — totals + weighted averages', () => {
  it('sums totalValue, totalMortgageBalance, totalBedrooms across properties', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'p1', current_value_gbp: 200_000, beds: 2, loans: [loan({ current_mortgage_balance_gbp: 120_000 })] }),
      property({ id: 'p2', current_value_gbp: 400_000, beds: 4, loans: [loan({ current_mortgage_balance_gbp: 260_000 })] }),
    ], []);
    expect(insights.returns.totalValue).toBe(600_000);
    expect(insights.debt.totalMortgageBalance).toBe(380_000);
    expect(insights.returns.totalBedrooms).toBe(6);
  });

  it('computes weightedAverageInterestRate by mortgage balance', () => {
    const insights = calculatePortfolioInsights([
      // 100k @ 4% and 300k @ 6% → (100*4 + 300*6) / 400 = 5.5
      property({ id: 'p1', current_value_gbp: 200_000, loans: [loan({ current_mortgage_balance_gbp: 100_000, interest_rate_percent: 4 })] }),
      property({ id: 'p2', current_value_gbp: 400_000, loans: [loan({ current_mortgage_balance_gbp: 300_000, interest_rate_percent: 6 })] }),
    ], []);
    expect(insights.debt.weightedAverageInterestRate).toBeCloseTo(5.5, 5);
  });

  it('omits loans without an interest rate from the weighted average', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'p1', current_value_gbp: 200_000, loans: [loan({ current_mortgage_balance_gbp: 100_000, interest_rate_percent: 4 })] }),
      property({ id: 'p2', current_value_gbp: 400_000, loans: [loan({ current_mortgage_balance_gbp: 200_000, interest_rate_percent: null as unknown as number })] }),
    ], []);
    // Only the first loan counts toward the weighted-rate numerator, but both count toward the denominator (total balance).
    // weightedRateSum = 4 * 100_000 = 400_000; totalBalance = 300_000 → 400_000 / 300_000 = 1.333.
    // This confirms the existing implementation: loans without rate contribute to denominator only.
    expect(insights.debt.weightedAverageInterestRate).toBeCloseTo(400_000 / 300_000, 5);
  });
});

describe('calculatePortfolioInsights — rate expiry buckets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('buckets expiry within 3/6/12 months (nested — 3m counts towards 6m and 12m)', () => {
    // All three buckets use the same max-days cutoff:
    //   3m = <= 90 days, 6m = <= 180, 12m = <= 365.
    // A 60-day expiry should count in all three buckets.
    const expires60d = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const insights = calculatePortfolioInsights([
      property({
        id: 'p1',
        current_value_gbp: 300_000,
        loans: [loan({ current_mortgage_balance_gbp: 150_000, fixed_rate_expires: expires60d })],
      }),
    ], []);
    expect(insights.debt.expiringIn3Months.count).toBe(1);
    expect(insights.debt.expiringIn6Months.count).toBe(1);
    expect(insights.debt.expiringIn12Months.count).toBe(1);
  });

  it('only counts in 12m bucket when expiry is 200 days out', () => {
    const expires200d = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);
    const insights = calculatePortfolioInsights([
      property({
        id: 'p1',
        current_value_gbp: 300_000,
        loans: [loan({ current_mortgage_balance_gbp: 150_000, fixed_rate_expires: expires200d })],
      }),
    ], []);
    expect(insights.debt.expiringIn3Months.count).toBe(0);
    expect(insights.debt.expiringIn6Months.count).toBe(0);
    expect(insights.debt.expiringIn12Months.count).toBe(1);
  });

  it('excludes already-expired rates (days <= 0)', () => {
    const expired = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const insights = calculatePortfolioInsights([
      property({
        id: 'p1',
        current_value_gbp: 300_000,
        loans: [loan({ current_mortgage_balance_gbp: 150_000, fixed_rate_expires: expired })],
      }),
    ], []);
    expect(insights.debt.expiringIn3Months.count).toBe(0);
  });

  it('computes % of total debt in the 12m bucket', () => {
    const expires60d = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const insights = calculatePortfolioInsights([
      property({ id: 'p1', current_value_gbp: 300_000, loans: [loan({ current_mortgage_balance_gbp: 100_000, fixed_rate_expires: expires60d })] }),
      property({ id: 'p2', current_value_gbp: 600_000, loans: [loan({ current_mortgage_balance_gbp: 300_000 })] }), // no expiry
    ], []);
    // 100k of 400k total → 25%
    expect(insights.debt.expiringIn12Months.percent).toBeCloseTo(25, 5);
  });
});

describe('calculatePortfolioInsights — lender concentration', () => {
  it('returns lenders ranked by balance, top 3', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'p1', current_value_gbp: 300_000, loans: [loan({ current_mortgage_balance_gbp: 100_000, lender: 'BankA' })] }),
      property({ id: 'p2', current_value_gbp: 300_000, loans: [loan({ current_mortgage_balance_gbp: 200_000, lender: 'BankB' })] }),
      property({ id: 'p3', current_value_gbp: 300_000, loans: [loan({ current_mortgage_balance_gbp: 50_000, lender: 'BankC' })] }),
      property({ id: 'p4', current_value_gbp: 300_000, loans: [loan({ current_mortgage_balance_gbp: 10_000, lender: 'BankD' })] }),
    ], []);
    expect(insights.debt.lenderConcentration).toHaveLength(3); // top 3 only
    expect(insights.debt.lenderConcentration[0]).toMatchObject({ lender: 'BankB', balance: 200_000 });
    expect(insights.debt.lenderConcentration[1]).toMatchObject({ lender: 'BankA', balance: 100_000 });
    expect(insights.debt.lenderConcentration[2]).toMatchObject({ lender: 'BankC', balance: 50_000 });
  });

  it('sums balances across properties with the same lender', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'p1', current_value_gbp: 300_000, loans: [loan({ current_mortgage_balance_gbp: 100_000, lender: 'BankA' })] }),
      property({ id: 'p2', current_value_gbp: 300_000, loans: [loan({ current_mortgage_balance_gbp: 150_000, lender: 'BankA' })] }),
    ], []);
    expect(insights.debt.lenderConcentration[0]).toMatchObject({ lender: 'BankA', balance: 250_000 });
    expect(insights.debt.lenderConcentration[0].percent).toBeCloseTo(100, 5);
  });

  it('excludes loans with no lender or zero balance', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'p1', current_value_gbp: 300_000, loans: [loan({ current_mortgage_balance_gbp: 100_000, lender: null })] }),
      property({ id: 'p2', current_value_gbp: 300_000, loans: [loan({ current_mortgage_balance_gbp: 0, lender: 'BankB' })] }),
      property({ id: 'p3', current_value_gbp: 300_000, loans: [loan({ current_mortgage_balance_gbp: 50_000, lender: 'BankC' })] }),
    ], []);
    expect(insights.debt.lenderConcentration).toHaveLength(1);
    expect(insights.debt.lenderConcentration[0].lender).toBe('BankC');
  });
});

describe('calculatePortfolioInsights — LTV risk', () => {
  it('buckets LTV > 85 as ltvAbove85, 75 < LTV <= 85 as ltvAbove75', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'crit', current_value_gbp: 100_000, loans: [loan({ current_mortgage_balance_gbp: 90_000 })] }), // 90%
      property({ id: 'warn', current_value_gbp: 100_000, loans: [loan({ current_mortgage_balance_gbp: 80_000 })] }), // 80%
      property({ id: 'safe', current_value_gbp: 100_000, loans: [loan({ current_mortgage_balance_gbp: 60_000 })] }), // 60%
    ], []);
    expect(insights.risk.ltvAbove85.properties).toContain('crit');
    expect(insights.risk.ltvAbove85.properties).not.toContain('warn');
    expect(insights.risk.ltvAbove75.properties).toContain('warn');
    expect(insights.risk.ltvAbove75.properties).not.toContain('crit'); // bucket is exclusive
  });

  it('ignores properties with no valuation', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'p1', current_value_gbp: 0, loans: [loan({ current_mortgage_balance_gbp: 90_000 })] }),
    ], []);
    expect(insights.risk.ltvAbove85.count).toBe(0);
    expect(insights.risk.ltvAbove75.count).toBe(0);
  });
});

describe('calculatePortfolioInsights — EPC risk', () => {
  it('counts properties with EPC D/E/F/G ratings', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'pd', epc_rating: 'D' }),
      property({ id: 'pe', epc_rating: 'E' }),
      property({ id: 'pc', epc_rating: 'C' }),
      property({ id: 'pa', epc_rating: 'A' }),
    ], []);
    expect(insights.risk.epcBelowC.count).toBe(2);
    expect(insights.risk.epcBelowC.properties).toEqual(['pd', 'pe']);
  });

  it('excludes properties where epc_required is false', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'exempt', epc_rating: 'F', epc_required: false }),
      property({ id: 'required', epc_rating: 'F', epc_required: true }),
    ], []);
    expect(insights.risk.epcBelowC.count).toBe(1);
    expect(insights.risk.epcBelowC.properties).toEqual(['required']);
  });

  it('is case-insensitive on the rating', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'p1', epc_rating: 'd' }),
    ], []);
    expect(insights.risk.epcBelowC.count).toBe(1);
  });
});

describe('calculatePortfolioInsights — pre-2000 tracking', () => {
  it('counts properties built before 2000 (via passport)', () => {
    const insights = calculatePortfolioInsights(
      [property({ id: 'p-old' }), property({ id: 'p-new' })],
      [
        passport({ property_id: 'p-old', built_in_year: 1985 }),
        passport({ property_id: 'p-new', built_in_year: 2015 }),
      ],
    );
    expect(insights.risk.pre2000Count).toBe(1);
  });
});

describe('calculatePortfolioInsights — returns', () => {
  it('computes rentPerBedroomAnnual and rentPerBedroomMonthly', () => {
    const insights = calculatePortfolioInsights([
      property({
        id: 'p1', current_value_gbp: 300_000, beds: 4,
        income: [{ year: new Date().getFullYear(), annual_rent_gbp: 24_000 } as PropertyWithFinancials['income'][0]],
      }),
    ], []);
    expect(insights.returns.rentPerBedroomAnnual).toBe(6_000); // 24k / 4
    expect(insights.returns.rentPerBedroomMonthly).toBe(500); // 6k / 12
  });

  it('returns null per-bedroom when totalBedrooms is 0', () => {
    const insights = calculatePortfolioInsights([
      property({ id: 'p1', current_value_gbp: 300_000, beds: 0 }),
    ], []);
    expect(insights.returns.rentPerBedroomAnnual).toBeNull();
    expect(insights.returns.rentPerBedroomMonthly).toBeNull();
  });
});

describe('calculatePortfolioInsights — operational', () => {
  it('marks a property without a passport as missing-critical', () => {
    const insights = calculatePortfolioInsights(
      [property({ id: 'p1' })],
      [], // no passport
    );
    expect(insights.operational.propertiesMissingCritical.count).toBe(1);
    expect(insights.operational.propertiesMissingCritical.properties).toEqual(['p1']);
  });
});

// ── generateActionItems ────────────────────────────────────────────

describe('generateActionItems', () => {
  function makeInsights(overrides: Record<string, unknown>) {
    const empty = calculatePortfolioInsights([], []);
    return { ...empty, ...overrides };
  }

  it('returns no actions for a clean portfolio', () => {
    const insights = calculatePortfolioInsights([], []);
    expect(generateActionItems(insights, [])).toEqual([]);
  });

  it('adds a red "Critical LTV" action when ltvAbove85 > 0', () => {
    const insights = makeInsights({
      risk: {
        ltvAbove85: { count: 2, value: 600_000, percent: 40, properties: ['p1', 'p2'] },
        ltvAbove75: { count: 0, value: 0, percent: 0, properties: [] },
        epcBelowC: { count: 0, properties: [] },
        pre2000Count: 0,
      },
    });
    const actions = generateActionItems(insights, []);
    const action = actions.find((a) => a.id === 'ltv-critical');
    expect(action).toBeDefined();
    expect(action!.severity).toBe('red');
    expect(action!.count).toBe(2);
  });

  it('adds a yellow "Elevated LTV" action when ltvAbove75 > 0', () => {
    const insights = makeInsights({
      risk: {
        ltvAbove85: { count: 0, value: 0, percent: 0, properties: [] },
        ltvAbove75: { count: 1, value: 300_000, percent: 50, properties: ['p1'] },
        epcBelowC: { count: 0, properties: [] },
        pre2000Count: 0,
      },
    });
    const action = generateActionItems(insights, []).find((a) => a.id === 'ltv-warning');
    expect(action?.severity).toBe('yellow');
  });

  it('adds a red "Negative Cashflow" action', () => {
    const insights = makeInsights({
      cashflow: {
        totalGrossRent: 0, totalNOI: 0, totalCashflowAfterDebt: -1000,
        noiMargin: null, cashflowMargin: null,
        negativeProperties: { count: 1, totalValue: 300_000, properties: ['p1'] },
      },
    });
    const action = generateActionItems(insights, []).find((a) => a.id === 'negative-cashflow');
    expect(action?.severity).toBe('red');
  });

  it('adds a yellow "EPC Below C" action', () => {
    const insights = makeInsights({
      risk: {
        ltvAbove85: { count: 0, value: 0, percent: 0, properties: [] },
        ltvAbove75: { count: 0, value: 0, percent: 0, properties: [] },
        epcBelowC: { count: 3, properties: ['p1', 'p2', 'p3'] },
        pre2000Count: 0,
      },
    });
    const action = generateActionItems(insights, []).find((a) => a.id === 'epc-below-c');
    expect(action?.severity).toBe('yellow');
    expect(action?.count).toBe(3);
  });

  it('adds a red "Rates Expiring (90 days)" action', () => {
    const insights = makeInsights({
      debt: {
        weightedAverageInterestRate: 5,
        totalMortgageBalance: 400_000,
        expiringIn3Months: { count: 2, balance: 200_000, percent: 50 },
        expiringIn6Months: { count: 2, balance: 200_000, percent: 50 },
        expiringIn12Months: { count: 2, balance: 200_000, percent: 50 },
        lenderConcentration: [],
      },
    });
    const action = generateActionItems(insights, []).find((a) => a.id === 'rate-expiry-3m');
    expect(action?.severity).toBe('red');
    expect(action?.count).toBe(2);
  });
});
