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

  const propertyIds = new Set((entityProperties || []).map((property) => property.id));
  const activeLoans = (loans || []).filter((loan) =>
    loan.entity_id === entityId &&
    propertyIds.has(loan.property_id) &&
    ['active', 'drawdown', 'pending_drawdown'].includes(loan.status)
  );

  const totalValue = (entityProperties || []).reduce((sum, property) => sum + (property.current_valuation || 0), 0);
  const monthlyRent = (entityProperties || []).reduce((sum, property) => {
    if (property.rent_basis === 'whole_house') return sum + (property.whole_house_rent_pcm || 0);
    return sum + (roomSummaries?.get(property.id)?.gross_rent_pcm || 0);
  }, 0);
  const totalDebt = activeLoans.reduce((sum, loan) => sum + (loan.current_balance || 0), 0);
  const monthlyDebtService = activeLoans.reduce((sum, loan) => sum + (loan.monthly_payment || 0), 0);
  const equity = totalValue - totalDebt;
  const ltv = totalValue > 0 ? (totalDebt / totalValue) * 100 : null;
  const grossYield = totalValue > 0 ? ((monthlyRent * 12) / totalValue) * 100 : null;
  const dscr = monthlyDebtService > 0 ? monthlyRent / monthlyDebtService : null;

  const riskLabel = ltv == null
    ? 'Incomplete data'
    : ltv >= 75
      ? 'High leverage'
      : ltv >= 65
        ? 'Watch leverage'
        : 'Healthy leverage';

  const riskVariant = ltv != null && ltv >= 75 ? 'destructive' : 'secondary';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Entity Portfolio</CardTitle>
        <Badge variant={riskVariant}>{riskLabel}</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Properties" value={(entityProperties?.length || 0).toLocaleString()} />
          <Metric label="Value" value={formatGBP(totalValue)} />
          <Metric label="Debt" value={formatGBP(totalDebt)} />
          <Metric label="Equity" value={formatGBP(equity)} tone={equity < 0 ? 'negative' : 'positive'} />
          <Metric label="Monthly Rent" value={formatGBP(monthlyRent)} />
          <Metric label="Monthly Debt" value={formatGBP(monthlyDebtService)} />
          <Metric label="LTV" value={formatPercent(ltv)} tone={ltv != null && ltv >= 75 ? 'negative' : ltv != null && ltv >= 65 ? 'warning' : 'positive'} />
          <Metric label="Gross Yield" value={formatPercent(grossYield)} />
          <Metric label="DSCR" value={formatRatio(dscr)} tone={dscr != null && dscr < 1.25 ? 'negative' : dscr != null && dscr < 1.5 ? 'warning' : 'positive'} />
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
