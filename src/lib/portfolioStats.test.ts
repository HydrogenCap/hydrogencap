import { describe, it, expect } from 'vitest';
import { calculatePortfolioStats } from './portfolioStats';
import type { PropertyMetrics } from './propertyMetrics';
import type { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';

// Minimal property factory — only the fields touched by calculatePortfolioStats.
function property(id: string, overrides: Partial<PropertyWithFinancials> = {}): PropertyWithFinancials {
  return {
    id,
    beds: 3,
    loans: [],
    income: [],
    costs: [],
    tenancies: [],
    ...overrides,
  } as unknown as PropertyWithFinancials;
}

function metrics(overrides: Partial<PropertyMetrics> = {}): PropertyMetrics {
  return {
    currentValue: 100_000,
    mortgageBalance: 50_000,
    mortgagePayment: 300,
    annualRent: 10_000,
    equity: 50_000,
    netRent: 9_000,
    monthlyCashflow: 500,
    yieldPercent: 10,
    ltv: 50,
    loan: null,
    ...overrides,
  } as PropertyMetrics;
}

describe('calculatePortfolioStats', () => {
  it('returns a zeroed result for an empty portfolio', () => {
    const stats = calculatePortfolioStats([], new Map());
    expect(stats).toEqual({
      count: 0,
      totalValue: 0,
      totalMortgageBalance: 0,
      totalMortgagePayment: 0,
      totalAnnualRent: 0,
      totalEquity: 0,
      totalBeds: 0,
      totalNetRent: 0,
      totalMonthlyCashflow: 0,
      avgBeds: 0,
      avgValue: 0,
      avgInterestRate: 0,
      avgYield: 0,
      avgLTV: 0,
      avgMonthlyCashflow: 0,
      portfolioLTV: 0,
      weightedAvgYield: 0,
    });
  });

  it('sums totals across properties', () => {
    const props = [property('p1'), property('p2'), property('p3')];
    const m = new Map<string, PropertyMetrics>([
      ['p1', metrics({ currentValue: 100_000, mortgageBalance: 60_000, annualRent: 10_000, monthlyCashflow: 500 })],
      ['p2', metrics({ currentValue: 200_000, mortgageBalance: 80_000, annualRent: 15_000, monthlyCashflow: 800 })],
      ['p3', metrics({ currentValue: 300_000, mortgageBalance: 100_000, annualRent: 20_000, monthlyCashflow: 1_200 })],
    ]);
    const stats = calculatePortfolioStats(props, m);
    expect(stats.count).toBe(3);
    expect(stats.totalValue).toBe(600_000);
    expect(stats.totalMortgageBalance).toBe(240_000);
    expect(stats.totalAnnualRent).toBe(45_000);
    expect(stats.totalMonthlyCashflow).toBe(2_500);
  });

  it('computes portfolio-level LTV as total debt / total value', () => {
    const props = [property('p1'), property('p2')];
    const m = new Map<string, PropertyMetrics>([
      ['p1', metrics({ currentValue: 100_000, mortgageBalance: 75_000 })],
      ['p2', metrics({ currentValue: 300_000, mortgageBalance: 75_000 })],
    ]);
    const stats = calculatePortfolioStats(props, m);
    // 150_000 / 400_000 = 37.5%
    expect(stats.portfolioLTV).toBeCloseTo(37.5, 5);
  });

  it('computes weighted average yield as total rent / total value', () => {
    const props = [property('p1'), property('p2')];
    const m = new Map<string, PropertyMetrics>([
      ['p1', metrics({ currentValue: 100_000, annualRent: 5_000 })], // 5%
      ['p2', metrics({ currentValue: 300_000, annualRent: 30_000 })], // 10%
    ]);
    const stats = calculatePortfolioStats(props, m);
    // 35_000 / 400_000 = 8.75% (weighted — higher-value property dominates)
    expect(stats.weightedAvgYield).toBeCloseTo(8.75, 5);
  });

  it('simple-averages the yield (NOT value-weighted)', () => {
    const props = [property('p1'), property('p2')];
    const m = new Map<string, PropertyMetrics>([
      ['p1', metrics({ yieldPercent: 5 })],
      ['p2', metrics({ yieldPercent: 15 })],
    ]);
    const stats = calculatePortfolioStats(props, m);
    expect(stats.avgYield).toBe(10);
  });

  it('guards LTV and yield calculations against totalValue = 0', () => {
    const props = [property('p1'), property('p2')];
    const m = new Map<string, PropertyMetrics>([
      ['p1', metrics({ currentValue: null, mortgageBalance: 50_000, annualRent: 5_000 })],
      ['p2', metrics({ currentValue: null, mortgageBalance: 50_000, annualRent: 5_000 })],
    ]);
    const stats = calculatePortfolioStats(props, m);
    expect(stats.portfolioLTV).toBe(0);
    expect(stats.weightedAvgYield).toBe(0);
  });

  it('excludes properties whose metric is null from averages but still counts others', () => {
    const props = [property('p1'), property('p2'), property('p3')];
    const m = new Map<string, PropertyMetrics>([
      ['p1', metrics({ currentValue: 100_000, ltv: 60 })],
      ['p2', metrics({ currentValue: 200_000, ltv: null })], // excluded from avgLTV
      ['p3', metrics({ currentValue: 300_000, ltv: 40 })],
    ]);
    const stats = calculatePortfolioStats(props, m);
    // avgLTV over p1 + p3 = (60 + 40) / 2 = 50
    expect(stats.avgLTV).toBe(50);
    // totalValue still includes all three
    expect(stats.totalValue).toBe(600_000);
  });

  it('excludes properties with null beds from avgBeds but still counts others', () => {
    const props = [
      property('p1', { beds: 2 }),
      property('p2', { beds: null }),
      property('p3', { beds: 4 }),
    ];
    const m = new Map<string, PropertyMetrics>([
      ['p1', metrics()],
      ['p2', metrics()],
      ['p3', metrics()],
    ]);
    const stats = calculatePortfolioStats(props, m);
    expect(stats.totalBeds).toBe(6); // 2 + 4
    expect(stats.avgBeds).toBe(3); // 6 / 2
  });

  it('computes avgInterestRate only over properties with a loan.interest_rate_percent', () => {
    const props = [property('p1'), property('p2'), property('p3')];
    const m = new Map<string, PropertyMetrics>([
      ['p1', metrics({ loan: { interest_rate_percent: 4 } as never })],
      ['p2', metrics({ loan: { interest_rate_percent: 6 } as never })],
      ['p3', metrics({ loan: null })], // excluded
    ]);
    const stats = calculatePortfolioStats(props, m);
    expect(stats.avgInterestRate).toBe(5); // (4 + 6) / 2
  });

  it('falls back to getPropertyMetrics when the metricsMap lacks a property', () => {
    // Omit p1 from the map entirely — the function should still compute something
    // by calling getPropertyMetrics(property). A minimal property with empty
    // financial arrays returns nulls, so stats stay at zero.
    const props = [property('p1')];
    const stats = calculatePortfolioStats(props, new Map());
    expect(stats.count).toBe(1);
    expect(stats.totalValue).toBe(0);
    expect(stats.portfolioLTV).toBe(0);
  });
});
