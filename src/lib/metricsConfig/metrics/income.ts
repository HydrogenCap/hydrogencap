/**
 * Income metrics: rent, noi, net_yield
 */
import { formatGBP, formatPercent } from '@/lib/calculations';
import type { MetricConfig, PropertyBreakdownRow } from '../types';
import { getCurrentYearData, rollupByEntity } from '../helpers';

export const rentMetric: MetricConfig = {
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
};

export const noiMetric: MetricConfig = {
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
};

export const netYieldMetric: MetricConfig = {
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
};
