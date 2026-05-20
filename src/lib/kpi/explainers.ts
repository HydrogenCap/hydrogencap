/**
 * Centralized KPI definitions used by KpiBreakdownPopover.
 * Keep formulas plain-English so non-finance users understand them.
 */
export interface KpiExplainer {
  id: string;
  label: string;
  formula: string;
  what: string;
  inputs: { label: string; description: string }[];
  benchmarks?: { label: string; range: string; tone: 'good' | 'warn' | 'bad' }[];
  notes?: string;
}

export const KPI_EXPLAINERS: Record<string, KpiExplainer> = {
  portfolio_value: {
    id: 'portfolio_value',
    label: 'Portfolio Value',
    formula: 'Σ (latest valuation of each property)',
    what: 'Sum of the most recent valuation across every active property in the portfolio.',
    inputs: [
      { label: 'Property valuations', description: 'Uses the latest valuation entry per property; falls back to purchase price if no valuation exists.' },
      { label: 'Lifecycle filter', description: 'Excludes archived/disposed properties.' },
    ],
    notes: 'The attributed value applies your group ownership percentages.',
  },
  equity: {
    id: 'equity',
    label: 'Equity',
    formula: 'Portfolio Value − Outstanding Debt',
    what: 'Net equity position across the portfolio after subtracting outstanding loan balances.',
    inputs: [
      { label: 'Portfolio Value', description: 'Sum of latest property valuations.' },
      { label: 'Outstanding Debt', description: 'Sum of current balances on active loan facilities.' },
    ],
  },
  ltv: {
    id: 'ltv',
    label: 'Weighted LTV',
    formula: 'Σ (loan balance) ÷ Σ (property value)',
    what: 'Loan-to-Value across the portfolio, weighted by property value.',
    inputs: [
      { label: 'Loan balances', description: 'Outstanding principal on active loan facilities.' },
      { label: 'Property values', description: 'Latest valuation per property.' },
    ],
    benchmarks: [
      { label: 'Healthy', range: '≤ 75%', tone: 'good' },
      { label: 'Stretched', range: '75–85%', tone: 'warn' },
      { label: 'High risk', range: '> 85%', tone: 'bad' },
    ],
  },
  dscr: {
    id: 'dscr',
    label: 'DSCR',
    formula: 'Net Operating Income ÷ Annual Debt Service',
    what: 'Debt Service Coverage Ratio — how comfortably rental NOI covers loan repayments.',
    inputs: [
      { label: 'NOI', description: 'Annual rent minus operating costs (management, insurance, maintenance, voids).' },
      { label: 'Debt service', description: 'Annual interest + capital repayments on active loans.' },
    ],
    benchmarks: [
      { label: 'Strong', range: '≥ 1.25x', tone: 'good' },
      { label: 'Tight', range: '1.00–1.25x', tone: 'warn' },
      { label: 'Underwater', range: '< 1.00x', tone: 'bad' },
    ],
    notes: 'Most UK BTL lenders require ≥ 1.25x at stress rates.',
  },
  net_yield: {
    id: 'net_yield',
    label: 'Net Yield',
    formula: 'Annual NOI ÷ Portfolio Value',
    what: 'After-cost rental return as a percentage of asset value.',
    inputs: [
      { label: 'NOI', description: 'Annual rent minus operating costs.' },
      { label: 'Portfolio value', description: 'Sum of latest property valuations.' },
    ],
    benchmarks: [
      { label: 'Strong', range: '≥ 6%', tone: 'good' },
      { label: 'Average', range: '4–6%', tone: 'warn' },
      { label: 'Weak', range: '< 4%', tone: 'bad' },
    ],
  },
  cashflow: {
    id: 'cashflow',
    label: 'Cashflow',
    formula: 'Rental income − Operating costs − Debt service',
    what: 'Cash retained after every recurring portfolio outflow.',
    inputs: [
      { label: 'Rental income', description: 'Annualised active tenancy rent.' },
      { label: 'Operating costs', description: 'Management, insurance, maintenance and void allowance.' },
      { label: 'Debt service', description: 'Annual interest + capital repayments.' },
    ],
  },
  annual_rent: {
    id: 'annual_rent',
    label: 'Annual Rent',
    formula: 'Σ (monthly rent of active tenancies) × 12',
    what: 'Contracted annual rent from currently active tenancies.',
    inputs: [
      { label: 'Active tenancies', description: 'Tenancies whose start date is in the past and end date is in the future (or open-ended).' },
      { label: 'Manual override', description: 'If a property has an explicit annual_rent_gbp value, it takes precedence.' },
    ],
  },
  occupancy: {
    id: 'occupancy',
    label: 'Occupancy Rate',
    formula: 'Occupied rooms ÷ Total rooms',
    what: 'Share of bedrooms across the portfolio that are currently let.',
    inputs: [
      { label: 'Occupied rooms', description: 'Rooms tied to an active tenancy.' },
      { label: 'Total rooms', description: 'Sum of room records across all properties.' },
    ],
    benchmarks: [
      { label: 'Strong', range: '≥ 90%', tone: 'good' },
      { label: 'Acceptable', range: '75–90%', tone: 'warn' },
      { label: 'Weak', range: '< 75%', tone: 'bad' },
    ],
  },
  wault: {
    id: 'wault',
    label: 'WAULT',
    formula: 'Σ (rent × months remaining) ÷ Σ (rent)',
    what: 'Weighted Average Unexpired Lease Term in months, weighted by rent.',
    inputs: [
      { label: 'Tenancy end dates', description: 'Uses end date or break clause where present.' },
      { label: 'Rent', description: 'Monthly rent per tenancy.' },
    ],
    benchmarks: [
      { label: 'Healthy', range: '≥ 12 mo', tone: 'good' },
      { label: 'Renewals due', range: '6–12 mo', tone: 'warn' },
      { label: 'Action needed', range: '< 6 mo', tone: 'bad' },
    ],
  },
  void_rate: {
    id: 'void_rate',
    label: 'Void Rate',
    formula: 'Vacant rooms ÷ Total rooms',
    what: 'Share of lettable rooms that currently sit vacant.',
    inputs: [
      { label: 'Vacant rooms', description: 'Rooms with no active tenancy.' },
      { label: 'Total rooms', description: 'Sum of room records across all properties.' },
    ],
    benchmarks: [
      { label: 'Strong', range: '≤ 5%', tone: 'good' },
      { label: 'Acceptable', range: '5–15%', tone: 'warn' },
      { label: 'Weak', range: '> 15%', tone: 'bad' },
    ],
  },
};

export function getExplainer(id: string): KpiExplainer | undefined {
  return KPI_EXPLAINERS[id];
}
