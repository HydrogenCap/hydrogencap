import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatGBPDecimal, formatGBPCompact, formatPercent } from '@/lib/calculations';
import { usePropertyPnL } from '@/hooks/usePropertyPnL';
import { format } from 'date-fns';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart as RechartPie, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

interface Props {
  propertyId: string;
}

const COST_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(220, 70%, 50%)',
  'hsl(45, 80%, 50%)',
  'hsl(160, 60%, 40%)',
  'hsl(280, 60%, 50%)',
];

export function PropertyPnLCard({ propertyId }: Props) {
  const { data: pnl, isLoading } = usePropertyPnL(propertyId);

  const chartData = useMemo(() => {
    if (!pnl) return [];
    return pnl.months.map(m => ({
      month: format(new Date(m.month + '-01'), 'MMM'),
      income: m.grossIncome,
      costs: m.maintenance + m.managementFees + m.otherCosts + m.insurance + m.compliance,
      cashflow: m.netCashflow,
    }));
  }, [pnl]);

  const donutData = useMemo(() => {
    if (!pnl) return [];
    const totals = pnl.months.reduce(
      (acc, m) => ({
        mortgage: acc.mortgage + m.mortgagePayment,
        maintenance: acc.maintenance + m.maintenance,
        management: acc.management + m.managementFees,
        capex: acc.capex + m.otherCosts,
        insurance: acc.insurance + m.insurance,
        compliance: acc.compliance + m.compliance,
      }),
      { mortgage: 0, maintenance: 0, management: 0, capex: 0, insurance: 0, compliance: 0 }
    );
    return [
      { name: 'Mortgage', value: totals.mortgage },
      { name: 'Maintenance', value: totals.maintenance },
      { name: 'Management', value: totals.management },
      { name: 'CapEx', value: totals.capex },
      { name: 'Insurance', value: totals.insurance },
      { name: 'Compliance', value: totals.compliance },
    ].filter(d => d.value > 0);
  }, [pnl]);

  if (isLoading) return <Skeleton className="h-64" />;

  if (!pnl || pnl.annualGrossIncome === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Profit & Loss (Live)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">
            No rent data yet — add tenancies and record payments to see your P&L.
          </p>
        </CardContent>
      </Card>
    );
  }

  const avgMonthlyIncome = pnl.annualGrossIncome / 12;
  const avgMonthlyCosts = pnl.annualCosts / 12;
  const avgMonthlyNOI = pnl.annualNOI / 12;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Profit & Loss (Live)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatMini label="Monthly Income" value={formatGBPDecimal(avgMonthlyIncome)} positive />
          <StatMini label="Monthly Costs" value={formatGBPDecimal(avgMonthlyCosts)} negative />
          <StatMini label="NOI" value={formatGBPDecimal(avgMonthlyNOI)} positive={avgMonthlyNOI >= 0} negative={avgMonthlyNOI < 0} />
          <StatMini label="Net Yield" value={formatPercent(pnl.netYield)} positive={pnl.netYield >= 0} negative={pnl.netYield < 0} />
        </div>

        {/* 12-Month Trend Chart */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">12-Month Trend</h4>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number, name: string) => [formatGBPDecimal(v), name]}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              />
              <Line dataKey="income" name="Income" stroke="hsl(160, 60%, 40%)" strokeWidth={2} dot={false} />
              <Line dataKey="costs" name="Costs" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              <Bar dataKey="cashflow" name="Cashflow" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} opacity={0.7} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Breakdown + Yield Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cost Donut */}
          {donutData.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Annual Cost Breakdown</h4>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <RechartPie>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60} paddingAngle={2}>
                      {donutData.map((_, i) => <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatGBPCompact(v)} />
                  </RechartPie>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5">
                  {donutData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COST_COLORS[i % COST_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium">{formatGBPCompact(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Yield Summary */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Yield Summary</h4>
            <div className="space-y-3">
              <YieldRow label="Gross Yield" value={formatPercent(pnl.grossYield)} hint="Annual rent ÷ valuation" />
              <YieldRow label="Net Yield" value={formatPercent(pnl.netYield)} hint="Annual NOI ÷ valuation" />
              <YieldRow label="LTV" value={formatPercent(pnl.ltv)} hint="Debt ÷ valuation" />
              <div className="border-t border-border pt-2 mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Equity</span>
                <span className="font-semibold">{formatGBPCompact(pnl.equity)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatMini({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  return (
    <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>

      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', positive && 'text-primary', negative && 'text-destructive')} />
        <span className={cn('text-lg font-semibold', positive && 'text-primary', negative && 'text-destructive')}>
          {value}
        </span>
      </div>
    </div>
  );
}

function YieldRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <div>
        <span className="text-foreground font-medium">{label}</span>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
