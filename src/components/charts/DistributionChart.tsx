import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
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
import { ReactNode, useMemo } from 'react';

interface DistributionItem {
  label: string;
  value: number;
}

interface DistributionChartProps {
  data: DistributionItem[];
  title: string;
  subtitle?: string;
  fill?: string;
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  headerAction?: ReactNode;
  /** Format tooltip value — defaults to formatGBP */
  formatValue?: (value: number) => string;
  /** Max label width for Y-axis */
  labelWidth?: number;
  /** Max chars before truncation */
  truncateAt?: number;
}

export function DistributionChart({
  data,
  title,
  subtitle,
  fill = CHART_COLOURS.primary,
  height = 220,
  loading = false,
  emptyMessage,
  headerAction,
  formatValue = formatGBP,
  labelWidth = 110,
  truncateAt = 15,
}: DistributionChartProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data],
  );

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
          <BarChart data={sorted} layout="vertical">
            <XAxis type="number" hide />
            <YAxis
              dataKey="label"
              type="category"
              width={labelWidth}
              tick={CHART_AXIS_TICK}
              tickLine={CHART_DEFAULTS.tickLine}
              axisLine={CHART_DEFAULTS.axisLine}
              tickFormatter={(value: string) =>
                value.length > truncateAt
                  ? value.slice(0, truncateAt) + '…'
                  : value
              }
            />
            <Tooltip
              formatter={(value: number) => [formatValue(value), '']}
              {...CHART_TOOLTIP_STYLE}
            />
            <Bar
              dataKey="value"
              fill={fill}
              radius={[0, 4, 4, 0]}
              animationDuration={CHART_DEFAULTS.animationDuration}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
