import { Building2, PoundSterling, Percent, TrendingUp, Bed, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatGBP, formatPercent } from '@/lib/calculations';
import type { PortfolioSnapshot } from '@/hooks/usePortfolioTimeline';

interface TimelineSummaryRailProps {
  snapshot: PortfolioSnapshot | null;
  viewMode: 'gross' | 'attributable';
  isLoading?: boolean;
}

export function TimelineSummaryRail({ snapshot, viewMode, isLoading }: TimelineSummaryRailProps) {
  if (isLoading || !snapshot) {
    return (
      <Card className="sticky top-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Portfolio Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      label: 'Properties',
      value: snapshot.propertyCount.toString(),
      icon: Building2,
      description: 'Total properties in portfolio',
    },
    {
      label: 'Total Beds',
      value: snapshot.totalBeds.toString(),
      icon: Bed,
      description: 'Combined bedroom count',
    },
    {
      label: 'Portfolio Value',
      value: formatGBP(snapshot.totalValue),
      icon: PoundSterling,
      description: viewMode === 'attributable' ? 'Your attributable share' : 'Gross value (100%)',
    },
    {
      label: 'Mortgage Balance',
      value: formatGBP(snapshot.totalMortgage),
      icon: PoundSterling,
      description: 'Total outstanding debt',
    },
    {
      label: 'Equity',
      value: formatGBP(snapshot.equity),
      icon: TrendingUp,
      description: 'Value minus mortgage',
      highlight: true,
    },
    {
      label: 'Average LTV',
      value: snapshot.averageLTV !== null ? formatPercent(snapshot.averageLTV) : '—',
      icon: Percent,
      description: 'Loan-to-value ratio',
    },
    {
      label: 'Annual Cashflow',
      value: formatGBP(snapshot.annualCashflow),
      icon: ArrowUpRight,
      description: 'Net income after all costs and debt',
      highlight: snapshot.annualCashflow > 0,
      warning: snapshot.annualCashflow < 0,
    },
    {
      label: 'Weighted ROCE',
      value: snapshot.weightedROCE !== null ? formatPercent(snapshot.weightedROCE) : '—',
      icon: TrendingUp,
      description: 'Return on capital employed',
    },
  ];

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Current Portfolio
          {viewMode === 'attributable' && (
            <span className="ml-2 text-xs text-primary">(Attributable)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map(metric => (
          <div
            key={metric.label}
            className={`p-3 rounded-lg ${
              metric.warning
                ? 'bg-destructive/10'
                : metric.highlight
                ? 'bg-primary/10'
                : 'bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <metric.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{metric.label}</span>
            </div>
            <p
              className={`text-lg font-semibold ${
                metric.warning
                  ? 'text-destructive'
                  : metric.highlight
                  ? 'text-primary'
                  : 'text-foreground'
              }`}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
