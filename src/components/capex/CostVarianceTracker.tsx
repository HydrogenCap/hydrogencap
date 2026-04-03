import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import type { CapexLineItem } from '@/hooks/useCapex';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);

const pctFmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

function varianceColor(variancePct: number): string {
  if (variancePct <= 0) return 'text-green-600';
  if (variancePct <= 10) return 'text-amber-500';
  return 'text-destructive';
}

function varianceBadge(variancePct: number): 'outline' | 'secondary' | 'destructive' {
  if (variancePct <= 0) return 'outline';
  if (variancePct <= 10) return 'secondary';
  return 'destructive';
}

export default function CostVarianceTracker({
  items,
  totalBudget,
}: {
  items: CapexLineItem[];
  totalBudget: number;
}) {
  const rows = useMemo(() =>
    items.map(item => {
      const budget = Number(item.budget_gbp);
      const actual = Number(item.actual_gbp);
      const variance = actual - budget;
      const variancePct = budget > 0 ? (variance / budget) * 100 : 0;
      return { ...item, budget, actual, variance, variancePct };
    }),
  [items]);

  const totals = useMemo(() => {
    const budget = rows.reduce((s, r) => s + r.budget, 0);
    const actual = rows.reduce((s, r) => s + r.actual, 0);
    const variance = actual - budget;
    const variancePct = budget > 0 ? (variance / budget) * 100 : 0;
    return { budget, actual, variance, variancePct };
  }, [rows]);

  // Contingency tracking
  const contingencyItem = rows.find(r => r.category === 'Contingency');
  const contingencyBudget = contingencyItem ? contingencyItem.budget : 0;
  const overspend = Math.max(0, totals.actual - totals.budget + contingencyBudget);
  const contingencyRemaining = Math.max(0, contingencyBudget - overspend);

  // Alert threshold
  const spendPct = totalBudget > 0 ? (totals.actual / totalBudget) * 100 : 0;
  const showAlert = spendPct >= 90;

  return (
    <div className="space-y-4">
      {/* Alert banner */}
      {showAlert && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium">Budget Alert</p>
              <p className="text-xs text-muted-foreground">
                Total spend has reached {spendPct.toFixed(0)}% of the project budget ({fmt(totalBudget)})
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variance table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost Variance</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items to show variance for.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-right px-3 py-2 font-medium">Budgeted</th>
                    <th className="text-right px-3 py-2 font-medium">Actual</th>
                    <th className="text-right px-3 py-2 font-medium">Variance (£)</th>
                    <th className="text-right px-3 py-2 font-medium">Variance (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(row => (
                    <tr key={row.id}>
                      <td className="px-3 py-2">
                        <span className="font-medium">{row.description}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{row.category}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{fmt(row.budget)}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.actual)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${varianceColor(row.variancePct)}`}>
                        {row.variance >= 0 ? '+' : ''}{fmt(row.variance)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={varianceBadge(row.variancePct)} className="text-xs">
                          {pctFmt(row.variancePct)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-muted/50 font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{fmt(totals.budget)}</td>
                    <td className="px-3 py-2 text-right">{fmt(totals.actual)}</td>
                    <td className={`px-3 py-2 text-right ${varianceColor(totals.variancePct)}`}>
                      {totals.variance >= 0 ? '+' : ''}{fmt(totals.variance)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={varianceBadge(totals.variancePct)}>
                        {pctFmt(totals.variancePct)}
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contingency card */}
      {contingencyBudget > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contingency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Original</p>
                <p className="text-lg font-bold">{fmt(contingencyBudget)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Absorbed by Overspend</p>
                <p className="text-lg font-bold text-amber-500">{fmt(overspend)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className={`text-lg font-bold ${contingencyRemaining === 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {fmt(contingencyRemaining)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
