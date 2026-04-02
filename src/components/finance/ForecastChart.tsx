import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatGBP } from '@/lib/calculations';
import {
  CHART_COLOURS,
  CHART_SEMANTIC,
  CHART_DEFAULTS,
  CHART_TOOLTIP_STYLE,
  CHART_AXIS_TICK,
} from '@/lib/chart-tokens';
import type { MonthlyProjection, ForecastScenarios } from '@/hooks/useFinancialForecasts';

interface ForecastChartProps {
  results: MonthlyProjection[];
  scenarios?: ForecastScenarios | null;
  title?: string;
}

export function ForecastChart({ results, scenarios, title = 'Cashflow Projection' }: ForecastChartProps) {
  const chartData = useMemo(() => {
    if (scenarios) {
      return scenarios.base.map((base, i) => ({
        date: base.date,
        base: base.net_cashflow,
        optimistic: scenarios.optimistic[i]?.net_cashflow ?? 0,
        pessimistic: scenarios.pessimistic[i]?.net_cashflow ?? 0,
        baseEquity: base.equity,
        optimisticEquity: scenarios.optimistic[i]?.equity ?? 0,
        pessimisticEquity: scenarios.pessimistic[i]?.equity ?? 0,
      }));
    }

    return results.map((r) => ({
      date: r.date,
      base: r.net_cashflow,
      cumulative: r.cumulative_cashflow,
      equity: r.equity,
    }));
  }, [results, scenarios]);

  // Summary KPIs
  const kpis = useMemo(() => {
    const data = scenarios ? scenarios.base : results;
    if (!data.length) return null;

    const lastMonth = data[data.length - 1];
    const totalCashflow = lastMonth.cumulative_cashflow;
    const endEquity = lastMonth.equity;
    const avgMonthlySurplus = totalCashflow / data.length;

    return { totalCashflow, endEquity, avgMonthlySurplus };
  }, [results, scenarios]);

  if (!results.length && !scenarios) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Run a forecast to see projections</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Summary */}
      {kpis && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total Cashflow</p>
              <p className={`text-lg font-semibold ${kpis.totalCashflow >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatGBP(kpis.totalCashflow)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Equity at End</p>
              <p className="text-lg font-semibold">{formatGBP(kpis.endEquity)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Avg Monthly Surplus</p>
              <p className={`text-lg font-semibold ${kpis.avgMonthlySurplus >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatGBP(kpis.avgMonthlySurplus)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={chartData as any[]} margin={CHART_DEFAULTS.margin}>
              <CartesianGrid
                strokeDasharray={CHART_DEFAULTS.gridStrokeDasharray}
                stroke={CHART_DEFAULTS.gridStroke}
              />
              <XAxis
                dataKey="date"
                tick={CHART_AXIS_TICK}
                tickLine={CHART_DEFAULTS.tickLine}
                axisLine={CHART_DEFAULTS.axisLine}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={CHART_AXIS_TICK}
                tickLine={CHART_DEFAULTS.tickLine}
                axisLine={CHART_DEFAULTS.axisLine}
                tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    base: 'Base Case',
                    optimistic: 'Optimistic',
                    pessimistic: 'Pessimistic',
                    cumulative: 'Cumulative',
                    equity: 'Equity',
                  };
                  return [formatGBP(value), labels[name] || name];
                }}
                {...CHART_TOOLTIP_STYLE}
              />

              {scenarios ? (
                <>
                  {/* Shaded confidence band between pessimistic and optimistic */}
                  <Area
                    dataKey="optimistic"
                    stroke="none"
                    fill={CHART_SEMANTIC.positive}
                    fillOpacity={0.1}
                    type="monotone"
                  />
                  <Area
                    dataKey="pessimistic"
                    stroke="none"
                    fill="hsl(var(--background))"
                    fillOpacity={1}
                    type="monotone"
                  />
                  {/* Lines on top */}
                  <Line
                    dataKey="optimistic"
                    stroke={CHART_SEMANTIC.positive}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    name="optimistic"
                    type="monotone"
                  />
                  <Line
                    dataKey="pessimistic"
                    stroke={CHART_SEMANTIC.negative}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    name="pessimistic"
                    type="monotone"
                  />
                  <Line
                    dataKey="base"
                    stroke={CHART_COLOURS.primary}
                    strokeWidth={2.5}
                    dot={false}
                    name="base"
                    type="monotone"
                  />
                </>
              ) : (
                <>
                  <Area
                    dataKey="base"
                    stroke={CHART_COLOURS.primary}
                    fill={CHART_COLOURS.primary}
                    fillOpacity={0.08}
                    strokeWidth={2}
                    dot={false}
                    name="base"
                    type="monotone"
                  />
                  <Line
                    dataKey="cumulative"
                    stroke={CHART_COLOURS.tertiary}
                    strokeWidth={2}
                    dot={false}
                    name="cumulative"
                    type="monotone"
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {scenarios && (
            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: CHART_COLOURS.primary }} />
                Base Case
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded border-b border-dashed" style={{ borderColor: CHART_SEMANTIC.positive }} />
                Optimistic
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded border-b border-dashed" style={{ borderColor: CHART_SEMANTIC.negative }} />
                Pessimistic
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
