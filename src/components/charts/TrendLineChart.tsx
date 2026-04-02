import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartContainer } from './ChartContainer';
import {
  CHART_SEQUENCE,
  CHART_DEFAULTS,
  CHART_TOOLTIP_STYLE,
  CHART_AXIS_TICK,
} from '@/lib/chart-tokens';
import { formatGBP } from '@/lib/calculations';
import { ReactNode } from 'react';

interface YKeyConfig {
  key: string;
  label: string;
  colour?: string;
  strokeDasharray?: string;
}

interface TrendLineChartProps<T extends Record<string, unknown>> {
  data: T[];
  xKey: string;
  yKeys: YKeyConfig[];
  title: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  headerAction?: ReactNode;
  /** Format tooltip value — defaults to formatGBP */
  formatValue?: (value: number) => string;
  /** Format x-axis label (e.g. date formatting) */
  formatXLabel?: (value: string) => string;
  showLegend?: boolean;
}

export function TrendLineChart<T extends Record<string, unknown>>({
  data,
  xKey,
  yKeys,
  title,
  subtitle,
  height = 280,
  loading = false,
  emptyMessage,
  headerAction,
  formatValue = formatGBP,
  formatXLabel,
  showLegend = true,
}: TrendLineChartProps<T>) {
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
          <LineChart data={data} margin={CHART_DEFAULTS.margin}>
            <CartesianGrid
              strokeDasharray={CHART_DEFAULTS.gridStrokeDasharray}
              stroke={CHART_DEFAULTS.gridStroke}
            />
            <XAxis
              dataKey={xKey}
              tick={CHART_AXIS_TICK}
              tickLine={CHART_DEFAULTS.tickLine}
              axisLine={CHART_DEFAULTS.axisLine}
              tickFormatter={formatXLabel}
            />
            <YAxis
              tick={CHART_AXIS_TICK}
              tickLine={CHART_DEFAULTS.tickLine}
              axisLine={CHART_DEFAULTS.axisLine}
              tickFormatter={(v) => formatValue(v)}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                const cfg = yKeys.find((y) => y.key === name);
                return [formatValue(value), cfg?.label ?? name];
              }}
              labelFormatter={formatXLabel}
              {...CHART_TOOLTIP_STYLE}
            />
            {showLegend && yKeys.length > 1 && (
              <Legend
                formatter={(value: string) => {
                  const cfg = yKeys.find((y) => y.key === value);
                  return cfg?.label ?? value;
                }}
              />
            )}
            {yKeys.map((yKey, i) => (
              <Line
                key={yKey.key}
                dataKey={yKey.key}
                name={yKey.key}
                stroke={yKey.colour ?? CHART_SEQUENCE[i % CHART_SEQUENCE.length]}
                strokeWidth={2}
                strokeDasharray={yKey.strokeDasharray}
                dot={false}
                animationDuration={CHART_DEFAULTS.animationDuration}
                type="monotone"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
