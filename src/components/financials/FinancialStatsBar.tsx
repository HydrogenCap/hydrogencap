import { Card, CardContent } from '@/components/ui/card';
import { formatGBPDecimal } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import type { PortfolioMonthlySummary } from '@/lib/financialSnapshotTypes';
import { format } from 'date-fns';

interface Props {
  latest: PortfolioMonthlySummary | null;
  trailing12NOI: number;
}

function StatCard({ label, value, subtext, variant = 'neutral' }: {
  label: string; value: string; subtext?: string;
  variant?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info';
}) {
  const colors = {
    neutral: 'text-foreground',
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-primary',
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn('text-xl font-bold', colors[variant])}>{value}</span>
      {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
    </div>
  );
}

export function FinancialStatsBar({ latest, trailing12NOI }: Props) {
  if (!latest) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          No financial data yet. Record your first monthly figures to see stats here.
        </CardContent>
      </Card>
    );
  }

  const monthLabel = format(new Date(latest.snapshot_month), 'MMM yyyy');
  const collectionVariant = latest.portfolio_collection_rate >= 95 ? 'positive'
    : latest.portfolio_collection_rate >= 90 ? 'warning' : 'negative';
  const occupancyVariant = (latest.avg_occupancy_rate || 0) >= 92 ? 'positive'
    : (latest.avg_occupancy_rate || 0) >= 85 ? 'warning' : 'negative';

  return (
    <Card>
      <CardContent className="py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
          <StatCard
            label="Monthly NOI"
            value={formatGBPDecimal(latest.total_noi)}
            subtext={monthLabel}
            variant={latest.total_noi >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            label="Monthly Cash Flow"
            value={formatGBPDecimal(latest.total_cash_flow)}
            subtext="After mortgage"
            variant={latest.total_cash_flow >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            label="Collection Rate"
            value={`${latest.portfolio_collection_rate.toFixed(1)}%`}
            subtext={monthLabel}
            variant={collectionVariant}
          />
          <StatCard
            label="Avg Occupancy"
            value={latest.avg_occupancy_rate != null ? `${latest.avg_occupancy_rate.toFixed(1)}%` : '—'}
            subtext={monthLabel}
            variant={occupancyVariant}
          />
          <StatCard
            label="Trailing 12m NOI"
            value={formatGBPDecimal(trailing12NOI)}
            subtext="Last 12 months"
            variant={trailing12NOI >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </CardContent>
    </Card>
  );
}
