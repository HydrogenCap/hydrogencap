import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  usePortfolioDebtSummary,
  useAllLoanFacilities,
  useLoanAlerts,
  fmtGBP,
  fmtGBPCompact,
  fmtDate,
  getLtvColor,
  getFacilityTypeInfo,
  getCovenantStatus,
  type LoanAlert,
  type PortfolioDebtSummary,
} from '@/hooks/useLoanFacilities';
import { LENDER_TYPES } from '@/hooks/useLenders';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, AlertTriangle, TrendingUp, ArrowUpRight } from 'lucide-react';

export default function Lending() {
  const { data: debtSummary = [], isLoading: loadingSummary } = usePortfolioDebtSummary();
  const { data: facilities = [], isLoading: loadingFacilities } = useAllLoanFacilities();
  const { data: alerts = [], isLoading: loadingAlerts } = useLoanAlerts();

  const activeFacilities = facilities.filter(f => f.status === 'active');
  const totalDebt = activeFacilities.reduce((s, f) => s + f.current_balance, 0);
  const weightedRate = totalDebt > 0
    ? activeFacilities.reduce((s, f) => s + f.interest_rate * f.current_balance, 0) / totalDebt
    : 0;
  const totalMonthly = activeFacilities.reduce((s, f) => s + (f.monthly_payment || 0), 0);
  const fixedBalance = activeFacilities.filter(f => f.rate_type === 'fixed').reduce((s, f) => s + f.current_balance, 0);
  const variableBalance = totalDebt - fixedBalance;
  const fixedPct = totalDebt > 0 ? (fixedBalance / totalDebt * 100).toFixed(0) : '0';
  const variablePct = totalDebt > 0 ? (variableBalance / totalDebt * 100).toFixed(0) : '0';

  // Rate sensitivity (variable facilities only)
  const variableFacilities = activeFacilities.filter(f => f.rate_type !== 'fixed');
  const variableTotal = variableFacilities.reduce((s, f) => s + f.current_balance, 0);
  const rateImpact1 = variableTotal * 0.01 / 12;
  const rateImpact2 = variableTotal * 0.02 / 12;

  // Categorise alerts
  const criticalAlerts = alerts.filter(a =>
    a.ltv_covenant_alert === 'covenant_breach' || a.term_alert === 'term_expired' || a.rate_alert === 'rate_expired'
  );
  const warningAlerts = alerts.filter(a =>
    a.rate_alert === 'rate_expiring_soon' || a.term_alert === 'term_ending_soon' || a.term_alert === 'term_ending_within_year' || a.ltv_covenant_alert === 'covenant_warning'
  );
  const opportunityAlerts = alerts.filter(a => a.erc_alert === 'erc_ending_soon');

  const isLoading = loadingSummary || loadingFacilities || loadingAlerts;

  if (isLoading) {
    return <AppLayout><div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Lending</h1>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Debt" value={fmtGBPCompact(totalDebt)} />
          <StatCard title="Weighted Avg Rate" value={`${weightedRate.toFixed(2)}%`} />
          <StatCard title="Monthly Debt Service" value={`${fmtGBP(totalMonthly)} /mo`} />
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Fixed vs Variable</p>
            <div className="flex h-3 rounded overflow-hidden mb-1">
              {totalDebt > 0 && <>
                <div className="bg-blue-500" style={{ width: `${fixedPct}%` }} />
                <div className="bg-orange-400" style={{ width: `${variablePct}%` }} />
              </>}
            </div>
            <p className="text-xs text-muted-foreground">{fmtGBPCompact(fixedBalance)} Fixed ({fixedPct}%) | {fmtGBPCompact(variableBalance)} Variable ({variablePct}%)</p>
          </CardContent></Card>
        </div>

        {/* Lender Exposure */}
        <Card>
          <CardHeader><CardTitle>Lender Exposure</CardTitle></CardHeader>
          <CardContent>
            {debtSummary.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No lenders configured yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="pb-2 font-medium">Lender</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium text-right">Facilities</th>
                      <th className="pb-2 font-medium text-right">Exposure</th>
                      <th className="pb-2 font-medium text-right">% of Debt</th>
                      <th className="pb-2 font-medium text-right">Avg Rate</th>
                      <th className="pb-2 font-medium text-right">Rate Expiry</th>
                      <th className="pb-2 font-medium text-right">Term End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtSummary
                      .sort((a, b) => Number(b.total_exposure) - Number(a.total_exposure))
                      .map(row => {
                        const pct = totalDebt > 0 ? (Number(row.total_exposure) / totalDebt * 100) : 0;
                        const pctColor = pct >= 40 ? 'text-red-600 font-semibold' : pct >= 25 ? 'text-amber-600' : 'text-emerald-600';
                        return (
                          <tr key={row.lender_id} className="border-b last:border-0">
                            <td className="py-2 font-medium text-foreground">{row.lender_name}</td>
                            <td className="py-2"><Badge variant="outline">{LENDER_TYPES.find(t => t.value === row.lender_type)?.label || row.lender_type}</Badge></td>
                            <td className="py-2 text-right">{row.facility_count}</td>
                            <td className="py-2 text-right font-medium">{fmtGBP(Number(row.total_exposure))}</td>
                            <td className={`py-2 text-right ${pctColor}`}>{pct.toFixed(1)}%</td>
                            <td className="py-2 text-right">{Number(row.avg_interest_rate).toFixed(2)}%</td>
                            <td className="py-2 text-right">{fmtDate(row.nearest_rate_expiry)}</td>
                            <td className="py-2 text-right">{fmtDate(row.nearest_term_end)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        {(criticalAlerts.length > 0 || warningAlerts.length > 0 || opportunityAlerts.length > 0) && (
          <Card>
            <CardHeader><CardTitle>Lending Alerts</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {criticalAlerts.length > 0 && <AlertSection title="Critical" alerts={criticalAlerts} icon={AlertCircle} color="text-red-600 dark:text-red-400" bgColor="bg-red-50 dark:bg-red-950/20" />}
              {warningAlerts.length > 0 && <AlertSection title="Warning" alerts={warningAlerts} icon={AlertTriangle} color="text-amber-600 dark:text-amber-400" bgColor="bg-amber-50 dark:bg-amber-950/20" />}
              {opportunityAlerts.length > 0 && <AlertSection title="Opportunities" alerts={opportunityAlerts} icon={TrendingUp} color="text-emerald-600 dark:text-emerald-400" bgColor="bg-emerald-50 dark:bg-emerald-950/20" />}
            </CardContent>
          </Card>
        )}

        {/* Refinance Timeline (table fallback) */}
        {activeFacilities.length > 0 && (
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
        )}

        {/* Covenant & ERC Monitor */}
        {activeFacilities.some(f => f.covenant_ltv_max || f.covenant_icr_min || f.early_repayment_charge_until) && (
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
        )}

        {/* Rate Sensitivity */}
        {variableFacilities.length > 0 && (
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
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function AlertSection({ title, alerts, icon: Icon, color, bgColor }: {
  title: string; alerts: LoanAlert[]; icon: typeof AlertCircle; color: string; bgColor: string;
}) {
  return (
    <div>
      <h3 className={`text-sm font-semibold ${color} mb-2`}>{title}</h3>
      <div className="space-y-1">
        {alerts.map((a, i) => (
          <div key={`${a.loan_id}-${i}`} className={`flex items-start gap-2 px-3 py-2 rounded text-xs ${bgColor} ${color}`}>
            <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="flex-1">
              <Link to={`/properties-v2/${a.property_id}`} className="font-medium hover:underline">{a.property_address}</Link>
              <span className="mx-1">·</span>
              <span>{a.lender_name}</span>
              <span className="mx-1">·</span>
              <span>{getAlertDescription(a)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getAlertDescription(a: LoanAlert): string {
  if (a.ltv_covenant_alert === 'covenant_breach') return `LTV breach: ${a.current_ltv?.toFixed(1)}% vs max ${a.covenant_ltv_max}%`;
  if (a.term_alert === 'term_expired') return 'Loan term expired';
  if (a.rate_alert === 'rate_expired') return `Rate expired, on SVR at ${a.revert_rate || '?'}%`;
  if (a.rate_alert === 'rate_expiring_soon') return `Rate expires in ${a.days_to_rate_expiry}d`;
  if (a.term_alert === 'term_ending_soon') return `Term ends in ${a.days_to_term_end}d`;
  if (a.term_alert === 'term_ending_within_year') return `Term ends within 12 months`;
  if (a.ltv_covenant_alert === 'covenant_warning') return `LTV approaching covenant: ${a.current_ltv?.toFixed(1)}%`;
  if (a.erc_alert === 'erc_ending_soon') return `ERC ends in ${a.days_to_erc_end}d — refinance window`;
  return '';
}
