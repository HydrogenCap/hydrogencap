import { describe, it, expect } from 'vitest';
import {
  calculateDistributableIncome,
  calculateRetainedEarnings,
  allocateToInvestors,
  calculateDistribution,
  getQuarterFromDate,
  normalizeOwnerships,
  type PeriodFinancials,
  type EntityOwnership,
} from '../distribution-calculator';

const baseFinancials: PeriodFinancials = {
  grossRent: 10_000,
  expenses: 2_000,
  mortgagePayments: 3_000,
  managementFees: 500,
  otherDeductions: 500,
};

function makeOwnership(overrides: Partial<EntityOwnership> = {}): EntityOwnership {
  return {
    investorId: 'inv-1',
    investorName: 'Alice',
    entityId: null,
    entityName: null,
    ownershipPct: 50,
    entityType: 'direct',
    propertyIds: ['prop-1'],
    ...overrides,
  };
}

describe('calculateDistributableIncome', () => {
  it('calculates NOI correctly', () => {
    // 10000 - 2000 - 3000 - 500 - 500 = 4000
    expect(calculateDistributableIncome(baseFinancials)).toBe(4_000);
  });

  it('returns negative when expenses exceed income', () => {
    expect(calculateDistributableIncome({ ...baseFinancials, grossRent: 1_000 })).toBe(-5_000);
  });

  it('returns zero when income equals expenses', () => {
    expect(calculateDistributableIncome({ ...baseFinancials, grossRent: 6_000 })).toBe(0);
  });
});

describe('calculateRetainedEarnings', () => {
  it('retains 10% by default', () => {
    const { retained, distributable } = calculateRetainedEarnings(4_000);
    expect(retained).toBe(400);
    expect(distributable).toBe(3_600);
  });

  it('retains custom percentage', () => {
    const { retained, distributable } = calculateRetainedEarnings(4_000, 25);
    expect(retained).toBe(1_000);
    expect(distributable).toBe(3_000);
  });

  it('returns 0 retained with 0% retention', () => {
    const { retained, distributable } = calculateRetainedEarnings(4_000, 0);
    expect(retained).toBe(0);
    expect(distributable).toBe(4_000);
  });

  it('returns 0 for both when distributable income is zero', () => {
    const { retained, distributable } = calculateRetainedEarnings(0);
    expect(retained).toBe(0);
    expect(distributable).toBe(0);
  });

  it('returns 0 for both when distributable income is negative', () => {
    const { retained, distributable } = calculateRetainedEarnings(-5_000);
    expect(retained).toBe(0);
    expect(distributable).toBe(0);
  });
});

describe('allocateToInvestors', () => {
  it('allocates 50/50 to two investors', () => {
    const ownerships = [
      makeOwnership({ investorId: 'inv-1', investorName: 'Alice', ownershipPct: 50 }),
      makeOwnership({ investorId: 'inv-2', investorName: 'Bob', ownershipPct: 50 }),
    ];
    const allocations = allocateToInvestors(4_000, ownerships);
    expect(allocations).toHaveLength(2);
    expect(allocations[0].grossAmount).toBe(2_000);
    expect(allocations[1].grossAmount).toBe(2_000);
  });

  it('allocates uneven splits correctly', () => {
    const ownerships = [
      makeOwnership({ investorId: 'inv-1', ownershipPct: 70 }),
      makeOwnership({ investorId: 'inv-2', investorName: 'Bob', ownershipPct: 30 }),
    ];
    const allocations = allocateToInvestors(10_000, ownerships);
    expect(allocations[0].grossAmount).toBe(7_000);
    expect(allocations[1].grossAmount).toBe(3_000);
  });

  it('allocates to a single investor', () => {
    const ownerships = [makeOwnership({ ownershipPct: 100 })];
    const allocations = allocateToInvestors(5_000, ownerships);
    expect(allocations).toHaveLength(1);
    expect(allocations[0].grossAmount).toBe(5_000);
  });

  it('returns empty array for zero distributable amount', () => {
    const ownerships = [makeOwnership()];
    expect(allocateToInvestors(0, ownerships)).toEqual([]);
  });

  it('returns empty array for negative distributable amount', () => {
    const ownerships = [makeOwnership()];
    expect(allocateToInvestors(-1_000, ownerships)).toEqual([]);
  });

  it('returns empty array with no ownerships', () => {
    expect(allocateToInvestors(5_000, [])).toEqual([]);
  });

  it('normalises percentages that do not sum to 100', () => {
    const ownerships = [
      makeOwnership({ investorId: 'inv-1', ownershipPct: 30 }),
      makeOwnership({ investorId: 'inv-2', investorName: 'Bob', ownershipPct: 20 }),
    ];
    // Total pct = 50, so each gets normalised: 30/50 = 60%, 20/50 = 40%
    const allocations = allocateToInvestors(1_000, ownerships);
    expect(allocations[0].grossAmount).toBe(600);
    expect(allocations[1].grossAmount).toBe(400);
  });

  it('ensures gross amounts sum to distributable after rounding adjustment', () => {
    const ownerships = [
      makeOwnership({ investorId: 'inv-1', ownershipPct: 33.33 }),
      makeOwnership({ investorId: 'inv-2', investorName: 'Bob', ownershipPct: 33.33 }),
      makeOwnership({ investorId: 'inv-3', investorName: 'Charlie', ownershipPct: 33.34 }),
    ];
    const allocations = allocateToInvestors(1_000, ownerships);
    const totalAllocated = allocations.reduce((s, a) => s + a.grossAmount, 0);
    expect(totalAllocated).toBeCloseTo(1_000, 2);
  });

  it('applies withholding tax', () => {
    const ownerships = [makeOwnership({ ownershipPct: 100 })];
    const allocations = allocateToInvestors(10_000, ownerships, 20);
    expect(allocations[0].grossAmount).toBe(10_000);
    expect(allocations[0].withholdingTax).toBe(2_000);
    expect(allocations[0].netAmount).toBe(8_000);
  });
});

describe('calculateDistribution (full pipeline)', () => {
  it('runs full distribution pipeline', () => {
    const ownerships = [
      makeOwnership({ investorId: 'inv-1', ownershipPct: 60 }),
      makeOwnership({ investorId: 'inv-2', investorName: 'Bob', ownershipPct: 40 }),
    ];
    const result = calculateDistribution(baseFinancials, ownerships, 10, 0);
    expect(result.grossIncome).toBe(10_000);
    expect(result.netOperatingIncome).toBe(4_000);
    expect(result.retainedAmount).toBe(400);
    expect(result.totalDistributable).toBe(3_600);
    expect(result.allocations).toHaveLength(2);
    expect(result.totalAllocated).toBeCloseTo(3_600, 2);
  });
});

describe('getQuarterFromDate', () => {
  it('returns Q1 for January', () => {
    const result = getQuarterFromDate(new Date('2025-01-15'));
    expect(result.quarter).toBe(1);
    expect(result.label).toBe('Q1 2025');
  });

  it('returns Q2 for April', () => {
    const result = getQuarterFromDate(new Date('2025-04-01'));
    expect(result.quarter).toBe(2);
  });

  it('returns Q3 for July', () => {
    const result = getQuarterFromDate(new Date('2025-07-20'));
    expect(result.quarter).toBe(3);
  });

  it('returns Q4 for December', () => {
    const result = getQuarterFromDate(new Date('2025-12-31'));
    expect(result.quarter).toBe(4);
    expect(result.end).toBe('2025-12-31');
  });
});

describe('normalizeOwnerships', () => {
  it('returns unchanged if percentages already sum to 100', () => {
    const ownerships = [
      makeOwnership({ ownershipPct: 60 }),
      makeOwnership({ ownershipPct: 40 }),
    ];
    const normalised = normalizeOwnerships(ownerships);
    expect(normalised[0].ownershipPct).toBe(60);
    expect(normalised[1].ownershipPct).toBe(40);
  });

  it('normalises percentages that sum to less than 100', () => {
    const ownerships = [
      makeOwnership({ ownershipPct: 30 }),
      makeOwnership({ ownershipPct: 20 }),
    ];
    const normalised = normalizeOwnerships(ownerships);
    expect(normalised[0].ownershipPct).toBe(60);
    expect(normalised[1].ownershipPct).toBe(40);
  });

  it('returns unchanged when total is 0', () => {
    const ownerships = [makeOwnership({ ownershipPct: 0 })];
    const normalised = normalizeOwnerships(ownerships);
    expect(normalised[0].ownershipPct).toBe(0);
  });
});
