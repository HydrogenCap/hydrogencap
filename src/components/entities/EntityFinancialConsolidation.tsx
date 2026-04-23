import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntityMonthlySnapshots, useEntityPropertyBreakdown } from '@/hooks/useFinancialSnapshots';
import { useEntityPropertiesV2 } from '@/hooks/usePropertiesV2';
import { useIntercompanyLoans } from '@/hooks/useEntityCompliance';
import { formatGBPDecimal, formatGBPCompact } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { Building2, TrendingUp, TrendingDown, Landmark, PiggyBank } from 'lucide-react';

interface Props {
  entityId: string;
}

export function EntityFinancialConsolidation({ entityId }: Props) {
  const { data: monthlySummary, isLoading: loadingSnapshots } = useEntityMonthlySnapshots(entityId, 12);
  const { data: properties, isLoading: loadingProperties } = useEntityPropertiesV2(entityId);
  const { data: loans } = useIntercompanyLoans(entityId);

  const latest = monthlySummary?.[0];
  const latestMonth = latest?.snapshot_month;
  const { data: propertyBreakdown } = useEntityPropertyBreakdown(entityId, latestMonth);

  // P&L chart data
  const chartData = useMemo(() => {
    if (!monthlySummary) return [];
    return [...monthlySummary]
      .sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month))
      .map(s => ({
        month: format(new Date(s.snapshot_month), 'MMM yy'),
        income: s.total_rent_received,
        costs: Math.abs(s.total_costs),
        noi: s.total_noi,
      }));
  }, [monthlySummary]);

  // Balance sheet summary
  const balanceSheet = useMemo(() => {
    const totalPropertyValue = (properties || []).reduce((sum, p) => sum + (p.current_valuation || p.purchase_price || 0), 0);
    const totalPurchasePrice = (properties || []).reduce((sum, p) => sum + (p.purchase_price || 0), 0);
    const loanBalance = (loans || [])
      .filter(l => l.status === 'active')
      .reduce((sum, l) => {
        if (l.lender_entity_id === entityId) return sum + l.outstanding_balance;
        return sum - l.outstanding_balance;
      }, 0);
    const equity = totalPropertyValue + loanBalance;

    return { totalPropertyValue, totalPurchasePrice, loanBalance, equity, propertyCount: (properties || []).length };
  }, [properties, loans, entityId]);

  // Property performance table
  const propertyRows = useMemo(() => {
    if (!propertyBreakdown || !properties) return [];
    return propertyBreakdown.map(pb => {
      const prop = properties.find(p => p.id === pb.property_id);
      return {
        ...pb,
        address: prop ? `${prop.address_line_1}, ${prop.postcode}` : pb.property_id,
        valuation: prop?.current_valuation || prop?.purchase_price || 0,
      };
    });
  }, [propertyBreakdown, properties]);

  if (loadingSnapshots || loadingProperties) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      {/* Balance Sheet Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Balance Sheet Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={<Building2 className="h-4 w-4" />} label="Property Assets" value={formatGBPCompact(balanceSheet.totalPropertyValue)} sub={`${balanceSheet.propertyCount} properties`} />
            <KPICard icon={<PiggyBank className="h-4 w-4" />} label="Cost Basis" value={formatGBPCompact(balanceSheet.totalPurchasePrice)} sub="Total purchase price" />
            <KPICard icon={<TrendingDown className="h-4 w-4" />} label="Intercompany Net" value={formatGBPCompact(balanceSheet.loanBalance)} sub={balanceSheet.loanBalance >= 0 ? 'Net lender' : 'Net borrower'} variant={balanceSheet.loanBalance >= 0 ? 'positive' : 'negative'} />
            <KPICard icon={<TrendingUp className="h-4 w-4" />} label="Est. Equity" value={formatGBPCompact(balanceSheet.equity)} sub="Assets + IC loans" variant="positive" />
          </div>
        </CardContent>
      </Card>

      {/* P&L Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Entity P&L (Monthly)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatGBPDecimal(v)} />
                  <Legend />
                  <Bar dataKey="income" name="Gross Income" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="costs" name="Total Costs" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="noi" name="NOI" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Property Breakdown */}
      {propertyRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Per-Property Performance {latestMonth && `(${format(new Date(latestMonth), 'MMMM yyyy')})`}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Property</th>
                    <th className="pb-2 font-medium text-right">Valuation</th>
                    <th className="pb-2 font-medium text-right">Gross Rent</th>
                    <th className="pb-2 font-medium text-right">Costs</th>
                    <th className="pb-2 font-medium text-right">NOI</th>
                    <th className="pb-2 font-medium text-right">Cash Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {propertyRows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 font-medium">{row.address}</td>
                      <td className="py-2 text-right">{formatGBPDecimal(row.valuation)}</td>
                      <td className="py-2 text-right">{formatGBPDecimal(row.gross_rent_received)}</td>
                      <td className="py-2 text-right text-red-600">{formatGBPDecimal(row.total_costs)}</td>
                      <td className={cn('py-2 text-right', row.net_operating_income >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {formatGBPDecimal(row.net_operating_income)}
                      </td>
                      <td className={cn('py-2 text-right', row.net_cash_flow >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {formatGBPDecimal(row.net_cash_flow)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {propertyRows.length > 1 && (
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td className="pt-2">Total</td>
                      <td className="pt-2 text-right">{formatGBPDecimal(propertyRows.reduce((s, r) => s + r.valuation, 0))}</td>
                      <td className="pt-2 text-right">{formatGBPDecimal(propertyRows.reduce((s, r) => s + r.gross_rent_received, 0))}</td>
                      <td className="pt-2 text-right text-red-600">{formatGBPDecimal(propertyRows.reduce((s, r) => s + r.total_costs, 0))}</td>
                      <td className="pt-2 text-right">{formatGBPDecimal(propertyRows.reduce((s, r) => s + r.net_operating_income, 0))}</td>
                      <td className="pt-2 text-right">{formatGBPDecimal(propertyRows.reduce((s, r) => s + r.net_cash_flow, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {chartData.length === 0 && propertyRows.length === 0 && balanceSheet.propertyCount === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">No financial data available for consolidation. Assign properties and record financials to see the roll-up.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  sub,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  variant?: 'positive' | 'negative';
}) {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        {icon}
        {label}
      </div>
      <div className={cn('text-xl font-bold', variant === 'positive' && 'text-emerald-600', variant === 'negative' && 'text-red-600')}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
