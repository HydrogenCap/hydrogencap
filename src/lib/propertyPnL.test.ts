import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildMonthGrid, calculatePropertyPnL } from './propertyPnL';

describe('buildMonthGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 12 months ending with the current month', () => {
    const grid = buildMonthGrid();
    expect(grid).toHaveLength(12);
    expect(grid[11]).toBe('2025-06'); // last entry = current month
    expect(grid[0]).toBe('2024-07'); // 11 months before
  });

  it('returns months in chronological order', () => {
    const grid = buildMonthGrid();
    const sorted = [...grid].sort();
    expect(grid).toEqual(sorted);
  });
});

describe('calculatePropertyPnL', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zeros for empty inputs', () => {
    const pnl = calculatePropertyPnL('p1', 0, 0, [], [], [], []);
    expect(pnl.annualGrossIncome).toBe(0);
    expect(pnl.annualCosts).toBe(0);
    expect(pnl.annualNOI).toBe(0);
    expect(pnl.annualCashflow).toBe(0);
    expect(pnl.grossYield).toBe(0);
    expect(pnl.netYield).toBe(0);
    expect(pnl.ltv).toBe(0);
    expect(pnl.months).toHaveLength(12);
  });

  it('uses 0 for valuation when null and guards yield/ltv divisions', () => {
    const pnl = calculatePropertyPnL('p1', null, 0, [], [{ current_balance: 100_000, interest_rate: 5, monthly_payment: 500 }], [], []);
    expect(pnl.currentValuation).toBe(0);
    expect(pnl.totalDebt).toBe(100_000);
    expect(pnl.equity).toBe(-100_000);
    expect(pnl.ltv).toBe(0); // guarded
    expect(pnl.grossYield).toBe(0);
    expect(pnl.netYield).toBe(0);
  });

  it('buckets rent payments into the correct month and computes annual gross', () => {
    const rent = [
      { amount: 1_000, payment_date: '2025-04-10' },
      { amount: 1_000, payment_date: '2025-04-28' }, // same month sums
      { amount: 1_200, payment_date: '2025-05-01' },
      { amount: 900, payment_date: '2025-06-03' },
    ];
    const pnl = calculatePropertyPnL('p1', 300_000, 1_000, rent, [], [], []);
    const apr = pnl.months.find((m) => m.month === '2025-04');
    const may = pnl.months.find((m) => m.month === '2025-05');
    const jun = pnl.months.find((m) => m.month === '2025-06');
    expect(apr?.grossIncome).toBe(2_000);
    expect(may?.grossIncome).toBe(1_200);
    expect(jun?.grossIncome).toBe(900);
    expect(pnl.annualGrossIncome).toBe(4_100);
  });

  it('computes void loss as max(0, expected - gross) per month', () => {
    const rent = [
      { amount: 1_200, payment_date: '2025-05-01' }, // over-collection: void=0
      { amount: 400, payment_date: '2025-06-03' }, // short: void=600
    ];
    const pnl = calculatePropertyPnL('p1', 300_000, 1_000, rent, [], [], []);
    expect(pnl.months.find((m) => m.month === '2025-05')?.voidLoss).toBe(0);
    expect(pnl.months.find((m) => m.month === '2025-06')?.voidLoss).toBe(600);
    // months with no rent at all also show a full void loss
    expect(pnl.months.find((m) => m.month === '2024-12')?.voidLoss).toBe(1_000);
  });

  it('prefers loan.monthly_payment when present', () => {
    const loans = [{ current_balance: 200_000, interest_rate: 6, monthly_payment: 900 }];
    const pnl = calculatePropertyPnL('p1', 300_000, 0, [], loans, [], []);
    expect(pnl.months[0].mortgagePayment).toBe(900);
  });

  it('falls back to interest-only math when monthly_payment is null', () => {
    // 200_000 * 5% / 12 = 833.333...
    const loans = [{ current_balance: 200_000, interest_rate: 5, monthly_payment: null }];
    const pnl = calculatePropertyPnL('p1', 300_000, 0, [], loans, [], []);
    expect(pnl.months[0].mortgagePayment).toBeCloseTo(833.33, 1);
  });

  it('falls back to interest-only math when monthly_payment is zero', () => {
    const loans = [{ current_balance: 100_000, interest_rate: 4, monthly_payment: 0 }];
    const pnl = calculatePropertyPnL('p1', 200_000, 0, [], loans, [], []);
    // 100_000 * 4% / 12 = 333.333...
    expect(pnl.months[0].mortgagePayment).toBeCloseTo(333.33, 1);
  });

  it('aggregates total debt across multiple loans', () => {
    const loans = [
      { current_balance: 150_000, interest_rate: 5, monthly_payment: 700 },
      { current_balance: 50_000, interest_rate: 6, monthly_payment: 250 },
    ];
    const pnl = calculatePropertyPnL('p1', 300_000, 0, [], loans, [], []);
    expect(pnl.totalDebt).toBe(200_000);
    expect(pnl.months[0].mortgagePayment).toBe(950);
  });

  it('computes equity, LTV, grossYield and netYield on valid valuation', () => {
    const rent = [{ amount: 1_200, payment_date: '2025-05-01' }];
    const loans = [{ current_balance: 150_000, interest_rate: 5, monthly_payment: 800 }];
    const pnl = calculatePropertyPnL('p1', 300_000, 1_200, rent, loans, [], []);
    expect(pnl.equity).toBe(150_000);
    expect(pnl.ltv).toBeCloseTo(50, 5); // 150k/300k
    expect(pnl.grossYield).toBeCloseTo(1_200 / 300_000 * 100, 5); // single month of income
    // netYield uses annualNOI / valuation
    expect(pnl.netYield).toBeCloseTo((pnl.annualNOI / 300_000) * 100, 5);
  });

  it('applies management fees as a % of grossIncome', () => {
    const rent = [{ amount: 1_000, payment_date: '2025-05-01' }];
    const pnl = calculatePropertyPnL('p1', 300_000, 1_000, rent, [], [], [], 10);
    const may = pnl.months.find((m) => m.month === '2025-05')!;
    expect(may.managementFees).toBe(100); // 10% of 1000
    expect(may.noi).toBe(900); // 1000 gross - 100 mgmt - 0 other
  });

  it('does not charge management fees on months with no income', () => {
    const pnl = calculatePropertyPnL('p1', 300_000, 1_000, [], [], [], [], 10);
    expect(pnl.months.every((m) => m.managementFees === 0)).toBe(true);
  });

  it('buckets maintenance costs by paid_date and ignores unpaid ones', () => {
    const maintenance = [
      { paid_amount: 150, paid_date: '2025-05-15' },
      { paid_amount: 75, paid_date: '2025-05-20' }, // same month sums
      { paid_amount: 200, paid_date: null }, // unpaid → ignored
      { paid_amount: null, paid_date: '2025-06-01' }, // null amount → ignored
      { paid_amount: 50, paid_date: '2025-06-03' },
    ];
    const pnl = calculatePropertyPnL('p1', 300_000, 0, [], [], maintenance, []);
    expect(pnl.months.find((m) => m.month === '2025-05')?.maintenance).toBe(225);
    expect(pnl.months.find((m) => m.month === '2025-06')?.maintenance).toBe(50);
  });

  it('buckets capex by paid_date, falling back to created_at, and skips zero amounts', () => {
    const capex = [
      { actual_gbp: 500, paid_date: '2025-05-10', created_at: '2025-01-01T00:00:00Z' },
      { actual_gbp: 300, paid_date: null, created_at: '2025-06-15T00:00:00Z' }, // falls back to created_at
      { actual_gbp: 0, paid_date: '2025-05-01', created_at: '2025-05-01T00:00:00Z' }, // skipped
    ];
    const pnl = calculatePropertyPnL('p1', 300_000, 0, [], [], [], capex);
    expect(pnl.months.find((m) => m.month === '2025-05')?.otherCosts).toBe(500);
    expect(pnl.months.find((m) => m.month === '2025-06')?.otherCosts).toBe(300);
  });

  it('computes monthly netCashflow = NOI - monthly mortgage', () => {
    const rent = [{ amount: 1_500, payment_date: '2025-05-01' }];
    const loans = [{ current_balance: 100_000, interest_rate: 5, monthly_payment: 500 }];
    const maintenance = [{ paid_amount: 200, paid_date: '2025-05-15' }];
    const pnl = calculatePropertyPnL('p1', 300_000, 1_500, rent, loans, maintenance, []);
    const may = pnl.months.find((m) => m.month === '2025-05')!;
    // NOI = 1500 - 200 = 1300; cashflow = 1300 - 500 = 800
    expect(may.noi).toBe(1_300);
    expect(may.netCashflow).toBe(800);
  });

  it('annualCashflow accounts for 12 months of mortgage', () => {
    const loans = [{ current_balance: 100_000, interest_rate: 5, monthly_payment: 500 }];
    const pnl = calculatePropertyPnL('p1', 300_000, 0, [], loans, [], []);
    // No income, no costs, 12 * 500 mortgage = -6000 cashflow
    expect(pnl.annualCashflow).toBe(-6_000);
  });
});
