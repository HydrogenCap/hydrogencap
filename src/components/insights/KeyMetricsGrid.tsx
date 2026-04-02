import { Percent, Wallet, PiggyBank, Bed } from 'lucide-react';
import { MetricCard } from '@/components/insights/MetricCard';
import { type PortfolioInsights } from '@/lib/portfolioInsights';
import { formatGBP, formatPercent, formatGBPCompact } from '@/lib/calculations';

interface KeyMetricsGridProps {
  portfolioInsights: PortfolioInsights;
}

export function KeyMetricsGrid({ portfolioInsights }: KeyMetricsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={Percent}
        title="Weighted Avg Rate"
        value={formatPercent(portfolioInsights.debt.weightedAverageInterestRate, 2)}
        subtitle={`${formatGBPCompact(portfolioInsights.debt.totalMortgageBalance)} debt`}
      />
      <MetricCard
        icon={Wallet}
        title="Cashflow Margin"
        value={formatPercent(portfolioInsights.cashflow.cashflowMargin, 1)}
        subtitle={`${formatGBP(portfolioInsights.cashflow.totalCashflowAfterDebt)}/yr after debt`}
        status={portfolioInsights.cashflow.totalCashflowAfterDebt >= 0 ? 'positive' : 'negative'}
      />
      <MetricCard
        icon={PiggyBank}
        title="Portfolio Yield"
        value={formatPercent(portfolioInsights.returns.portfolioNetYield, 2)}
        subtitle={`ROCE: ${formatPercent(portfolioInsights.returns.portfolioROCE, 1)}`}
      />
      <MetricCard
        icon={Bed}
        title="Rent / Bedroom"
        value={portfolioInsights.returns.rentPerBedroomMonthly
          ? `${formatGBP(portfolioInsights.returns.rentPerBedroomMonthly)}/mo`
          : '—'
        }
        subtitle={`${portfolioInsights.returns.totalBedrooms} total bedrooms`}
      />
    </div>
  );
}
