import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import { formatGBPDecimal } from '@/lib/calculations';

interface Props {
  data: { month: string; income: number; costs: number; cashflow: number; mortgage: number }[];
}

export function PortfolioTrendChart({ data }: Props) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      label: format(new Date(d.month + '-01'), 'MMM yy'),
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">12-Month Portfolio Trend</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">12-Month Portfolio Trend</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v: number, name: string) => [formatGBPDecimal(v), name]}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Line dataKey="income" name="Income" stroke="hsl(160, 60%, 40%)" strokeWidth={2} dot={false} />
            <Line dataKey="costs" name="Costs" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            <Bar dataKey="cashflow" name="Cashflow" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} opacity={0.7} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
