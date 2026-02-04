import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PortfolioStats } from '@/lib/portfolioStats';
import { formatGBP, formatGBPDecimal } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Wallet, 
  PiggyBank, 
  Percent, 
  Building2,
  Scale,
  BedDouble
} from 'lucide-react';

interface PortfolioMetricsFooterProps {
  stats: PortfolioStats;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  variant?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info';
}

function MetricCard({ label, value, subtext, icon: Icon, variant = 'neutral' }: MetricCardProps) {
  const variantStyles = {
    neutral: 'text-foreground',
    positive: 'text-success',
    negative: 'text-destructive',
    warning: 'text-warning',
    info: 'text-primary',
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={cn('text-xl font-bold', variantStyles[variant])}>
        {value}
      </div>
      {subtext && (
        <span className="text-xs text-muted-foreground">{subtext}</span>
      )}
    </div>
  );
}

export function PortfolioMetricsFooter({ stats }: PortfolioMetricsFooterProps) {
  const isPositiveCashflow = stats.totalMonthlyCashflow >= 0;
  const annualCashflow = stats.totalMonthlyCashflow * 12;

  // Determine LTV health
  const ltvVariant = stats.portfolioLTV > 75 
    ? 'negative' 
    : stats.portfolioLTV > 60 
      ? 'warning' 
      : 'positive';

  // Determine yield health
  const yieldVariant = stats.weightedAvgYield >= 8 
    ? 'positive' 
    : stats.weightedAvgYield >= 6 
      ? 'info' 
      : 'warning';

  return (
    <Card className="bg-card border-border mt-4">
      <CardContent className="py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          {/* Net Monthly Cashflow */}
          <MetricCard
            label="Net Cashflow /mo"
            value={formatGBPDecimal(stats.totalMonthlyCashflow)}
            subtext={`${formatGBPDecimal(annualCashflow)}/yr`}
            icon={isPositiveCashflow ? TrendingUp : TrendingDown}
            variant={isPositiveCashflow ? 'positive' : 'negative'}
          />

          {/* Portfolio LTV */}
          <MetricCard
            label="Portfolio LTV"
            value={`${stats.portfolioLTV.toFixed(1)}%`}
            subtext="Debt / Value"
            icon={Scale}
            variant={ltvVariant}
          />

          {/* Total Equity */}
          <MetricCard
            label="Total Equity"
            value={formatGBPDecimal(stats.totalEquity)}
            subtext={`Across ${stats.count} properties`}
            icon={Wallet}
            variant="info"
          />

          {/* Total Debt */}
          <MetricCard
            label="Total Debt"
            value={formatGBPDecimal(stats.totalMortgageBalance)}
            subtext="Outstanding balance"
            icon={Building2}
            variant="neutral"
          />

          {/* Weighted Yield */}
          <MetricCard
            label="Portfolio Yield"
            value={`${stats.weightedAvgYield.toFixed(2)}%`}
            subtext="Rent / Value"
            icon={Percent}
            variant={yieldVariant}
          />

          {/* Total Beds */}
          <MetricCard
            label="Total Beds"
            value={stats.totalBeds}
            subtext={`Avg ${stats.avgBeds.toFixed(1)} per property`}
            icon={BedDouble}
            variant="neutral"
          />
        </div>
      </CardContent>
    </Card>
  );
}
