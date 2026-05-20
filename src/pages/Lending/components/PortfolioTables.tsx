import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsiveTable, type ColumnConfig } from '@/components/common';
import {
  fmtGBP, fmtGBPCompact, fmtDate, getFacilityTypeInfo, getCovenantStatus, getLtvColor,
  type LoanFacilityWithDetails,
} from '@/hooks/useLoanFacilities';

export function RefinanceTimelineCard({ activeFacilities }: { activeFacilities: LoanFacilityWithDetails[] }) {
  if (activeFacilities.length === 0) return null;
  const sorted = [...activeFacilities].sort(
    (a, b) => new Date(a.term_end_date).getTime() - new Date(b.term_end_date).getTime()
  );
  const columns: ColumnConfig<LoanFacilityWithDetails>[] = [
    { key: 'property', header: 'Property', render: f => (
      <Link to={`/properties-v2/${f.property_id}`} className="text-primary hover:underline">{f.property_address}</Link>
    ) },
    { key: 'lender', header: 'Lender', render: f => f.lender_name },
    { key: 'type', header: 'Type', render: f => (
      <Badge className={getFacilityTypeInfo(f.facility_type).color}>{getFacilityTypeInfo(f.facility_type).label}</Badge>
    ), hideOnMobile: true },
    { key: 'balance', header: 'Balance', render: f => <span className="font-medium">{fmtGBP(f.current_balance)}</span> },
    { key: 'rate', header: 'Rate', render: f => (
      <span>{f.interest_rate.toFixed(2)}% <span className="text-xs text-muted-foreground capitalize">{f.rate_type}</span></span>
    ) },
    { key: 'rateExpiry', header: 'Rate Expiry', render: f => fmtDate(f.rate_expiry_date), hideOnMobile: true },
    { key: 'ercEnd', header: 'ERC End', render: f => fmtDate(f.early_repayment_charge_until), hideOnMobile: true },
    { key: 'termEnd', header: 'Term End', render: f => fmtDate(f.term_end_date) },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Refinance Timeline</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveTable
          data={sorted}
          columns={columns}
          keyExtractor={f => f.id}
        />
      </CardContent>
    </Card>
  );
}

export function CovenantMonitorCard({ activeFacilities }: { activeFacilities: LoanFacilityWithDetails[] }) {
  const filtered = activeFacilities.filter(
    f => f.covenant_ltv_max || f.covenant_icr_min || f.early_repayment_charge_until
  );
  if (filtered.length === 0) return null;
  const order = { breach: 0, warning: 1, ok: 2, unknown: 3 };
  const sorted = [...filtered].sort((a, b) => order[getCovenantStatus(a)] - order[getCovenantStatus(b)]);

  const statusConfig = {
    breach: { label: 'Breach', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    warning: { label: 'Warning', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    ok: { label: 'OK', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    unknown: { label: '—', cls: 'bg-muted text-muted-foreground' },
  } as const;

  const columns: ColumnConfig<LoanFacilityWithDetails>[] = [
    { key: 'property', header: 'Property', render: f => (
      <Link to={`/properties-v2/${f.property_id}`} className="text-primary hover:underline">{f.property_address}</Link>
    ) },
    { key: 'lender', header: 'Lender', render: f => f.lender_name, hideOnMobile: true },
    { key: 'ltv', header: 'Current LTV', render: f => (
      <span className={`font-medium ${getLtvColor(f.current_ltv)}`}>{f.current_ltv != null ? `${f.current_ltv.toFixed(1)}%` : '—'}</span>
    ) },
    { key: 'covLtv', header: 'LTV Covenant', render: f => f.covenant_ltv_max != null ? `${f.covenant_ltv_max}%` : '—' },
    { key: 'ercUntil', header: 'ERC Until', render: f => fmtDate(f.early_repayment_charge_until), hideOnMobile: true },
    { key: 'ercPct', header: 'ERC %', render: f => f.erc_percentage != null ? `${f.erc_percentage}%` : '—', hideOnMobile: true },
    { key: 'status', header: 'Status', render: f => {
      const s = statusConfig[getCovenantStatus(f)];
      return <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>{s.label}</span>;
    } },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Covenant &amp; ERC Monitor</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveTable
          data={sorted}
          columns={columns}
          keyExtractor={f => f.id}
        />
      </CardContent>
    </Card>
  );
}

export function RateSensitivityCard({
  variableFacilities, variableTotal, totalMonthly, rateImpact1, rateImpact2,
}: {
  variableFacilities: LoanFacilityWithDetails[];
  variableTotal: number;
  totalMonthly: number;
  rateImpact1: number;
  rateImpact2: number;
}) {
  if (variableFacilities.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Rate Sensitivity Analysis</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">Impact of rate changes on variable/tracker facilities ({fmtGBPCompact(variableTotal)} total variable debt)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Current Monthly</p>
            <p className="text-lg font-semibold text-foreground">{fmtGBP(totalMonthly)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">If rates +1%</p>
            <p className="text-lg font-semibold text-foreground">{fmtGBP(totalMonthly + rateImpact1)}</p>
            <p className="text-sm text-red-600">+{fmtGBP(rateImpact1)} /mo</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">If rates +2%</p>
            <p className="text-lg font-semibold text-foreground">{fmtGBP(totalMonthly + rateImpact2)}</p>
            <p className="text-sm text-red-600">+{fmtGBP(rateImpact2)} /mo</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
