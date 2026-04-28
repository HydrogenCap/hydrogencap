import { Receipt, Building2, User2, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SA105Box } from './KpiCard';
import { fmt } from '../utils/format';

type Calc = NonNullable<ReturnType<typeof import('@/hooks/useTaxEngine').useTaxCalculation>['data']>;

export function SA105Tab({ calculation }: { calculation: Calc }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          SA105 Property Income Summary
        </CardTitle>
        <CardDescription>UK Self Assessment — SA105 supplementary page values</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="font-semibold text-sm">Portfolio Totals</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <SA105Box label="Box 20 — Total rents" value={fmt(calculation.sa105.totalRents)} />
            <SA105Box label="Box 26-29 — Total allowable" value={fmt(calculation.sa105.totalAllowableExpenses)} />
            <SA105Box label="Box 27 — Finance costs" value={fmt(calculation.sa105.totalFinanceCosts)} />
            <SA105Box label="Box 31 — Adjusted profit" value={fmt(calculation.sa105.totalAdjustedProfit)} />
            <SA105Box label="Box 38 — Basic rate reduction" value={fmt(calculation.sa105.totalBasicRateReduction)} />
          </div>
        </div>

        <Separator />

        <h4 className="font-semibold text-sm">Per-Property Detail</h4>
        {calculation.sa105.lines.map((line) => (
          <div key={line.propertyId} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{line.propertyAddress}</span>
              <Badge variant="outline" className="text-xs ml-auto">
                {line.entityType === 'spv' || line.entityType === 'limited_company' ? (
                  <>
                    <Building2 className="h-3 w-3 mr-1" />
                    SPV
                  </>
                ) : (
                  <>
                    <User2 className="h-3 w-3 mr-1" />
                    Personal
                  </>
                )}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <SA105Box label="Box 20 — Rents" value={fmt(line.box20_totalRents)} />
              <SA105Box label="Box 26 — Repairs" value={fmt(line.box26_repairsMaintenance)} />
              <SA105Box label="Box 27 — Finance" value={fmt(line.box27_financeCosts)} />
              <SA105Box label="Box 28 — Legal/Mgmt" value={fmt(line.box28_legalManagement)} />
              <SA105Box label="Box 29 — Other" value={fmt(line.box29_otherExpenses)} />
              <SA105Box label="Box 30 — Total allowable" value={fmt(line.box30_totalAllowable)} />
              <SA105Box label="Box 31 — Adjusted profit" value={fmt(line.box31_adjustedProfit)} />
              <SA105Box label="Box 38 — 20% reduction" value={fmt(line.box38_basicRateReduction)} />
            </div>
          </div>
        ))}

        {calculation.sa105.lines.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No personally-held properties found for SA105
          </div>
        )}
      </CardContent>
    </Card>
  );
}
