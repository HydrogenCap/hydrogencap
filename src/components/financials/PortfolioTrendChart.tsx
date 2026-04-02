import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import { formatGBPDecimal } from '@/lib/calculations';
import { ChartContainer } from '@/components/charts';
import {
  CHART_COLOURS,
  CHART_SEMANTIC,
  CHART_DEFAULTS,
  CHART_TOOLTIP_STYLE,
  CHART_AXIS_TICK,
} from '@/lib/chart-tokens';

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

  return (
    <ChartContainer
      title="12-Month Portfolio Trend"
      empty={chartData.length === 0}
      emptyMessage="Add properties with financial data to see portfolio trends"
      height={300}
    >
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={CHART_DEFAULTS.margin}>
            <CartesianGrid
              strokeDasharray={CHART_DEFAULTS.gridStrokeDasharray}
              stroke={CHART_DEFAULTS.gridStroke}
            />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis
              tick={CHART_AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `£${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(v: number, name: string) => [formatGBPDecimal(v), name]}
              {...CHART_TOOLTIP_STYLE}
            />
            <Line
              dataKey="income"
              name="Income"
              stroke={CHART_SEMANTIC.positive}
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="costs"
              name="Costs"
              stroke={CHART_SEMANTIC.negative}
              strokeWidth={2}
              dot={false}
            />
            <Bar
              dataKey="cashflow"
              name="Cashflow"
              fill={CHART_COLOURS.primary}
              radius={[3, 3, 0, 0]}
              opacity={0.7}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
