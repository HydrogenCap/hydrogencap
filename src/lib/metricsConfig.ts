/**
 * Metrics Configuration
 * Centralized definitions for all dashboard metrics with breakdown logic
 */

import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { PropertyPassport } from '@/hooks/usePropertyPassport';
import {
  formatGBP,
  formatPercent,
  calculateLTV,
  getEffectiveCosts,
  calculateMonthlyCashflowAfterDebt,
  calculateMonthlyMortgagePayment,
  calculateHealthScore,
  getHealthGrade,
} from '@/lib/calculations';

export type MetricKey =
  | 'equity'
  | 'value'
  | 'mortgage'
  | 'debt'
  | 'cashflow'
  | 'rent'
  | 'noi'
  | 'net_yield'
  | 'ltv'
  | 'dscr'
  | 'health'
  | 'risks'
  | 'actions'
  | 'missing_info';

export interface PropertyBreakdownRow {
  propertyId: string;
  address: string;
  entityName?: string | null;
  values: Record<string, string | number | null>;
  /** Deep-link to fix missing inputs for this row (e.g. `/properties/:id?tab=financials`). */
  fixUrl?: string;
  /** Short reason shown on the fix button (e.g. "Add valuation"). */
  fixLabel?: string;
}

export interface EntityBreakdownRow {
  entityName: string;
  values: Record<string, string | number | null>;
}

export interface MetricBreakdown {
  title: string;
  summaryValue: string;
  calculationText: string;
  formula: string;
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: PropertyBreakdownRow[];
  /** Optional per-owning-entity rollup. */
  entityRows?: EntityBreakdownRow[];
  /** Columns for the entity table; falls back to property columns when omitted. */
  entityColumns?: { key: string; label: string; align?: 'left' | 'right' }[];
  totals?: Record<string, string | number>;
  emptyMessage?: string;
}

export interface MetricConfig {
  key: MetricKey;
  title: string;
  description: string;
  icon: string;
  getBreakdown: (
    properties: PropertyWithFinancials[],
    passports: PropertyPassport[]
  ) => MetricBreakdown;
}

// Helper to get current year data
function getCurrentYearData(property: PropertyWithFinancials) {
  const currentYear = new Date().getFullYear();
  const loan = property.loans?.[0];
  const income = property.income?.find(i => i.year === currentYear);
  const costs = property.costs?.find(c => c.year === currentYear);
  
  const value = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
  const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
  const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
  
  const effectiveCosts = getEffectiveCosts(rent, value, costs);
  
  // Use payment_override first, then stored mortgage_payment_gbp as fallback for override
  // This ensures we use the stored payment when auto-calculation can't work (e.g., missing term_months)
  const storedPayment = loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null;
  const paymentOverride = loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : storedPayment;
  
  const mortgagePaymentResult = calculateMonthlyMortgagePayment({
    balance: mortgage || null,
    interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
    termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
    isInterestOnly: loan?.capital_or_interest === 'interest',
    paymentOverride: paymentOverride,
  });
  
  return { loan, income, costs, value, mortgage, rent, effectiveCosts, mortgagePaymentResult };
}

export const METRICS_CONFIG: Record<MetricKey, MetricConfig> = {
  equity: {
    key: 'equity',
    title: 'Attributable Equity',
    description: 'Total equity across portfolio',
    icon: 'TrendingUp',
    getBreakdown: (properties) => {
      let totalValue = 0;
      let totalMortgage = 0;
      
      const rows: PropertyBreakdownRow[] = properties.map(property => {
        const { value, mortgage } = getCurrentYearData(property);
        const equity = value - mortgage;
        
        totalValue += value;
        totalMortgage += mortgage;
        
        return {
          propertyId: property.id,
          address: property.address_line,
          values: {
            value: formatGBP(value),
            mortgage: formatGBP(mortgage),
            equity: formatGBP(equity),
            valueRaw: value,
            mortgageRaw: mortgage,
            equityRaw: equity,
          },
        };
      }).sort((a, b) => (b.values.equityRaw as number) - (a.values.equityRaw as number));
      
      const totalEquity = totalValue - totalMortgage;
      
      return {
        title: 'Attributable Equity',
        summaryValue: formatGBP(totalEquity),
        calculationText: 'Equity is calculated as the difference between property value and outstanding mortgage balance for each property.',
        formula: 'Equity = Current Value − Mortgage Balance',
        columns: [
          { key: 'address', label: 'Property', align: 'left' },
          { key: 'value', label: 'Value', align: 'right' },
          { key: 'mortgage', label: 'Mortgage', align: 'right' },
          { key: 'equity', label: 'Equity', align: 'right' },
        ],
        rows,
        totals: {
          value: formatGBP(totalValue),
          mortgage: formatGBP(totalMortgage),
          equity: formatGBP(totalEquity),
        },
      };
    },
  },
  
  value: {
    key: 'value',
    title: 'Portfolio Value',
    description: 'Total current value of all properties',
    icon: 'Building2',
    getBreakdown: (properties) => {
      let total = 0;
      
      const rows: PropertyBreakdownRow[] = properties.map(property => {
        const { value } = getCurrentYearData(property);
        total += value;
        
        return {
          propertyId: property.id,
          address: property.address_line,
          values: {
            value: formatGBP(value),
            valueRaw: value,
            type: property.property_type || 'Unknown',
            beds: property.beds || '—',
          },
        };
      }).sort((a, b) => (b.values.valueRaw as number) - (a.values.valueRaw as number));
      
      return {
        title: 'Portfolio Value',
        summaryValue: formatGBP(total),
        calculationText: 'Total current market value of all properties in the portfolio based on the most recent valuations.',
        formula: 'Portfolio Value = Sum of all property current values',
        columns: [
          { key: 'address', label: 'Property', align: 'left' },
          { key: 'type', label: 'Type', align: 'left' },
          { key: 'beds', label: 'Beds', align: 'right' },
          { key: 'value', label: 'Value', align: 'right' },
        ],
        rows,
        totals: { value: formatGBP(total) },
      };
    },
  },
  
  mortgage: {
    key: 'mortgage',
    title: 'Total Mortgage',
    description: 'Total outstanding mortgage balance',
    icon: 'Landmark',
    getBreakdown: (properties) => {
      let total = 0;
      
      const rows: PropertyBreakdownRow[] = properties.map(property => {
        const { loan, mortgage } = getCurrentYearData(property);
        total += mortgage;
        
        return {
          propertyId: property.id,
          address: property.address_line,
          values: {
            balance: formatGBP(mortgage),
            balanceRaw: mortgage,
            lender: loan?.lender || 'Unknown',
            rate: loan?.interest_rate_percent ? `${Number(loan.interest_rate_percent).toFixed(2)}%` : '—',
            type: loan?.capital_or_interest || '—',
          },
        };
      }).sort((a, b) => (b.values.balanceRaw as number) - (a.values.balanceRaw as number));
      
      return {
        title: 'Total Mortgage',
        summaryValue: formatGBP(total),
        calculationText: 'Sum of all outstanding mortgage balances across the portfolio.',
        formula: 'Total Mortgage = Sum of all current mortgage balances',
        columns: [
          { key: 'address', label: 'Property', align: 'left' },
          { key: 'lender', label: 'Lender', align: 'left' },
          { key: 'rate', label: 'Rate', align: 'right' },
          { key: 'type', label: 'Type', align: 'left' },
          { key: 'balance', label: 'Balance', align: 'right' },
        ],
        rows,
        totals: { balance: formatGBP(total) },
      };
    },
  },
  
  cashflow: {
    key: 'cashflow',
    title: 'Monthly Cashflow',
    description: 'Net cashflow after all costs and debt service',
    icon: 'PoundSterling',
    getBreakdown: (properties) => {
      let totalCashflow = 0;
      let totalRent = 0;
      let totalCosts = 0;
      let totalDebtService = 0;
      
      const rows: PropertyBreakdownRow[] = properties.map(property => {
        const { rent, effectiveCosts, mortgagePaymentResult } = getCurrentYearData(property);
        
        const monthlyRent = rent ? rent / 12 : 0;
        const monthlyCosts = effectiveCosts.total / 12;
        const monthlyPayment = mortgagePaymentResult.effective || 0;
        const cashflow = calculateMonthlyCashflowAfterDebt(rent, effectiveCosts.total, mortgagePaymentResult.effective);
        
        totalRent += monthlyRent;
        totalCosts += monthlyCosts;
        totalDebtService += monthlyPayment;
        totalCashflow += cashflow || 0;
        
        return {
          propertyId: property.id,
          address: property.address_line,
          values: {
            rent: formatGBP(monthlyRent),
            costs: formatGBP(monthlyCosts),
            debtService: formatGBP(monthlyPayment),
            cashflow: formatGBP(cashflow || 0),
            cashflowRaw: cashflow || 0,
          },
        };
      }).sort((a, b) => (b.values.cashflowRaw as number) - (a.values.cashflowRaw as number));
      
      return {
        title: 'Monthly Cashflow',
        summaryValue: formatGBP(totalCashflow),
        calculationText: 'Monthly cashflow after deducting operating costs (management, repairs, insurance, bills) and mortgage payments from rental income.',
        formula: 'Cashflow = (Annual Rent / 12) − (Monthly Costs) − (Mortgage Payment)',
        columns: [
          { key: 'address', label: 'Property', align: 'left' },
          { key: 'rent', label: 'Rent/mo', align: 'right' },
          { key: 'costs', label: 'Costs/mo', align: 'right' },
          { key: 'debtService', label: 'Debt/mo', align: 'right' },
          { key: 'cashflow', label: 'Cashflow', align: 'right' },
        ],
        rows,
        totals: {
          rent: formatGBP(totalRent),
          costs: formatGBP(totalCosts),
          debtService: formatGBP(totalDebtService),
          cashflow: formatGBP(totalCashflow),
        },
      };
    },
  },
  
  ltv: {
    key: 'ltv',
    title: 'Average LTV',
    description: 'Weighted loan-to-value ratio across portfolio',
    icon: 'Percent',
    getBreakdown: (properties) => {
      let totalValue = 0;
      let totalMortgage = 0;
      
      const rows: PropertyBreakdownRow[] = properties.map(property => {
        const { value, mortgage } = getCurrentYearData(property);
        const ltv = calculateLTV(mortgage, value);
        
        totalValue += value;
        totalMortgage += mortgage;
        
        return {
          propertyId: property.id,
          address: property.address_line,
          values: {
            value: formatGBP(value),
            mortgage: formatGBP(mortgage),
            ltv: ltv !== null ? formatPercent(ltv) : '—',
            ltvRaw: ltv || 0,
          },
        };
      }).sort((a, b) => (b.values.ltvRaw as number) - (a.values.ltvRaw as number));
      
      const weightedLTV = totalValue > 0 ? (totalMortgage / totalValue) * 100 : 0;
      
      return {
        title: 'Average LTV',
        summaryValue: formatPercent(weightedLTV),
        calculationText: 'Weighted average LTV calculated as total mortgage balance divided by total portfolio value. This provides a better picture than simple average as it accounts for property sizes.',
        formula: 'Weighted LTV = (Total Mortgage ÷ Total Value) × 100',
        columns: [
          { key: 'address', label: 'Property', align: 'left' },
          { key: 'value', label: 'Value', align: 'right' },
          { key: 'mortgage', label: 'Mortgage', align: 'right' },
          { key: 'ltv', label: 'LTV', align: 'right' },
        ],
        rows,
        totals: {
          value: formatGBP(totalValue),
          mortgage: formatGBP(totalMortgage),
          ltv: formatPercent(weightedLTV),
        },
      };
    },
  },

  dscr: {
    key: 'dscr',
    title: 'Debt Service Coverage Ratio',
    description: 'NOI divided by annual debt service payments',
    icon: 'Percent',
    getBreakdown: (properties) => {
      let totalNOI = 0;
      let totalDebtService = 0;

      const rows: PropertyBreakdownRow[] = properties.map(property => {
        const { rent, effectiveCosts, mortgagePaymentResult } = getCurrentYearData(property);
        const noi = (rent || 0) - effectiveCosts.total;
        const monthlyPayment = mortgagePaymentResult.effective || 0;
        const annualDebtService = monthlyPayment * 12;
        totalNOI += noi;
        totalDebtService += annualDebtService;
        const dscr = annualDebtService > 0 ? noi / annualDebtService : null;
        return {
          propertyId: property.id,
          address: property.address_line,
          values: {
            noi: formatGBP(noi),
            debtService: formatGBP(annualDebtService),
            dscr: dscr !== null ? `${dscr.toFixed(2)}x` : 'N/A',
          },
        };
      });

      const portfolioDSCR = totalDebtService > 0 ? totalNOI / totalDebtService : null;

      return {
        title: 'Debt Service Coverage Ratio',
        summaryValue: portfolioDSCR !== null ? `${portfolioDSCR.toFixed(2)}x` : 'N/A',
        calculationText: `${rows.length} properties with debt`,
        formula: 'DSCR = Annual NOI ÷ Annual Debt Service',
        columns: [
          { key: 'address', label: 'Property', align: 'left' as const },
          { key: 'noi', label: 'Annual NOI', align: 'right' as const },
          { key: 'debtService', label: 'Annual Debt Service', align: 'right' as const },
          { key: 'dscr', label: 'DSCR', align: 'right' as const },
        ],
        rows: rows.sort((a, b) => {
          const aVal = parseFloat(String(a.values.dscr)) || 0;
          const bVal = parseFloat(String(b.values.dscr)) || 0;
          return aVal - bVal;
        }),
        totals: {
          noi: formatGBP(totalNOI),
          debtService: formatGBP(totalDebtService),
          dscr: portfolioDSCR !== null ? `${portfolioDSCR.toFixed(2)}x` : 'N/A',
        },
      };
    },
  },

  health: {
    key: 'health',
    title: 'Portfolio Health',
    description: 'Overall health score based on cashflow, leverage, risk, and compliance',
    icon: 'Activity',
    getBreakdown: (properties) => {
      const currentYear = new Date().getFullYear();
      
      const rows: PropertyBreakdownRow[] = properties.map(property => {
        const loan = property.loans?.[0];
        const income = property.income?.find(i => i.year === currentYear);
        const costs = property.costs?.find(c => c.year === currentYear);
        
        const mortgageBalance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
        const currentValue = property.current_value_gbp ? Number(property.current_value_gbp) : null;
        const annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
        
        const effectiveCosts = getEffectiveCosts(annualRent, currentValue, costs);
        const ltv = calculateLTV(mortgageBalance, currentValue);
        const mortgagePayment = loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null;
        const isInterestOnly = loan?.capital_or_interest === 'interest';
        
        const score = calculateHealthScore({
          annualRent,
          totalCosts: effectiveCosts.total,
          mortgagePayment,
          ltv,
          fixedRateExpires: loan?.fixed_rate_expires || null,
          isInterestOnly,
          epcRating: property.epc_rating,
        });
        
        const grade = getHealthGrade(score.total);
        
        return {
          propertyId: property.id,
          address: property.address_line,
          values: {
            grade,
            score: score.total,
            cashflow: score.cashflow,
            leverage: score.leverage,
            risk: score.risk,
            compliance: score.compliance,
            scoreRaw: score.total,
          },
        };
      }).sort((a, b) => (a.values.scoreRaw as number) - (b.values.scoreRaw as number));
      
      const avgScore = rows.length > 0 
        ? Math.round(rows.reduce((sum, r) => sum + (r.values.scoreRaw as number), 0) / rows.length)
        : 0;
      
      return {
        title: 'Portfolio Health',
        summaryValue: `${getHealthGrade(avgScore)} (${avgScore}/100)`,
        calculationText: 'Health scores are calculated from four weighted categories: Cashflow margin (25%), Leverage/LTV (25%), Risk factors like mortgage expiry (25%), and Compliance status (25%).',
        formula: 'Health = (Cashflow × 0.25) + (Leverage × 0.25) + (Risk × 0.25) + (Compliance × 0.25)',
        columns: [
          { key: 'address', label: 'Property', align: 'left' },
          { key: 'grade', label: 'Grade', align: 'left' },
          { key: 'score', label: 'Score', align: 'right' },
          { key: 'cashflow', label: 'Cashflow', align: 'right' },
          { key: 'leverage', label: 'Leverage', align: 'right' },
          { key: 'risk', label: 'Risk', align: 'right' },
          { key: 'compliance', label: 'Compliance', align: 'right' },
        ],
        rows,
      };
    },
  },
  
  risks: {
    key: 'risks',
    title: 'Portfolio Risks',
    description: 'Active risk items requiring attention',
    icon: 'AlertTriangle',
    getBreakdown: () => ({
      title: 'Portfolio Risks',
      summaryValue: '—',
      calculationText: 'View the Actions page for a comprehensive list of all portfolio risks including LTV thresholds, EPC ratings, rate expiries, and cashflow issues.',
      formula: 'N/A',
      columns: [],
      rows: [],
      emptyMessage: 'Use the Actions page to view and manage all portfolio risks.',
    }),
  },
  
  actions: {
    key: 'actions',
    title: 'Action Required',
    description: 'Issues requiring attention',
    icon: 'AlertTriangle',
    getBreakdown: () => ({
      title: 'Action Required',
      summaryValue: '—',
      calculationText: 'View the Actions page for detailed risk assessment and required actions.',
      formula: 'N/A',
      columns: [],
      rows: [],
      emptyMessage: 'Use the Actions page to view and manage risks.',
    }),
  },
  
  missing_info: {
    key: 'missing_info',
    title: 'Missing Information',
    description: 'Properties with incomplete data',
    icon: 'AlertCircle',
    getBreakdown: () => ({
      title: 'Missing Information',
      summaryValue: '—',
      calculationText: 'View the Missing Info page for detailed breakdown of missing fields.',
      formula: 'N/A',
      columns: [],
      rows: [],
      emptyMessage: 'Use the Missing Info page to complete property data.',
    }),
  },

  // ── Aliases / additional KPIs ──────────────────────────────────────────
  // `debt` is an alias of `mortgage` so the Dashboard's "Total Debt" KPI
  // can route to a familiar mortgage breakdown.
  debt: {
    key: 'debt',
    title: 'Total Debt',
    description: 'Outstanding mortgage debt across the portfolio',
    icon: 'Landmark',
    getBreakdown: (...args) => METRICS_CONFIG.mortgage.getBreakdown(...args),
  },

  rent: {
    key: 'rent',
    title: 'Annual Rent',
    description: 'Contracted annual rental income',
    icon: 'Wallet',
    getBreakdown: (properties) => {
      let total = 0;
      const rows: PropertyBreakdownRow[] = properties.map(property => {
        const { rent } = getCurrentYearData(property);
        const annual = rent ?? 0;
        total += annual;
        const missing = !rent || rent <= 0;
        return {
          propertyId: property.id,
          address: property.address_line,
          entityName: (property as unknown as { __v2_entity_name?: string | null }).__v2_entity_name ?? null,
          values: {
            rent: missing ? '—' : formatGBP(annual),
            monthly: missing ? '—' : formatGBP(annual / 12),
            rentRaw: annual,
          },
          fixUrl: missing ? `/properties/${property.id}?tab=financials` : undefined,
          fixLabel: missing ? 'Add rent' : undefined,
        };
      }).sort((a, b) => (b.values.rentRaw as number) - (a.values.rentRaw as number));

      return {
        title: 'Annual Rent',
        summaryValue: formatGBP(total),
        calculationText: 'Sum of contracted annual rent for each property, taken from the current-year income record.',
        formula: 'Annual Rent = Σ property.annual_rent_gbp',
        columns: [
          { key: 'address', label: 'Property', align: 'left' },
          { key: 'monthly', label: 'Monthly', align: 'right' },
          { key: 'rent', label: 'Annual', align: 'right' },
        ],
        rows,
        entityRows: rollupByEntity(rows, ['rentRaw'], { rentRaw: 'rent' }),
        entityColumns: [
          { key: 'entityName', label: 'Owning entity', align: 'left' },
          { key: 'count', label: 'Properties', align: 'right' },
          { key: 'rent', label: 'Annual rent', align: 'right' },
        ],
        totals: { rent: formatGBP(total) },
      };
    },
  },

  noi: {
    key: 'noi',
    title: 'Net Operating Income',
    description: 'Annual rent minus operating costs (before debt service)',
    icon: 'TrendingUp',
    getBreakdown: (properties) => {
      let totalNoi = 0;
      let totalRent = 0;
      let totalCosts = 0;
      const rows: PropertyBreakdownRow[] = properties.map(property => {
        const { rent, effectiveCosts } = getCurrentYearData(property);
        const annualRent = rent ?? 0;
        const annualCosts = effectiveCosts.total;
        const noi = annualRent - annualCosts;
        totalNoi += noi;
        totalRent += annualRent;
        totalCosts += annualCosts;
        const missing = !rent || rent <= 0;
        return {
          propertyId: property.id,
          address: property.address_line,
          entityName: (property as unknown as { __v2_entity_name?: string | null }).__v2_entity_name ?? null,
          values: {
            rent: formatGBP(annualRent),
            costs: formatGBP(annualCosts),
            noi: formatGBP(noi),
            noiRaw: noi,
          },
          fixUrl: missing ? `/properties/${property.id}?tab=financials` : undefined,
          fixLabel: missing ? 'Add rent' : undefined,
        };
      }).sort((a, b) => (b.values.noiRaw as number) - (a.values.noiRaw as number));

      return {
        title: 'Net Operating Income',
        summaryValue: formatGBP(totalNoi),
        calculationText: 'Rental income minus operating costs (management, repairs, insurance, bills, etc.), excluding mortgage interest. Uses the shared cost-rules engine in calculations.ts.',
        formula: 'NOI = Annual Rent − Operating Costs',
        columns: [
          { key: 'address', label: 'Property', align: 'left' },
          { key: 'rent', label: 'Rent', align: 'right' },
          { key: 'costs', label: 'Costs', align: 'right' },
          { key: 'noi', label: 'NOI', align: 'right' },
        ],
        rows,
        entityRows: rollupByEntity(rows, ['noiRaw'], { noiRaw: 'noi' }),
        entityColumns: [
          { key: 'entityName', label: 'Owning entity', align: 'left' },
          { key: 'count', label: 'Properties', align: 'right' },
          { key: 'noi', label: 'NOI', align: 'right' },
        ],
        totals: {
          rent: formatGBP(totalRent),
          costs: formatGBP(totalCosts),
          noi: formatGBP(totalNoi),
        },
      };
    },
  },

  net_yield: {
    key: 'net_yield',
    title: 'Portfolio Net Yield',
    description: 'NOI divided by portfolio value',
    icon: 'Percent',
    getBreakdown: (properties) => {
      let totalNoi = 0;
      let totalValue = 0;
      const rows: PropertyBreakdownRow[] = properties.map(property => {
        const { rent, effectiveCosts, value } = getCurrentYearData(property);
        const noi = (rent ?? 0) - effectiveCosts.total;
        const yieldPct = value > 0 ? (noi / value) * 100 : null;
        totalNoi += noi;
        totalValue += value;
        const missing = value <= 0 || !rent || rent <= 0;
        return {
          propertyId: property.id,
          address: property.address_line,
          entityName: (property as unknown as { __v2_entity_name?: string | null }).__v2_entity_name ?? null,
          values: {
            value: formatGBP(value),
            noi: formatGBP(noi),
            yield: yieldPct !== null ? formatPercent(yieldPct) : '—',
            yieldRaw: yieldPct ?? 0,
          },
          fixUrl: missing ? `/properties/${property.id}?tab=financials` : undefined,
          fixLabel: value <= 0 ? 'Add valuation' : (!rent || rent <= 0 ? 'Add rent' : undefined),
        };
      }).sort((a, b) => (b.values.yieldRaw as number) - (a.values.yieldRaw as number));

      const portfolioYield = totalValue > 0 ? (totalNoi / totalValue) * 100 : null;

      return {
        title: 'Portfolio Net Yield',
        summaryValue: portfolioYield !== null ? formatPercent(portfolioYield) : '—',
        calculationText: 'Portfolio net yield is the value-weighted ratio of total NOI to total portfolio value. NOI uses the same cost-rules engine as the cashflow KPI.',
        formula: 'Net Yield = (Σ NOI ÷ Σ Value) × 100',
        columns: [
          { key: 'address', label: 'Property', align: 'left' },
          { key: 'value', label: 'Value', align: 'right' },
          { key: 'noi', label: 'NOI', align: 'right' },
          { key: 'yield', label: 'Net yield', align: 'right' },
        ],
        rows,
        totals: {
          value: formatGBP(totalValue),
          noi: formatGBP(totalNoi),
          yield: portfolioYield !== null ? formatPercent(portfolioYield) : '—',
        },
      };
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Roll up property rows into one row per owning entity, summing the raw fields
 *  in `sumKeys` and formatting them back as GBP under `displayKeys`. */
function rollupByEntity(
  rows: PropertyBreakdownRow[],
  sumKeys: string[],
  displayKeys: Record<string, string>,
): EntityBreakdownRow[] {
  const map = new Map<string, { count: number; sums: Record<string, number> }>();
  for (const row of rows) {
    const name = row.entityName || 'Unassigned';
    const bucket = map.get(name) ?? { count: 0, sums: Object.fromEntries(sumKeys.map(k => [k, 0])) };
    bucket.count += 1;
    for (const k of sumKeys) {
      bucket.sums[k] += Number(row.values[k] ?? 0);
    }
    map.set(name, bucket);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].sums[sumKeys[0]] - a[1].sums[sumKeys[0]])
    .map(([entityName, b]) => {
      const values: Record<string, string | number | null> = {
        entityName,
        count: b.count,
      };
      for (const k of sumKeys) {
        values[displayKeys[k]] = formatGBP(b.sums[k]);
      }
      return { entityName, values };
    });
}

export function getMetricConfig(key: MetricKey): MetricConfig {
  return METRICS_CONFIG[key];
}
