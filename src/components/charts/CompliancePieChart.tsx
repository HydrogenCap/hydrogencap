import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';
import {
  CHART_SEQUENCE,
  CHART_DEFAULTS,
  CHART_TOOLTIP_STYLE,
} from '@/lib/chart-tokens';
import { ReactNode } from 'react';

interface PieDataItem {
  name: string;
  value: number;
  colour?: string;
}

interface CompliancePieChartProps {
  data: PieDataItem[];
  title: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  headerAction?: ReactNode;
  /** Format tooltip value — defaults to toLocaleString */
  formatValue?: (value: number) => string;
  /** Show labels on slices */
  showLabels?: boolean;
  /** Inner radius for donut variant (0 = full pie) */
  innerRadius?: number;
  outerRadius?: number;
}

export function CompliancePieChart({
  data,
  title,
  subtitle,
  height = 280,
  loading = false,
  emptyMessage,
  headerAction,
  formatValue = (v) => v.toLocaleString(),
  showLabels = true,
  innerRadius = 60,
  outerRadius = 85,
}: CompliancePieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

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
      <div style={{ height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              dataKey="value"
              nameKey="name"
              animationDuration={CHART_DEFAULTS.animationDuration}
              label={
                showLabels
                  ? ({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                  : undefined
              }
              labelLine={showLabels}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.colour ??
                    CHART_SEQUENCE[index % CHART_SEQUENCE.length]
                  }
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatValue(value), '']}
              {...CHART_TOOLTIP_STYLE}
            />
            <Legend
              formatter={(value: string) => {
                const item = data.find((d) => d.name === value);
                return item ? `${value} (${item.value})` : value;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label showing total */}
        {innerRadius > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-xl font-semibold">{formatValue(total)}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        )}
      </div>
    </ChartContainer>
  );
}
