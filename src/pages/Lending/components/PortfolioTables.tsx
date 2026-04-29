import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  fmtGBP, fmtGBPCompact, fmtDate, getFacilityTypeInfo, getCovenantStatus, getLtvColor,
  type LoanFacilityWithDetails,
} from '@/hooks/useLoanFacilities';

export function RefinanceTimelineCard({ activeFacilities }: { activeFacilities: LoanFacilityWithDetails[] }) {
  if (activeFacilities.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Refinance Timeline</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="pb-2 font-medium">Property</th>
                <th className="pb-2 font-medium">Lender</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Balance</th>
                <th className="pb-2 font-medium text-right">Rate</th>
                <th className="pb-2 font-medium text-right">Rate Expiry</th>
                <th className="pb-2 font-medium text-right">ERC End</th>
                <th className="pb-2 font-medium text-right">Term End</th>
              </tr>
            </thead>
            <tbody>
              {activeFacilities
                .sort((a, b) => new Date(a.term_end_date).getTime() - new Date(b.term_end_date).getTime())
                .map(f => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="py-2">
                      <Link to={`/properties-v2/${f.property_id}`} className="text-primary hover:underline">
                        {f.property_address}
                      </Link>
                    </td>
                    <td className="py-2">{f.lender_name}</td>
                    <td className="py-2"><Badge className={getFacilityTypeInfo(f.facility_type).color}>{getFacilityTypeInfo(f.facility_type).label}</Badge></td>
                    <td className="py-2 text-right font-medium">{fmtGBP(f.current_balance)}</td>
                    <td className="py-2 text-right">{f.interest_rate.toFixed(2)}% <span className="text-xs text-muted-foreground capitalize">{f.rate_type}</span></td>
                    <td className="py-2 text-right">{fmtDate(f.rate_expiry_date)}</td>
                    <td className="py-2 text-right">{fmtDate(f.early_repayment_charge_until)}</td>
                    <td className="py-2 text-right">{fmtDate(f.term_end_date)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function CovenantMonitorCard({ activeFacilities }: { activeFacilities: LoanFacilityWithDetails[] }) {
  const has = activeFacilities.some(f => f.covenant_ltv_max || f.covenant_icr_min || f.early_repayment_charge_until);
  if (!has) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Covenant &amp; ERC Monitor</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="pb-2 font-medium">Property</th>
                <th className="pb-2 font-medium">Lender</th>
                <th className="pb-2 font-medium text-right">Current LTV</th>
                <th className="pb-2 font-medium text-right">LTV Covenant</th>
                <th className="pb-2 font-medium text-right">ERC Until</th>
                <th className="pb-2 font-medium text-right">ERC %</th>
                <th className="pb-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeFacilities
                .filter(f => f.covenant_ltv_max || f.covenant_icr_min || f.early_repayment_charge_until)
                .sort((a, b) => {
                  const order = { breach: 0, warning: 1, ok: 2, unknown: 3 };
                  return order[getCovenantStatus(a)] - order[getCovenantStatus(b)];
                })
                .map(f => {
                  const status = getCovenantStatus(f);
                  const statusConfig = {
                    breach: { label: 'Breach', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
                    warning: { label: 'Warning', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
                    ok: { label: 'OK', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
                    unknown: { label: '—', cls: 'bg-muted text-muted-foreground' },
                  }[status];
                  const rowCls = status === 'breach' ? 'bg-red-50/40 dark:bg-red-950/20' : status === 'warning' ? 'bg-amber-50/40 dark:bg-amber-950/20' : '';
                  return (
                    <tr key={f.id} className={`border-b last:border-0 ${rowCls}`}>
                      <td className="py-2">
                        <Link to={`/properties-v2/${f.property_id}`} className="text-primary hover:underline">{f.property_address}</Link>
                      </td>
                      <td className="py-2">{f.lender_name}</td>
                      <td className={`py-2 text-right font-medium ${getLtvColor(f.current_ltv)}`}>
                        {f.current_ltv != null ? `${f.current_ltv.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2 text-right">
                        {f.covenant_ltv_max != null ? `${f.covenant_ltv_max}%` : '—'}
                      </td>
                      <td className="py-2 text-right">{fmtDate(f.early_repayment_charge_until)}</td>
                      <td className="py-2 text-right">
                        {f.erc_percentage != null ? `${f.erc_percentage}%` : '—'}
                      </td>
                      <td className="py-2 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.cls}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
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
        <div className="grid grid-cols-3 gap-4">
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
