import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceDot,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useValuationHistory } from '@/hooks/useValuationEvidence';
import {
  CHART_COLOURS, CHART_DEFAULTS, CHART_TOOLTIP_STYLE, CHART_AXIS_TICK, CHART_SEMANTIC,
} from '@/lib/chart-tokens';

interface ValuationHistoryChartProps {
  propertyId: string;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
}

function fmtGBP(v: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
}

function fmtGBPCompact(v: number) {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1_000) return `£${(v / 1_000).toFixed(0)}k`;
  return `£${v}`;
}

export function ValuationHistoryChart({ propertyId, purchasePrice, purchaseDate }: ValuationHistoryChartProps) {
  const { data: history, isLoading } = useValuationHistory(propertyId);

  const chartData = useMemo(() => {
    const points: { date: string; dateLabel: string; value: number; label?: string }[] = [];

    // Add purchase point if available
    if (purchasePrice && purchaseDate) {
      points.push({
        date: purchaseDate,
        dateLabel: format(new Date(purchaseDate), 'MMM yyyy'),
        value: purchasePrice,
        label: 'Purchase',
      });
    }

    // Add valuation points
    for (const v of history ?? []) {
      points.push({
        date: v.valuation_date,
        dateLabel: format(new Date(v.valuation_date), 'MMM yyyy'),
        value: v.value,
        label: v.valuation_type === 'rics_red_book'
          ? 'RICS Red Book'
          : v.valuation_type === 'full_inspection'
            ? 'Full Inspection'
            : undefined,
      });
    }

    points.sort((a, b) => a.date.localeCompare(b.date));
    return points;
  }, [history, purchasePrice, purchaseDate]);

  const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : null;
  const changeFromPurchase = purchasePrice && latestValue
    ? ((latestValue - purchasePrice) / purchasePrice) * 100
    : null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Valuation History</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-[280px]" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Valuation History</CardTitle>
            <CardDescription>
              {chartData.length} valuation{chartData.length !== 1 ? 's' : ''} recorded
            </CardDescription>
          </div>
          {latestValue != null && (
            <div className="text-right">
              <p className="text-lg font-bold">{fmtGBP(latestValue)}</p>
              {changeFromPurchase != null && (
                <div className="flex items-center gap-1 justify-end">
                  {changeFromPurchase >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${changeFromPurchase >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {changeFromPurchase >= 0 ? '+' : ''}{changeFromPurchase.toFixed(1)}% from purchase
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">No valuation history recorded yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={CHART_DEFAULTS.margin}>
              <CartesianGrid
                strokeDasharray={CHART_DEFAULTS.gridStrokeDasharray}
                stroke={CHART_DEFAULTS.gridStroke}
              />
              <XAxis
                dataKey="dateLabel"
                tick={CHART_AXIS_TICK}
                tickLine={CHART_DEFAULTS.tickLine}
                axisLine={CHART_DEFAULTS.axisLine}
              />
              <YAxis
                tick={CHART_AXIS_TICK}
                tickLine={CHART_DEFAULTS.tickLine}
                axisLine={CHART_DEFAULTS.axisLine}
                tickFormatter={(v) => fmtGBPCompact(v)}
                width={60}
              />
              <Tooltip
                {...CHART_TOOLTIP_STYLE}
                formatter={(value) => [fmtGBP(value), 'Value']}
                labelFormatter={(label) => label}
              />
              {/* Purchase price reference line */}
              {purchasePrice && (
                <ReferenceLine
                  y={purchasePrice}
                  stroke={CHART_SEMANTIC.baseline}
                  strokeDasharray="6 3"
                  label={{ value: `Purchase: ${fmtGBPCompact(purchasePrice)}`, position: 'right', fill: CHART_SEMANTIC.neutral, fontSize: 11 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={CHART_COLOURS.primary}
                strokeWidth={2}
                dot={{ r: 4, fill: CHART_COLOURS.primary, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: CHART_COLOURS.primary }}
                animationDuration={CHART_DEFAULTS.animationDuration}
              />
              {/* Annotate key events */}
              {chartData
                .filter((p) => p.label)
                .map((p, i) => (
                  <ReferenceDot
                    key={i}
                    x={p.dateLabel}
                    y={p.value}
                    r={6}
                    fill={p.label === 'Purchase' ? CHART_SEMANTIC.neutral : CHART_COLOURS.secondary}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
