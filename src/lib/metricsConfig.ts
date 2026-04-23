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
  | 'cashflow'
  | 'ltv'
  | 'dscr'
  | 'health'
  | 'risks'
  | 'actions'
  | 'missing_info';

export interface PropertyBreakdownRow {
  propertyId: string;
  address: string;
  values: Record<string, string | number | null>;
}

export interface MetricBreakdown {
  title: string;
  summaryValue: string;
  calculationText: string;
  formula: string;
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: PropertyBreakdownRow[];
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
};

export function getMetricConfig(key: MetricKey): MetricConfig {
  return METRICS_CONFIG[key];
}
