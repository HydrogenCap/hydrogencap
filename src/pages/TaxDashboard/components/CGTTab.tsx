import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmt, pct } from '../utils/format';

type Calc = NonNullable<ReturnType<typeof import('@/hooks/useTaxEngine').useTaxCalculation>['data']>;

export function CGTTab({ calculation }: { calculation: Calc }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Capital Gains Tax Estimates
          </CardTitle>
          <CardDescription>
            Unrealised gains and estimated CGT on disposal (2025-26 rates: 18% basic / 24% higher)
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {calculation.cgtEstimates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead className="text-right">Current Value</TableHead>
                  <TableHead className="text-right">Unrealised Gain</TableHead>
                  <TableHead className="text-right">Annual Exempt</TableHead>
                  <TableHead className="text-right">Taxable Gain</TableHead>
                  <TableHead className="text-right">CGT Rate</TableHead>
                  <TableHead className="text-right">Estimated CGT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculation.cgtEstimates.map((cgt) => (
                  <TableRow key={cgt.propertyId}>
                    <TableCell className="font-medium max-w-[200px] truncate">{cgt.propertyAddress}</TableCell>
                    <TableCell className="text-right">{fmt(cgt.purchasePrice)}</TableCell>
                    <TableCell className="text-right">{fmt(cgt.currentValue)}</TableCell>
                    <TableCell className="text-right">
                      <span className={cgt.result.gain > 0 ? 'text-green-600' : 'text-destructive'}>
                        {fmt(cgt.result.gain)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{fmt(cgt.result.annualExemptAmount)}</TableCell>
                    <TableCell className="text-right">{fmt(cgt.result.taxableGain)}</TableCell>
                    <TableCell className="text-right">{pct(cgt.result.rate * 100)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(cgt.result.cgt)}</TableCell>
                  </TableRow>
                ))}
                {calculation.cgtEstimates.length > 1 && (
                  <TableRow className="font-semibold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right">{fmt(calculation.cgtEstimates.reduce((s, c) => s + c.result.gain, 0))}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{fmt(calculation.cgtEstimates.reduce((s, c) => s + c.result.taxableGain, 0))}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{fmt(calculation.cgtEstimates.reduce((s, c) => s + c.result.cgt, 0))}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No properties with both purchase price and current valuation data
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">2025-26 CGT Rates — Residential Property</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">Annual exempt amount</span>
              <p className="font-semibold">£3,000</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">Basic rate taxpayer</span>
              <p className="font-semibold">18%</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">Higher/additional rate</span>
              <p className="font-semibold">24%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
