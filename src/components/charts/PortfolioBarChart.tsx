import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer } from './ChartContainer';
import {
  CHART_COLOURS,
  CHART_DEFAULTS,
  CHART_TOOLTIP_STYLE,
  CHART_AXIS_TICK,
} from '@/lib/chart-tokens';
import { formatGBP } from '@/lib/calculations';
import { ReactNode } from 'react';

interface PortfolioBarChartProps<T extends Record<string, unknown>> {
  data: T[];
  xKey: string;
  yKey: string;
  title: string;
  subtitle?: string;
  fill?: string;
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  headerAction?: ReactNode;
  /** Format tooltip value — defaults to formatGBP */
  formatValue?: (value: number) => string;
  /** Format x-axis label */
  formatLabel?: (label: string) => string;
}

export function PortfolioBarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  yKey,
  title,
  subtitle,
  fill = CHART_COLOURS.primary,
  height = 280,
  loading = false,
  emptyMessage,
  headerAction,
  formatValue = formatGBP,
  formatLabel,
}: PortfolioBarChartProps<T>) {
  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      loading={loading}
      empty={!loading && data.length === 0}
      emptyMessage={emptyMessage}
      height={height}
      headerAction={headerAction}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_DEFAULTS.margin}>
            <CartesianGrid
              strokeDasharray={CHART_DEFAULTS.gridStrokeDasharray}
              stroke={CHART_DEFAULTS.gridStroke}
            />
            <XAxis
              dataKey={xKey}
              tick={CHART_AXIS_TICK}
              tickLine={CHART_DEFAULTS.tickLine}
              axisLine={CHART_DEFAULTS.axisLine}
              tickFormatter={formatLabel}
            />
            <YAxis
              tick={CHART_AXIS_TICK}
              tickLine={CHART_DEFAULTS.tickLine}
              axisLine={CHART_DEFAULTS.axisLine}
              tickFormatter={(v) => formatValue(v)}
            />
            <Tooltip
              formatter={(value) => [formatValue(value), '']}
              {...CHART_TOOLTIP_STYLE}
            />
            <Bar
              dataKey={yKey}
              fill={fill}
              radius={[4, 4, 0, 0]}
              animationDuration={CHART_DEFAULTS.animationDuration}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
