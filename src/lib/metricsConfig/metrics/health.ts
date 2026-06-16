/**
 * Health & status metrics: health, risks, actions, missing_info
 */
import {
  calculateLTV,
  getEffectiveCosts,
  calculateHealthScore,
  getHealthGrade,
} from '@/lib/calculations';
import type { MetricConfig, PropertyBreakdownRow } from '../types';

export const healthMetric: MetricConfig = {
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
};

export const risksMetric: MetricConfig = {
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
};

export const actionsMetric: MetricConfig = {
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
};

export const missingInfoMetric: MetricConfig = {
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
};
