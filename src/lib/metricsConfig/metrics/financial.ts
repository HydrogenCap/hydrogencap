/**
 * Financial metrics: equity, value, mortgage, debt, cashflow
 */
import { formatGBP, calculateMonthlyCashflowAfterDebt } from '@/lib/calculations';
import type { MetricConfig, PropertyBreakdownRow } from '../types';
import { getCurrentYearData } from '../helpers';

export const equityMetric: MetricConfig = {
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
};

export const valueMetric: MetricConfig = {
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
};

export const mortgageMetric: MetricConfig = {
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
};

export const debtMetric: MetricConfig = {
  key: 'debt',
  title: 'Total Debt',
  description: 'Outstanding mortgage debt across the portfolio',
  icon: 'Landmark',
  getBreakdown: (...args) => mortgageMetric.getBreakdown(...args),
};

export const cashflowMetric: MetricConfig = {
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
};
