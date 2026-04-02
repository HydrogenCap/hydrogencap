import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Edit, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import {
  type LoanFacilityWithDetails,
  type LoanAlert,
  getFacilityTypeInfo,
  getFacilityBorderColor,
  STATUS_COLORS,
  REPAYMENT_TYPES,
  getLtvColor,
  fmtGBP,
  fmtDate,
  daysColor,
} from '@/hooks/useLoanFacilities';

interface LoanFacilityCardProps {
  facility: LoanFacilityWithDetails;
  alerts?: LoanAlert[];
  onEdit: (facility: LoanFacilityWithDetails) => void;
  onRedeem: (id: string) => void;
}

export function LoanFacilityCard({ facility, alerts = [], onEdit, onRedeem }: LoanFacilityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = getFacilityTypeInfo(facility.facility_type);
  const borderColor = getFacilityBorderColor(facility.facility_type);
  const statusColor = STATUS_COLORS[facility.status] || 'bg-muted text-muted-foreground';

  const facilityAlerts = alerts.filter(a => a.loan_id === facility.id);
  const alertBanners = getAlertBanners(facilityAlerts);

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{facility.lender_name}</span>
            <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
            <Badge className={statusColor}>{facility.status.replace('_', ' ')}</Badge>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCell label="Balance" value={fmtGBP(facility.current_balance)} />
          <MetricCell label="Rate" value={
            <span>{facility.interest_rate.toFixed(2)}% <span className="text-xs text-muted-foreground capitalize">{facility.rate_type}</span></span>
          } />
          <MetricCell label="LTV" value={
            facility.current_ltv != null
              ? <span className={getLtvColor(facility.current_ltv)}>{facility.current_ltv.toFixed(1)}%</span>
              : '—'
          } />
          <MetricCell label="Monthly Payment" value={fmtGBP(facility.monthly_payment)} />
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <TimelineItem
            label="Rate Expiry"
            date={facility.rate_expiry_date}
            days={facilityAlerts[0]?.days_to_rate_expiry ?? null}
            thresholds={{ green: 90, amber: 30 }}
            fallback="No fixed rate"
          />
          <TimelineItem
            label="ERC End"
            date={facility.early_repayment_charge_until}
            days={facilityAlerts[0]?.days_to_erc_end ?? null}
            thresholds={{ green: 0, amber: 90 }}
            fallback="No ERC"
            invertColor
          />
          <TimelineItem
            label="Term End"
            date={facility.term_end_date}
            days={facilityAlerts[0]?.days_to_term_end ?? null}
            thresholds={{ green: 365, amber: 180 }}
          />
        </div>

        {/* Expandable details */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
              <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Hide' : 'Show'} Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <DetailRow label="Repayment Type" value={REPAYMENT_TYPES.find(r => r.value === facility.repayment_type)?.label || facility.repayment_type} />
              <DetailRow label="Original Amount" value={fmtGBP(facility.original_amount)} />
              <DetailRow label="LTV at Drawdown" value={facility.ltv_at_drawdown ? `${facility.ltv_at_drawdown}%` : '—'} />
              <DetailRow label="Product Name" value={facility.product_name || '—'} />
              <DetailRow label="Account Ref" value={facility.account_reference || '—'} />
              <DetailRow label="Borrowing Entity" value={facility.entity_name || '—'} />
              {facility.arrangement_fee && <DetailRow label="Arrangement Fee" value={fmtGBP(facility.arrangement_fee)} />}
              {facility.valuation_fee && <DetailRow label="Valuation Fee" value={fmtGBP(facility.valuation_fee)} />}
              {facility.legal_fee && <DetailRow label="Legal Fee" value={fmtGBP(facility.legal_fee)} />}
              {facility.total_setup_costs && <DetailRow label="Total Setup Costs" value={fmtGBP(facility.total_setup_costs)} />}
              {facility.covenant_ltv_max && <DetailRow label="Covenant Max LTV" value={`${facility.covenant_ltv_max}% (current: ${facility.current_ltv?.toFixed(1) || '?'}%)`} />}
              {facility.covenant_icr_min && <DetailRow label="Covenant Min ICR" value={`${facility.covenant_icr_min}x`} />}
              {facility.revert_rate && <DetailRow label="Revert Rate (SVR)" value={`${facility.revert_rate}%`} />}
              {facility.erc_percentage && <DetailRow label="ERC Percentage" value={`${facility.erc_percentage}%`} />}
            </div>
            {facility.notes && <p className="text-sm text-muted-foreground mt-2">{facility.notes}</p>}
          </CollapsibleContent>
        </Collapsible>

        {/* Alert Banners */}
        {alertBanners.length > 0 && (
          <div className="space-y-1">
            {alertBanners.map((alert, i) => (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded text-xs ${alert.bgColor}`}>
                <alert.icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={() => onEdit(facility)}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
          {facility.status === 'active' && (
            <Button variant="ghost" size="sm" onClick={() => onRedeem(facility.id)}>
              <CheckCircle className="h-3 w-3 mr-1" /> Mark Redeemed
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function TimelineItem({ label, date, days, thresholds, fallback, invertColor }: {
  label: string; date: string | null; days: number | null;
  thresholds: { green: number; amber: number }; fallback?: string; invertColor?: boolean;
}) {
  if (!date) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">{label}</p>
        <p className="text-muted-foreground/60">{fallback || '—'}</p>
      </div>
    );
  }
  const color = invertColor
    ? (days != null && days <= 0 ? 'text-emerald-600' : days != null && days < thresholds.amber ? 'text-amber-600' : 'text-red-600')
    : daysColor(days, thresholds);

  return (
    <div className="text-center">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{fmtDate(date)}</p>
      {days != null && <p className={color}>{days <= 0 ? 'Passed' : `${days}d`}</p>}
    </div>
  );
}

interface AlertBanner { icon: typeof AlertTriangle; message: string; bgColor: string; }

function getAlertBanners(alerts: LoanAlert[]): AlertBanner[] {
  if (alerts.length === 0) return [];
  const a = alerts[0];
  const banners: AlertBanner[] = [];

  if (a.rate_alert === 'rate_expired') banners.push({ icon: AlertCircle, message: `Fixed rate has expired. Now on SVR at ${a.revert_rate || '?'}%. Review refinance options.`, bgColor: 'bg-red-50 text-red-700' });
  if (a.rate_alert === 'rate_expiring_soon') banners.push({ icon: AlertTriangle, message: `Fixed rate expires in ${a.days_to_rate_expiry}d (${fmtDate(a.rate_expiry_date)}). Begin product transfer or remortgage process.`, bgColor: 'bg-amber-50 text-amber-700' });
  if (a.term_alert === 'term_expired') banners.push({ icon: AlertCircle, message: `Loan term has expired. Refinance required.`, bgColor: 'bg-red-50 text-red-700' });
  if (a.term_alert === 'term_ending_soon') banners.push({ icon: AlertCircle, message: `Loan term ends in ${a.days_to_term_end}d. Refinance required.`, bgColor: 'bg-red-50 text-red-700' });
  if (a.term_alert === 'term_ending_within_year') banners.push({ icon: AlertTriangle, message: `Loan term ends within 12 months. Plan refinance.`, bgColor: 'bg-amber-50 text-amber-700' });
  if (a.erc_alert === 'erc_ending_soon') banners.push({ icon: Info, message: `ERC period ends in ${a.days_to_erc_end}d. Refinance window approaching.`, bgColor: 'bg-emerald-50 text-emerald-700' });
  if (a.ltv_covenant_alert === 'covenant_breach') banners.push({ icon: AlertCircle, message: `LTV COVENANT BREACH. Current ${a.current_ltv?.toFixed(1)}% exceeds max ${a.covenant_ltv_max}%. Contact lender immediately.`, bgColor: 'bg-red-100 text-red-800' });
  if (a.ltv_covenant_alert === 'covenant_warning') banners.push({ icon: AlertTriangle, message: `LTV approaching covenant limit. Current ${a.current_ltv?.toFixed(1)}% vs max ${a.covenant_ltv_max}%.`, bgColor: 'bg-amber-50 text-amber-700' });

  return banners;
}
