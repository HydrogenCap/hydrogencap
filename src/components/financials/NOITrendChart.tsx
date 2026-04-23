import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { format } from 'date-fns';
import { formatGBPDecimal } from '@/lib/calculations';
import type { PortfolioMonthlySummary } from '@/lib/financialSnapshotTypes';

interface Props {
  data: PortfolioMonthlySummary[];
}

export function NOITrendChart({ data }: Props) {
  const chartData = [...data]
    .sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month))
    .map(d => ({
      month: format(new Date(d.snapshot_month), 'MMM yy'),
      noi: d.total_noi,
      cashflow: d.total_cash_flow,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly NOI Trend</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Monthly NOI Trend</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => [formatGBPDecimal(value), name === 'noi' ? 'NOI' : 'Cash Flow']}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar dataKey="noi" name="NOI" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Line dataKey="cashflow" name="Cash Flow" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
