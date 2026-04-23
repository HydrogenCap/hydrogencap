import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  PiggyBank, 
  TrendingUp, 
  Wallet, 
  Home,
  Users,
} from 'lucide-react';
import { usePropertyAttribution } from '@/hooks/useOwnershipAttribution';
import { useProperty } from '@/hooks/useProperties';
import { ViewModeToggle } from './ViewModeToggle';
import { AttributionKPICard } from './AttributionKPICard';
import { AttributionTable } from './AttributionTable';
import { CalculationExplainer } from './CalculationExplainer';
import { ViewMode, AttributionOwner, AttributionTotals } from './types';

interface FinancialAttributionCardProps {
  propertyId: string;
}

export function FinancialAttributionCard({ propertyId }: FinancialAttributionCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('attributed');
  const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
  const { data: attribution, isLoading: attributionLoading } = usePropertyAttribution(propertyId);

  const isLoading = propertyLoading || attributionLoading;

  // Calculate totals from attribution data
  const totals = useMemo<AttributionTotals>(() => {
    if (!attribution || attribution.length === 0) {
      return { value: 0, equity: 0, debt: 0, rent: 0, noi: 0, cashflow: 0 };
    }
    return attribution.reduce(
      (acc, owner) => ({
        value: acc.value + owner.attributableValue,
        equity: acc.equity + owner.attributableEquity,
        debt: acc.debt + owner.attributableDebt,
        rent: acc.rent + owner.attributableRent,
        noi: acc.noi + owner.attributableNOI,
        cashflow: acc.cashflow + owner.attributableCashflow,
      }),
      { value: 0, equity: 0, debt: 0, rent: 0, noi: 0, cashflow: 0 }
    );
  }, [attribution]);

  // Check if cashflow equals rent (no finance costs)
  const noFinanceCosts = Math.abs(totals.cashflow - totals.rent) < 1;

  // Transform attribution data to typed format
  const attributionData = useMemo<AttributionOwner[]>(() => {
    if (!attribution) return [];
    return attribution.map(a => ({
      ownerId: a.ownerId,
      ownerName: a.ownerName,
      ownerType: a.ownerType,
      effectivePercent: a.effectivePercent,
      pathDescription: a.pathDescription,
      attributableValue: a.attributableValue,
      attributableEquity: a.attributableEquity,
      attributableDebt: a.attributableDebt,
      attributableRent: a.attributableRent,
      attributableNOI: a.attributableNOI,
      attributableCashflow: a.attributableCashflow,
    }));
  }, [attribution]);

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  if (!attribution || attribution.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PiggyBank className="h-5 w-5" />
            Financial Attribution
          </CardTitle>
          <CardDescription>
            Figures shown are ownership-attributed based on current beneficial ownership
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium mb-2">No ownership data available</p>
            <p className="text-sm max-w-md mx-auto">
              Set up legal ownership and company shareholders to see how financial metrics 
              attribute to each beneficial owner.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PiggyBank className="h-5 w-5" />
              Financial Attribution
            </CardTitle>
            <CardDescription className="mt-1">
              Figures shown are ownership-attributed based on current beneficial ownership
            </CardDescription>
          </div>
          <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* KPI Cards - Split into semantic groups */}
        <div className="space-y-4">
          {/* Asset Overview Group */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Asset Overview
            </p>
            <div className="grid grid-cols-2 gap-3">
              <AttributionKPICard
                title="Total Value"
                value={totals.value}
                icon={Home}
                variant="neutral"
                tooltip="Current market value of the property"
              />
              <AttributionKPICard
                title="Total Equity"
                value={totals.equity}
                icon={Wallet}
                variant="neutral"
                tooltip="Property value minus outstanding mortgage balance"
              />
            </div>
          </div>

          {/* Ownership-Attributed Performance Group */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Ownership-Attributed Performance
            </p>
            <div className="grid grid-cols-2 gap-3">
              <AttributionKPICard
                title="Attributed NOI"
                value={totals.rent}
                suffix="/yr"
                icon={TrendingUp}
                variant="positive"
                tooltip="Net Operating Income before finance costs & tax. Calculated as rental income less operating expenses."
                helperText="Based on current ownership structure"
              />
              <AttributionKPICard
                title="Attributed Cashflow"
                value={totals.cashflow}
                suffix="/yr"
                icon={PiggyBank}
                variant={totals.cashflow >= 0 ? 'highlight' : 'negative'}
                tooltip={noFinanceCosts 
                  ? "Distributable cash after all costs. Currently equals NOI as no finance costs are applied."
                  : "Distributable cash after operating costs and finance charges."
                }
                helperText="Based on current ownership structure"
              />
            </div>
          </div>
        </div>

        {/* Attribution Table */}
        <AttributionTable attribution={attributionData} totals={totals} />

        {/* Calculation Explainer */}
        <CalculationExplainer noFinanceCosts={noFinanceCosts} />
      </CardContent>
    </Card>
  );
}
