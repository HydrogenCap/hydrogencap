import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';
import { formatGBPDecimal } from '@/lib/calculations';

interface Props {
  data: { name: string; value: number }[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(220, 70%, 50%)',
  'hsl(45, 80%, 50%)',
  'hsl(160, 60%, 40%)',
  'hsl(280, 60%, 50%)',
];

export function PortfolioCostBreakdown({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Cost Breakdown (Annual)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No cost data yet</p>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Cost Breakdown (Annual)</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatGBPDecimal(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-medium ml-auto">{formatGBPDecimal(d.value)}</span>
                <span className="text-xs text-muted-foreground">({total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%)</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
