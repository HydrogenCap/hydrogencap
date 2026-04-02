import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntityMonthlySnapshots, useEntityPropertyBreakdown } from '@/hooks/useFinancialSnapshots';
import { formatGBPDecimal } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
} from 'recharts';
interface EntityPropertyInfo {
  id: string;
  address_line_1: string;
  postcode: string;
}
interface Props {
  entityId: string;
  entityProperties?: EntityPropertyInfo[];
}

export function EntityFinancialSection({ entityId, entityProperties }: Props) {
  const { data: monthlySummary, isLoading } = useEntityMonthlySnapshots(entityId, 12);

  const latest = monthlySummary?.[0];
  const latestMonth = latest?.snapshot_month;

  const { data: propertyBreakdown } = useEntityPropertyBreakdown(entityId, latestMonth);

  const chartData = useMemo(() => {
    if (!monthlySummary) return [];
    return [...monthlySummary]
      .sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month))
      .map(s => ({
        month: format(new Date(s.snapshot_month), 'MMM'),
        noi: s.total_noi,
      }));
  }, [monthlySummary]);

  // Merge property breakdown with property names
  const propertyRows = useMemo(() => {
    if (!propertyBreakdown || !entityProperties) return [];
    return propertyBreakdown.map(pb => {
      const prop = entityProperties.find(p => p.id === pb.property_id);
      return {
        ...pb,
        address: prop ? `${prop.address_line_1}, ${prop.postcode}` : pb.property_id,
      };
    });
  }, [propertyBreakdown, entityProperties]);

  if (isLoading) return <Skeleton className="h-48" />;

  if (!monthlySummary || monthlySummary.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">No financial data yet. Record monthly figures on the Financials page.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Financial Summary</CardTitle>
          {latest && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{format(new Date(latest.snapshot_month), 'MMMM yyyy')}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI row */}
        {latest && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBlock label="Monthly Rent" value={formatGBPDecimal(latest.total_rent_received)} />
            <StatBlock label="Monthly Costs" value={formatGBPDecimal(latest.total_costs)} />
            <StatBlock
              label="Monthly NOI"
              value={formatGBPDecimal(latest.total_noi)}
              variant={latest.total_noi >= 0 ? 'positive' : 'negative'}
            />
            <StatBlock
              label="Monthly Cash Flow"
              value={formatGBPDecimal(latest.total_cash_flow)}
              variant={latest.total_cash_flow >= 0 ? 'positive' : 'negative'}
            />
          </div>
        )}

        {/* Sparkline */}
        {chartData.length > 1 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">12-Month NOI Trend</h4>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="entityNoiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [formatGBPDecimal(v), 'NOI']}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="noi"
                  stroke="hsl(var(--primary))"
                  fill="url(#entityNoiGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Property breakdown table */}
        {propertyRows.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Property Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-2 py-1 text-left text-muted-foreground">Property</th>
                    <th className="px-2 py-1 text-right text-muted-foreground">Rent</th>
                    <th className="px-2 py-1 text-right text-muted-foreground">Costs</th>
                    <th className="px-2 py-1 text-right text-muted-foreground">NOI</th>
                    <th className="px-2 py-1 text-right text-muted-foreground">Cash Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {propertyRows.map(r => (
                    <tr key={r.property_id} className="border-b border-border/50">
                      <td className="px-2 py-1 font-medium">{r.address}</td>
                      <td className="px-2 py-1 text-right">{formatGBPDecimal(r.gross_rent_received)}</td>
                      <td className="px-2 py-1 text-right">{formatGBPDecimal(r.total_costs)}</td>
                      <td className={cn('px-2 py-1 text-right', r.net_operating_income >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {formatGBPDecimal(r.net_operating_income)}
                      </td>
                      <td className={cn('px-2 py-1 text-right', r.net_cash_flow >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {formatGBPDecimal(r.net_cash_flow)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatBlock({ label, value, variant = 'neutral' }: {
  label: string; value: string; variant?: 'neutral' | 'positive' | 'negative';
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-lg font-bold',
        variant === 'positive' && 'text-emerald-600 dark:text-emerald-400',
        variant === 'negative' && 'text-red-600 dark:text-red-400',
        variant === 'neutral' && 'text-foreground',
      )}>{value}</span>
    </div>
  );
}
