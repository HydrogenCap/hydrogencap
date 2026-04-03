import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, PoundSterling } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useTenantPaymentScore } from '@/hooks/useTenantLifecycle';

// ============================================================
// Traffic Light Thresholds
// ============================================================

type AffordabilityLevel = 'green' | 'amber' | 'red';

function getAffordabilityLevel(ratio: number): AffordabilityLevel {
  if (ratio < 35) return 'green';
  if (ratio <= 50) return 'amber';
  return 'red';
}

const LEVEL_CONFIG: Record<AffordabilityLevel, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  green: { label: 'Affordable', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle },
  amber: { label: 'Stretched', color: 'text-amber-700', bg: 'bg-amber-100', icon: TrendingUp },
  red: { label: 'Unaffordable', color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
};

// ============================================================
// Component
// ============================================================

interface AffordabilityMonitorProps {
  tenantId: string;
  rentPCM: number | null;
  tenantIncome?: number | null;
}

export function AffordabilityMonitor({ tenantId, rentPCM, tenantIncome }: AffordabilityMonitorProps) {
  const { data: paymentData } = useTenantPaymentScore(tenantId);

  const analysis = useMemo(() => {
    const hb = paymentData?.housing_benefit_amount ?? 0;
    const uc = paymentData?.universal_credit ?? 0;
    const totalBenefit = hb + uc;
    const rent = rentPCM ?? 0;
    const income = tenantIncome ?? 0;

    // Net rent after benefits
    const netRentDue = Math.max(0, rent - totalBenefit);

    // Shortfall: if benefits don't cover full rent
    const benefitShortfall = rent > 0 && totalBenefit > 0 ? Math.max(0, rent - totalBenefit) : null;

    // Rent-to-income ratio (use net rent if benefits apply, otherwise gross rent)
    const effectiveRent = totalBenefit > 0 ? netRentDue : rent;
    const ratio = income > 0 ? (effectiveRent / income) * 100 : null;

    const level = ratio !== null ? getAffordabilityLevel(ratio) : null;

    return { hb, uc, totalBenefit, rent, income, netRentDue, benefitShortfall, effectiveRent, ratio, level };
  }, [paymentData, rentPCM, tenantIncome]);

  const config = analysis.level ? LEVEL_CONFIG[analysis.level] : null;
  const Icon = config?.icon ?? PoundSterling;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <PoundSterling className="h-4 w-4" />
          Affordability Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Traffic Light Indicator */}
        {analysis.ratio !== null && config ? (
          <div className="flex items-center gap-3">
            <div className={cn('rounded-full p-2', config.bg)}>
              <Icon className={cn('h-5 w-5', config.color)} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">Rent-to-Income Ratio</span>
                <Badge className={cn(config.bg, config.color)}>{config.label}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Progress
                  value={Math.min(analysis.ratio, 100)}
                  className="flex-1 h-2"
                />
                <span className={cn('text-sm font-bold', config.color)}>
                  {analysis.ratio.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>0%</span>
                <span className="text-emerald-600">35%</span>
                <span className="text-amber-600">50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set tenant income data to calculate affordability ratio.
          </p>
        )}

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2 bg-muted rounded-lg">
            <span className="text-muted-foreground text-xs block">Monthly Rent</span>
            <span className="font-semibold">
              {analysis.rent > 0 ? `£${analysis.rent.toFixed(2)}` : '—'}
            </span>
          </div>
          <div className="p-2 bg-muted rounded-lg">
            <span className="text-muted-foreground text-xs block">Monthly Income</span>
            <span className="font-semibold">
              {analysis.income > 0 ? `£${analysis.income.toFixed(2)}` : '—'}
            </span>
          </div>
          <div className="p-2 bg-muted rounded-lg">
            <span className="text-muted-foreground text-xs block">Housing Benefit</span>
            <span className="font-semibold">
              {analysis.hb > 0 ? `£${analysis.hb.toFixed(2)}` : '—'}
            </span>
          </div>
          <div className="p-2 bg-muted rounded-lg">
            <span className="text-muted-foreground text-xs block">Universal Credit</span>
            <span className="font-semibold">
              {analysis.uc > 0 ? `£${analysis.uc.toFixed(2)}` : '—'}
            </span>
          </div>
        </div>

        {/* Net Rent After Benefits */}
        {analysis.totalBenefit > 0 && (
          <div className="p-3 border rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Benefits</span>
              <span className="font-medium">£{analysis.totalBenefit.toFixed(2)}/month</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Net Rent Due (after benefits)</span>
              <span className="font-bold">£{analysis.netRentDue.toFixed(2)}/month</span>
            </div>
          </div>
        )}

        {/* Benefit Shortfall Alert */}
        {analysis.benefitShortfall !== null && analysis.benefitShortfall > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Housing benefit shortfall of <strong>£{analysis.benefitShortfall.toFixed(2)}/month</strong>.
              The tenant must cover this difference from other income.
            </AlertDescription>
          </Alert>
        )}

        {/* Threshold Legend */}
        <div className="flex gap-3 text-[10px] text-muted-foreground pt-1 border-t">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;35% Affordable
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" /> 35-50% Stretched
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" /> &gt;50% Unaffordable
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
