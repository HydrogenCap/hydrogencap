import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, Line } from 'recharts';
import { format } from 'date-fns';
import { formatGBPDecimal } from '@/lib/calculations';
import type { PortfolioMonthlySummary } from '@/lib/financialSnapshotTypes';

interface Props {
  data: PortfolioMonthlySummary[];
}

export function CostBreakdownChart({ data }: Props) {
  const chartData = [...data]
    .sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month))
    .map(d => ({
      month: format(new Date(d.snapshot_month), 'MMM yy'),
      costs: d.total_costs,
      mortgage: d.total_mortgage_payments,
      income: d.total_rent_received,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Income vs Costs</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Income vs Costs</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number, name: string) => [formatGBPDecimal(value), name]}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Area dataKey="costs" name="Operating Costs" stackId="a" fill="hsl(var(--destructive) / 0.3)" stroke="hsl(var(--destructive))" />
            <Area dataKey="mortgage" name="Mortgage" stackId="a" fill="hsl(var(--muted) / 0.5)" stroke="hsl(var(--muted-foreground))" />
            <Line dataKey="income" name="Rent Received" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
