import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAllLoanFacilities } from '@/hooks/useLoanFacilities';
import { usePropertyRoomSummaries } from '@/hooks/useRoomsV2';
import type { PropertyV2 } from '@/hooks/usePropertiesV2';

interface EntityPortfolioSummaryCardProps {
  entityId: string;
  entityProperties?: PropertyV2[];
}

function formatGBP(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function formatRatio(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}x`;
}

export function EntityPortfolioSummaryCard({ entityId, entityProperties }: EntityPortfolioSummaryCardProps) {
  const { data: loans } = useAllLoanFacilities();
  const { data: roomSummaries } = usePropertyRoomSummaries();
  const properties = entityProperties || [];

  const metrics = useMemo(() => {
    const propertyIds = new Set(properties.map((property) => property.id));
    const activeLoans = (loans || []).filter((loan) =>
      loan.entity_id === entityId &&
      propertyIds.has(loan.property_id) &&
      ['active', 'drawdown', 'pending_drawdown'].includes(loan.status)
    );

    const totalValue = properties.reduce((sum, property) => sum + (property.current_valuation || 0), 0);
    const monthlyRent = properties.reduce((sum, property) => {
      if (property.rent_basis === 'whole_house') return sum + (property.whole_house_rent_pcm || 0);
      return sum + (roomSummaries?.get(property.id)?.gross_rent_pcm || 0);
    }, 0);
    const totalDebt = activeLoans.reduce((sum, loan) => sum + (loan.current_balance || 0), 0);
    const monthlyDebtService = activeLoans.reduce((sum, loan) => sum + (loan.monthly_payment || 0), 0);
    const equity = totalValue - totalDebt;
    const ltv = totalValue > 0 ? (totalDebt / totalValue) * 100 : null;
    const grossYield = totalValue > 0 ? ((monthlyRent * 12) / totalValue) * 100 : null;
    const dscr = monthlyDebtService > 0 ? monthlyRent / monthlyDebtService : null;

    return { totalValue, monthlyRent, totalDebt, monthlyDebtService, equity, ltv, grossYield, dscr };
  }, [entityId, loans, properties, roomSummaries]);

  const riskLabel = metrics.ltv == null
    ? 'Incomplete data'
    : metrics.ltv >= 75
      ? 'High leverage'
      : metrics.ltv >= 65
        ? 'Watch leverage'
        : 'Healthy leverage';

  const riskVariant = metrics.ltv != null && metrics.ltv >= 75 ? 'destructive' : 'secondary';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Entity Portfolio</CardTitle>
        <Badge variant={riskVariant}>{riskLabel}</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Properties" value={properties.length.toLocaleString()} />
          <Metric label="Value" value={formatGBP(metrics.totalValue)} />
          <Metric label="Debt" value={formatGBP(metrics.totalDebt)} />
          <Metric label="Equity" value={formatGBP(metrics.equity)} tone={metrics.equity < 0 ? 'negative' : 'positive'} />
          <Metric label="Monthly Rent" value={formatGBP(metrics.monthlyRent)} />
          <Metric label="Monthly Debt" value={formatGBP(metrics.monthlyDebtService)} />
          <Metric label="LTV" value={formatPercent(metrics.ltv)} tone={metrics.ltv != null && metrics.ltv >= 75 ? 'negative' : metrics.ltv != null && metrics.ltv >= 65 ? 'warning' : 'positive'} />
          <Metric label="Gross Yield" value={formatPercent(metrics.grossYield)} />
          <Metric label="DSCR" value={formatRatio(metrics.dscr)} tone={metrics.dscr != null && metrics.dscr < 1.25 ? 'negative' : metrics.dscr != null && metrics.dscr < 1.5 ? 'warning' : 'positive'} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'positive' | 'warning' | 'negative' }) {
  const toneClass = {
    neutral: 'text-foreground',
    positive: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    negative: 'text-red-600 dark:text-red-400',
  }[tone];

  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
