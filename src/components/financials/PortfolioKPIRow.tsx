import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatGBPDecimal } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import type { PortfolioFinancials } from '@/hooks/usePortfolioFinancials';

interface Props {
  data: PortfolioFinancials;
}

function KPICard({ label, value, subtitle, positive, negative }: {
  label: string; value: string; subtitle?: string; positive?: boolean; negative?: boolean;
}) {
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', positive && 'text-primary', negative && 'text-destructive', !positive && !negative && 'text-muted-foreground')} />
          <span className={cn('text-2xl font-bold', positive && 'text-primary', negative && 'text-destructive')}>
            {value}
          </span>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export function PortfolioKPIRow({ data }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        label="Monthly Income"
        value={formatGBPDecimal(data.monthlyIncome)}
        subtitle={`${data.properties.length} properties`}
        positive={data.monthlyIncome > 0}
      />
      <KPICard
        label="Monthly Costs"
        value={formatGBPDecimal(data.monthlyCosts + data.monthlyMortgage)}
        subtitle="Operating + mortgage"
        negative
      />
      <KPICard
        label="Monthly NOI"
        value={formatGBPDecimal(data.monthlyNOI)}
        subtitle="Before mortgage"
        positive={data.monthlyNOI >= 0}
        negative={data.monthlyNOI < 0}
      />
      <KPICard
        label="Monthly Cashflow"
        value={formatGBPDecimal(data.monthlyCashflow)}
        subtitle="After mortgage"
        positive={data.monthlyCashflow >= 0}
        negative={data.monthlyCashflow < 0}
      />
    </div>
  );
}
