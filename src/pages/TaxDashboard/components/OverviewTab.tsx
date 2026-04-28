import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fmt, pct } from '../utils/format';

type Calc = NonNullable<ReturnType<typeof import('@/hooks/useTaxEngine').useTaxCalculation>['data']>;

export function OverviewTab({
  calculation,
  s24ChartData,
  s24Additional,
}: {
  calculation: Calc;
  s24ChartData: Array<{ name: string; tax: number; fill: string }>;
  s24Additional: number;
}) {
  return (
    <>
      <div className="space-y-6">
        {calculation.section24Impact.financeCredit > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartContainer title="Section 24 Impact" subtitle="Old system vs current rules — additional tax burden">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={s24ChartData} barGap={20}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} className="fill-muted-foreground" tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [fmt(value as number), 'Tax']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="tax" radius={[6, 6, 0, 0]} maxBarSize={80}>
                    {s24ChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            <Card className="border-amber-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Section 24 Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total finance costs</span>
                    <p className="font-semibold">{fmt(calculation.sa105.totalFinanceCosts)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">20% tax credit</span>
                    <p className="font-semibold text-primary">-{fmt(calculation.section24Impact.financeCredit)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tax under old rules</span>
                    <p className="font-semibold">{fmt(calculation.section24Impact.oldSystemTax)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tax under Section 24</span>
                    <p className="font-semibold">{fmt(calculation.section24Impact.newSystemTax)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Additional tax due to S24</span>
                    <p className="font-semibold text-destructive">{fmt(s24Additional)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Effective rate (new)</span>
                    <p className="font-semibold">{pct(calculation.section24Impact.effectiveRate)}</p>
                  </div>
                </div>
                {s24Additional > 0 && (
                  <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    Consider: SPV structures could reduce this impact for higher-rate taxpayers.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Per-Property Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Gross Rent</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Finance Costs</TableHead>
                  <TableHead className="text-right">Net Income</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculation.perPropertyTax.map((p) => (
                  <TableRow key={p.propertyId}>
                    <TableCell className="font-medium max-w-[220px] truncate">{p.propertyAddress}</TableCell>
                    <TableCell className="text-right">{fmt(p.grossRent)}</TableCell>
                    <TableCell className="text-right">{fmt(p.allowableExpenses)}</TableCell>
                    <TableCell className="text-right">{fmt(p.financeCosts)}</TableCell>
                    <TableCell className="text-right">{fmt(p.netIncome)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(p.taxLiability)}</TableCell>
                  </TableRow>
                ))}
                {calculation.perPropertyTax.length > 1 && (
                  <TableRow className="font-semibold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{fmt(calculation.perPropertyTax.reduce((s, p) => s + p.grossRent, 0))}</TableCell>
                    <TableCell className="text-right">{fmt(calculation.perPropertyTax.reduce((s, p) => s + p.allowableExpenses, 0))}</TableCell>
                    <TableCell className="text-right">{fmt(calculation.perPropertyTax.reduce((s, p) => s + p.financeCosts, 0))}</TableCell>
                    <TableCell className="text-right">{fmt(calculation.totalPropertyIncome)}</TableCell>
                    <TableCell className="text-right">{fmt(calculation.totalTaxLiability)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
