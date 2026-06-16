/**
 * Leverage metrics: ltv, dscr
 */
import { formatGBP, formatPercent, calculateLTV } from '@/lib/calculations';
import type { MetricConfig, PropertyBreakdownRow } from '../types';
import { getCurrentYearData } from '../helpers';

export const ltvMetric: MetricConfig = {
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
};

export const dscrMetric: MetricConfig = {
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
};
