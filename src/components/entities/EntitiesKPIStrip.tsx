import { Card, CardContent } from '@/components/ui/card';
import { Building2, PoundSterling, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntitiesKPIStripProps {
  total: number;
  typeBreakdown: { spv: number; personal: number; jv: number; trust: number };
  totalValue: number;
  totalDebt: number;
  blendedLTV: number | null;
  filingsAttention: number;
  onClickFilings?: () => void;
}

function fmtGBP(v: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: v >= 1_000_000 ? 'compact' : 'standard',
  }).format(v);
}

export function EntitiesKPIStrip({
  total,
  typeBreakdown,
  totalValue,
  totalDebt,
  blendedLTV,
  filingsAttention,
  onClickFilings,
}: EntitiesKPIStripProps) {
  const cards = [
    {
      icon: Building2,
      label: 'Total entities',
      value: total.toString(),
      sub: `${typeBreakdown.spv} SPV · ${typeBreakdown.personal} Personal · ${typeBreakdown.jv} JV · ${typeBreakdown.trust} Trust`,
    },
    {
      icon: PoundSterling,
      label: 'Aggregate value',
      value: fmtGBP(totalValue),
      sub: 'Across all entities',
    },
    {
      icon: TrendingDown,
      label: 'Aggregate debt',
      value: fmtGBP(totalDebt),
      sub: blendedLTV != null ? `Blended LTV ${blendedLTV.toFixed(1)}%` : 'No active debt',
    },
    {
      icon: AlertTriangle,
      label: 'Filings attention',
      value: filingsAttention.toString(),
      sub: 'Overdue or due ≤30 days',
      action: onClickFilings,
      highlight: filingsAttention > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        const isAction = !!c.action;
        return (
          <Card
            key={i}
            className={cn(
              'transition-shadow',
              isAction && 'cursor-pointer hover:shadow-md',
              c.highlight && 'border-amber-500/40 bg-amber-500/5',
            )}
            onClick={c.action}
            role={isAction ? 'button' : undefined}
            tabIndex={isAction ? 0 : undefined}
          >
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                <Icon className={cn('h-4 w-4 text-muted-foreground', c.highlight && 'text-amber-500')} />
              </div>
              <div className="text-2xl font-bold text-foreground">{c.value}</div>
              <div className="text-xs text-muted-foreground truncate">{c.sub}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
