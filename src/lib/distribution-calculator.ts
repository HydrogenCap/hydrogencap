/**
 * Distribution Calculator
 *
 * Computes distributable income per period and allocates to investors
 * based on ownership percentages through entities.
 */

export interface PeriodFinancials {
  grossRent: number;
  expenses: number;
  mortgagePayments: number;
  managementFees: number;
  otherDeductions: number;
}

export interface EntityOwnership {
  investorId: string;
  investorName: string;
  entityId: string | null;
  entityName: string | null;
  ownershipPct: number; // 0-100
  entityType: 'direct' | 'spv' | 'partnership' | 'other';
  propertyIds: string[];
}

export interface AllocationResult {
  investorId: string;
  investorName: string;
  entityId: string | null;
  propertyIds: string[];
  ownershipPct: number;
  grossAmount: number;
  withholdingTax: number;
  netAmount: number;
}

export interface DistributionSummary {
  grossIncome: number;
  totalExpenses: number;
  netOperatingIncome: number;
  retainedAmount: number;
  totalDistributable: number;
  allocations: AllocationResult[];
  totalAllocated: number;
}

/**
 * Calculate distributable income for a period.
 * Net Operating Income = Gross Rent - Expenses - Mortgage - Management Fees - Other
 */
export function calculateDistributableIncome(financials: PeriodFinancials): number {
  const { grossRent, expenses, mortgagePayments, managementFees, otherDeductions } = financials;
  return grossRent - expenses - mortgagePayments - managementFees - otherDeductions;
}

/**
 * Calculate retained earnings based on a retention percentage.
 * @param distributableIncome - The net income available
 * @param retentionPct - Percentage to hold back (0-100), default 10%
 */
export function calculateRetainedEarnings(
  distributableIncome: number,
  retentionPct: number = 10,
): { retained: number; distributable: number } {
  if (distributableIncome <= 0) {
    return { retained: 0, distributable: 0 };
  }
  const retained = Math.round(distributableIncome * (retentionPct / 100) * 100) / 100;
  const distributable = Math.round((distributableIncome - retained) * 100) / 100;
  return { retained, distributable };
}

/**
 * Allocate distributable amount to investors based on ownership percentages.
 * Uses a waterfall approach: allocates proportionally, rounds to 2 decimal places,
 * and adjusts the largest allocation to absorb rounding differences.
 */
export function allocateToInvestors(
  distributableAmount: number,
  ownerships: EntityOwnership[],
  withholdingTaxPct: number = 0,
): AllocationResult[] {
  if (ownerships.length === 0 || distributableAmount <= 0) return [];

  const totalPct = ownerships.reduce((sum, o) => sum + o.ownershipPct, 0);

  const allocations: AllocationResult[] = ownerships.map((o) => {
    const normalisedPct = totalPct > 0 ? o.ownershipPct / totalPct : 0;
    const grossAmount = Math.round(distributableAmount * normalisedPct * 100) / 100;
    const withholdingTax = Math.round(grossAmount * (withholdingTaxPct / 100) * 100) / 100;
    const netAmount = Math.round((grossAmount - withholdingTax) * 100) / 100;

    return {
      investorId: o.investorId,
      investorName: o.investorName,
      entityId: o.entityId,
      propertyIds: o.propertyIds,
      ownershipPct: o.ownershipPct,
      grossAmount,
      withholdingTax,
      netAmount,
    };
  });

  // Adjust rounding: ensure gross amounts sum to distributableAmount
  const grossSum = allocations.reduce((s, a) => s + a.grossAmount, 0);
  const diff = Math.round((distributableAmount - grossSum) * 100) / 100;
  if (diff !== 0 && allocations.length > 0) {
    // Find the largest allocation to absorb the rounding difference
    const largest = allocations.reduce((max, a, i) =>
      a.grossAmount > allocations[max].grossAmount ? i : max, 0);
    allocations[largest].grossAmount = Math.round((allocations[largest].grossAmount + diff) * 100) / 100;
    const wht = Math.round(allocations[largest].grossAmount * (withholdingTaxPct / 100) * 100) / 100;
    allocations[largest].withholdingTax = wht;
    allocations[largest].netAmount = Math.round((allocations[largest].grossAmount - wht) * 100) / 100;
  }

  return allocations;
}

/**
 * Full distribution calculation: income -> retention -> allocation.
 */
export function calculateDistribution(
  financials: PeriodFinancials,
  ownerships: EntityOwnership[],
  retentionPct: number = 10,
  withholdingTaxPct: number = 0,
): DistributionSummary {
  const noi = calculateDistributableIncome(financials);
  const grossIncome = financials.grossRent;
  const totalExpenses = financials.expenses + financials.mortgagePayments +
    financials.managementFees + financials.otherDeductions;

  const { retained, distributable } = calculateRetainedEarnings(noi, retentionPct);
  const allocations = allocateToInvestors(distributable, ownerships, withholdingTaxPct);
  const totalAllocated = allocations.reduce((s, a) => s + a.grossAmount, 0);

  return {
    grossIncome,
    totalExpenses,
    netOperatingIncome: noi,
    retainedAmount: retained,
    totalDistributable: distributable,
    allocations,
    totalAllocated,
  };
}

/**
 * Get quarter info from a date.
 */
export function getQuarterFromDate(date: Date = new Date()): {
  label: string;
  period: string;
  start: string;
  end: string;
  quarter: number;
  year: number;
} {
  const q = Math.floor(date.getMonth() / 3) + 1;
  const year = date.getFullYear();
  const quarters: Record<number, { start: string; end: string }> = {
    1: { start: `${year}-01-01`, end: `${year}-03-31` },
    2: { start: `${year}-04-01`, end: `${year}-06-30` },
    3: { start: `${year}-07-01`, end: `${year}-09-30` },
    4: { start: `${year}-10-01`, end: `${year}-12-31` },
  };

  return {
    label: `Q${q} ${year}`,
    period: `Q${q}-${year}`,
    start: quarters[q].start,
    end: quarters[q].end,
    quarter: q,
    year,
  };
}

/**
 * Normalize ownership percentages so they sum to 100.
 */
export function normalizeOwnerships(ownerships: EntityOwnership[]): EntityOwnership[] {
  const total = ownerships.reduce((sum, o) => sum + o.ownershipPct, 0);
  if (total === 0 || total === 100) return ownerships;

  return ownerships.map(o => ({
    ...o,
    ownershipPct: Math.round((o.ownershipPct / total) * 10000) / 100,
  }));
}
