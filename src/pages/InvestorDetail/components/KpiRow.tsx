import { Card, CardContent } from '@/components/ui/card';
import { fmt } from '../utils/badges';

export function KpiRow({
  kpis,
}: {
  kpis: {
    totalCommitted: number;
    totalDrawn: number;
    totalEquityValue: number;
    totalDistributed: number;
    weightedMultiple: number;
  };
}) {
  const multipleColor = kpis.weightedMultiple >= 1.5 ? 'text-emerald-600' : kpis.weightedMultiple >= 1 ? 'text-amber-600' : 'text-destructive';
  const equityColor = kpis.totalEquityValue > kpis.totalDrawn ? 'text-emerald-600' : '';

  const items = [
    { label: 'Total Committed', value: fmt(kpis.totalCommitted) },
    { label: 'Total Deployed', value: fmt(kpis.totalDrawn) },
    { label: 'Current Equity Value', value: fmt(kpis.totalEquityValue), className: equityColor },
    { label: 'Total Distributions', value: fmt(kpis.totalDistributed) },
    { label: 'Equity Multiple', value: `${kpis.weightedMultiple.toFixed(2)}x`, className: multipleColor },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {items.map(kpi => (
        <Card key={kpi.label}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.className || ''}`}>{kpi.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
