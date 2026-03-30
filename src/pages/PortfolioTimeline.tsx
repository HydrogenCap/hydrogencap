import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { usePortfolioValueTimeline } from '@/hooks/useFinancialSnapshots';

type Range = '3M' | '6M' | '1Y' | 'All';

function fmtM(v: number) {
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}m`;
  if (Math.abs(v) >= 1_000) return `£${(v / 1_000).toFixed(0)}k`;
  return `£${v.toFixed(0)}`;
}

export default function PortfolioTimeline() {
  const { data: snapshots = [], isLoading } = usePortfolioValueTimeline(36);
  const [range, setRange] = useState<Range>('1Y');
  const [showValue, setShowValue] = useState(true);
  const [showDebt, setShowDebt] = useState(true);
  const [showEquity, setShowEquity] = useState(true);

  const filtered = useMemo(() => {
    if (range === 'All') return snapshots;
    const months = range === '3M' ? 3 : range === '6M' ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().slice(0, 7);
    return snapshots.filter((s) => s.month >= cutoffStr);
  }, [snapshots, range]);

  const latest = filtered[filtered.length - 1];
  const oldest = filtered[0];
  const valueChange =
    latest && oldest && oldest.totalValuation > 0
      ? ((latest.totalValuation - oldest.totalValuation) / oldest.totalValuation) * 100
      : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Portfolio Performance</h1>
            <p className="text-muted-foreground">Value, debt, and equity over time</p>
          </div>
          <div className="flex gap-1">
            {(['3M', '6M', '1Y', 'All'] as Range[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? 'default' : 'outline'}
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>

        {latest && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Portfolio Value</p>
                <p className="text-xl font-bold">{fmtM(latest.totalValuation)}</p>
                {valueChange !== null && (
                  <p
                    className={`text-xs mt-1 flex items-center gap-1 ${
                      valueChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {valueChange >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {valueChange >= 0 ? '+' : ''}
                    {valueChange.toFixed(1)}% over period
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Debt</p>
                <p className="text-xl font-bold">{fmtM(latest.totalDebt)}</p>
                {latest.ltv !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    LTV {Number(latest.ltv).toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Net Equity</p>
                <p className="text-xl font-bold text-emerald-700">
                  {fmtM(latest.totalEquity)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Portfolio Trend</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={showValue ? 'default' : 'outline'}
                  onClick={() => setShowValue((v) => !v)}
                >
                  Value
                </Button>
                <Button
                  size="sm"
                  variant={showDebt ? 'default' : 'outline'}
                  onClick={() => setShowDebt((v) => !v)}
                >
                  Debt
                </Button>
                <Button
                  size="sm"
                  variant={showEquity ? 'default' : 'outline'}
                  onClick={() => setShowEquity((v) => !v)}
                >
                  Equity
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-16 text-sm">
                No snapshot data yet. Financial snapshots are recorded monthly from the Financials page.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={filtered}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={fmtM}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    width={72}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [fmtM(value), name]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Legend />
                  {showValue && (
                    <Line
                      type="monotone"
                      dataKey="totalValuation"
                      name="Value"
                      stroke="hsl(var(--primary))"
                      dot={false}
                      strokeWidth={2}
                    />
                  )}
                  {showDebt && (
                    <Line
                      type="monotone"
                      dataKey="totalDebt"
                      name="Debt"
                      stroke="hsl(var(--destructive))"
                      dot={false}
                      strokeWidth={2}
                    />
                  )}
                  {showEquity && (
                    <Line
                      type="monotone"
                      dataKey="totalEquity"
                      name="Equity"
                      stroke="#10b981"
                      dot={false}
                      strokeWidth={2}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
