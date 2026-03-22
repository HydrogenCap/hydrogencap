import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';
import { usePropertySnapshots } from '@/hooks/useFinancialSnapshots';
import { formatGBPDecimal } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart as RechartPie, Pie, Cell,
} from 'recharts';
import { SnapshotEntryModal } from './SnapshotEntryModal';
import type { FinancialSnapshot } from '@/lib/financialSnapshotTypes';

interface Props {
  propertyId: string;
  currentValuation: number | null;
}

type SnapshotTableKey =
  | 'gross_rent_received'
  | 'total_costs'
  | 'mortgage_payments'
  | 'net_operating_income'
  | 'net_cash_flow';

const COST_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(220, 70%, 50%)',
  'hsl(45, 80%, 50%)',
  'hsl(160, 60%, 40%)',
  'hsl(280, 60%, 50%)',
];

export function PropertyFinancialSection({ propertyId, currentValuation }: Props) {
  const { data: snapshots, isLoading } = usePropertySnapshots(propertyId, 12);
  const [showEntry, setShowEntry] = useState(false);

  const latest = snapshots?.[0];
  const chartData = useMemo(() => {
    if (!snapshots) return [];
    return [...snapshots]
      .sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month))
      .map(s => ({
        month: format(new Date(s.snapshot_month), 'MMM'),
        noi: s.net_operating_income,
        cashflow: s.net_cash_flow,
      }));
  }, [snapshots]);

  const last6 = useMemo(() => {
    if (!snapshots) return [];
    return [...snapshots].sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month)).slice(-6);
  }, [snapshots]);

  const donutData = useMemo(() => {
    if (!latest) return [];
    return [
      { name: 'Management', value: latest.management_fees },
      { name: 'Maintenance', value: latest.maintenance_costs },
      { name: 'Insurance', value: latest.insurance_costs },
      { name: 'Utilities', value: latest.utilities },
      { name: 'Council Tax', value: latest.council_tax },
      { name: 'Other', value: latest.licensing_costs + latest.professional_fees + latest.other_costs },
    ].filter(d => d.value > 0);
  }, [latest]);

  const trailing12NOI = snapshots?.reduce((s, snap) => s + snap.net_operating_income, 0) || 0;
  const netYield = currentValuation && currentValuation > 0 && trailing12NOI
    ? ((trailing12NOI / currentValuation) * 100).toFixed(1) : null;

  if (isLoading) return <Skeleton className="h-64" />;

  if (!snapshots || snapshots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Financial Performance</CardTitle>
            <Button size="sm" onClick={() => setShowEntry(true)}>
              <BarChart3 className="h-3 w-3 mr-1" /> Enter Figures
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">No financial snapshots yet. Record monthly figures to see performance data.</p>
        </CardContent>
        <SnapshotEntryModal open={showEntry} onOpenChange={setShowEntry} preselectedPropertyId={propertyId} />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <CardTitle>Financial Performance</CardTitle>
              <Badge className={cn('text-xs', latest.net_operating_income >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                NOI: {formatGBPDecimal(latest.net_operating_income)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>12m NOI: <strong className="text-foreground">{formatGBPDecimal(trailing12NOI)}</strong></span>
              {netYield && <span>· Yield: <strong className="text-foreground">{netYield}%</strong></span>}
              <Button size="sm" variant="outline" onClick={() => setShowEntry(true)}>
                <BarChart3 className="h-3 w-3 mr-1" /> Enter Figures
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* NOI Chart */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">12-Month NOI Trend</h4>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `£${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number, n: string) => [formatGBPDecimal(v), n === 'noi' ? 'NOI' : 'Cash Flow']}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="noi" name="NOI" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Line dataKey="cashflow" name="Cash Flow" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Breakdown Table */}
          {last6.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Monthly Breakdown</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-2 py-1 text-left text-muted-foreground"></th>
                      {last6.map(s => (
                        <th key={s.snapshot_month} className="px-2 py-1 text-center text-muted-foreground">
                          {format(new Date(s.snapshot_month), 'MMM')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[ 
                      { label: 'Rent Received', key: 'gross_rent_received' as SnapshotTableKey },
                      { label: 'Total Costs', key: 'total_costs' as SnapshotTableKey },
                      { label: 'Mortgage', key: 'mortgage_payments' as SnapshotTableKey },
                      { label: 'NOI', key: 'net_operating_income' as SnapshotTableKey },
                      { label: 'Cash Flow', key: 'net_cash_flow' as SnapshotTableKey },
                    ].map(row => (
                      <tr key={row.key} className="border-b border-border/50">
                        <td className="px-2 py-1 font-medium text-muted-foreground">{row.label}</td>
                        {last6.map(s => {
                          const val = s[row.key as keyof FinancialSnapshot] as number;
                          const isFinancial = row.key === 'net_operating_income' || row.key === 'net_cash_flow';
                          return (
                            <td key={s.snapshot_month} className={cn('px-2 py-1 text-center',
                              isFinancial && val >= 0 && 'text-emerald-600',
                              isFinancial && val < 0 && 'text-red-600',
                            )}>
                              {formatGBPDecimal(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cost Donut */}
          {donutData.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Cost Breakdown (Current Month)</h4>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <RechartPie>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {donutData.map((_, i) => <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatGBPDecimal(v)} />
                  </RechartPie>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1">
                  {donutData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COST_COLORS[i % COST_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium">{formatGBPDecimal(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <SnapshotEntryModal open={showEntry} onOpenChange={setShowEntry} preselectedPropertyId={propertyId} />
    </>
  );
}
