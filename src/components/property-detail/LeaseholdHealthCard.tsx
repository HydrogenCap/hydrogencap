import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Building, Calendar, PoundSterling, ShieldAlert, TrendingUp } from 'lucide-react';
import { formatGBP } from '@/lib/calculations';
import { format, differenceInDays } from 'date-fns';
import { SEVERITY } from '@/lib/design-tokens';
import { useLeaseholdDetails } from '@/hooks/useLeaseholdDetails';

interface LeaseholdHealthCardProps {
  propertyId: string;
  leaseYearsRemaining?: number | null;
  tenure?: string | null;
}

function getLeaseHealthSeverity(years: number | null) {
  if (years === null) return 'neutral' as const;
  if (years < 60) return 'critical' as const;
  if (years < 80) return 'warning' as const;
  return 'success' as const;
}

function estimateExtensionCost(remainingYears: number, groundRent: number | null): number {
  // Rough estimate: marriage value applies below 80 years
  // Premium increases as lease shortens
  const baseMultiplier = groundRent && groundRent > 0 ? groundRent * 10 : 5000;
  if (remainingYears >= 80) return baseMultiplier;
  if (remainingYears >= 60) return baseMultiplier + (80 - remainingYears) * 500;
  // Below 60 years — significantly more expensive
  return baseMultiplier + 10000 + (60 - remainingYears) * 2000;
}

export function LeaseholdHealthCard({ propertyId, leaseYearsRemaining, tenure }: LeaseholdHealthCardProps) {
  const isExplicitlyLeasehold = tenure === 'Leasehold' || tenure === 'Share of Freehold';
  // If tenure is unknown, still attempt to fetch — if leasehold_details exist, the property is leasehold
  const shouldFetch = isExplicitlyLeasehold || !tenure;
  const { data: details, isLoading } = useLeaseholdDetails(shouldFetch ? propertyId : undefined);

  // If tenure was not provided and no leasehold details exist, hide the card
  const isLeasehold = isExplicitlyLeasehold || !!details;

  const remainingYears = details?.remaining_years ?? leaseYearsRemaining ?? null;
  const severity = getLeaseHealthSeverity(remainingYears);
  const sevClasses = SEVERITY[severity];

  const groundRent = details?.ground_rent ?? details?.ground_rent_annual ?? null;
  const serviceCharge = details?.service_charge ?? details?.service_charge_annual ?? null;
  const escalation = details?.ground_rent_escalation ?? null;
  const escalationDetail = details?.ground_rent_escalation_detail ?? null;
  const isEscalationRisky = escalation === 'doubling' || escalation === 'rpi' || (escalation?.toLowerCase().includes('doubl') ?? false) || (escalation?.toLowerCase().includes('rpi') ?? false);

  const extensionCost = useMemo(() => {
    if (details?.estimated_extension_cost) return details.estimated_extension_cost;
    if (remainingYears === null) return null;
    return estimateExtensionCost(remainingYears, groundRent);
  }, [details?.estimated_extension_cost, remainingYears, groundRent]);

  const nextGroundRentDue = details?.ground_rent_review_date ?? null;
  const daysUntilReview = nextGroundRentDue
    ? differenceInDays(new Date(nextGroundRentDue), new Date())
    : null;

  if (!isLeasehold) return null;

  return (
    <Card className={`border ${severity !== 'success' ? sevClasses.border : 'border-border'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            Leasehold Health
          </span>
          {remainingYears !== null && (
            <Badge className={sevClasses.badge}>
              {severity === 'critical' && 'Critical'}
              {severity === 'warning' && 'Warning'}
              {severity === 'success' && 'Healthy'}
              {severity === 'neutral' && 'Unknown'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <>
            {/* Traffic Light — Lease Length */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Remaining Lease</span>
              <span className={`font-semibold ${sevClasses.text}`}>
                {remainingYears !== null ? `${remainingYears} years` : '—'}
              </span>
            </div>

            {/* Lease Extension Callout */}
            {remainingYears !== null && remainingYears < 80 && (
              <div className={`flex items-start gap-2 p-3 rounded-md ${SEVERITY[severity].bg} border ${SEVERITY[severity].border}`}>
                <ShieldAlert className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY[severity].text}`} />
                <div className="space-y-1">
                  <p className={`text-xs font-medium ${SEVERITY[severity].text}`}>
                    {remainingYears < 60
                      ? 'Below 60 years — most lenders will not offer a mortgage. Lease extension strongly recommended.'
                      : 'Below 80 years — approaching the threshold where extensions become significantly more expensive (marriage value applies).'}
                  </p>
                  {extensionCost !== null && (
                    <p className={`text-xs ${SEVERITY[severity].text}`}>
                      Estimated extension cost: <span className="font-semibold">{formatGBP(extensionCost)}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Ground Rent */}
            {groundRent !== null && groundRent > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <PoundSterling className="h-3.5 w-3.5" />
                    Ground Rent
                  </span>
                  <span className="font-medium">
                    {formatGBP(groundRent)}
                    <span className="text-muted-foreground font-normal">
                      /{details?.ground_rent_frequency === 'quarterly' ? 'qtr' : details?.ground_rent_frequency === 'semi_annual' ? '6mo' : 'yr'}
                    </span>
                  </span>
                </div>
                {isEscalationRisky && (
                  <div className={`flex items-center gap-1.5 text-xs ${SEVERITY.warning.text}`}>
                    <AlertTriangle className="h-3 w-3" />
                    <span>
                      Escalation: {escalation}
                      {escalationDetail ? ` — ${escalationDetail}` : ''}
                    </span>
                  </div>
                )}
                {!isEscalationRisky && escalation && (
                  <p className="text-xs text-muted-foreground">
                    Escalation: {escalation}{escalationDetail ? ` — ${escalationDetail}` : ''}
                  </p>
                )}
              </div>
            )}

            {/* Service Charge */}
            {serviceCharge !== null && serviceCharge > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Service Charge</span>
                <span className="font-medium">
                  {formatGBP(serviceCharge)}
                  <span className="text-muted-foreground font-normal">
                    /{details?.service_charge_frequency === 'quarterly' ? 'qtr' : 'yr'}
                  </span>
                </span>
              </div>
            )}

            {/* Freeholder / Management Company */}
            {(details?.freeholder_name || details?.management_company || details?.managing_agent) && (
              <div className="text-sm space-y-1 pt-1 border-t border-border">
                {details?.freeholder_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Freeholder</span>
                    <span className="font-medium">{details.freeholder_name}</span>
                  </div>
                )}
                {(details?.management_company || details?.managing_agent) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Management Co.</span>
                    <span className="font-medium">{details.management_company || details.managing_agent}</span>
                  </div>
                )}
              </div>
            )}

            {/* Next Ground Rent Due */}
            {nextGroundRentDue && (
              <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Next Ground Rent Review
                </span>
                <span className={`font-medium ${daysUntilReview !== null && daysUntilReview <= 90 ? SEVERITY.warning.text : ''}`}>
                  {format(new Date(nextGroundRentDue), 'dd MMM yyyy')}
                  {daysUntilReview !== null && daysUntilReview <= 365 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({daysUntilReview <= 0 ? 'overdue' : `${daysUntilReview}d`})
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Estimated Extension Cost (for healthy leases too) */}
            {remainingYears !== null && remainingYears >= 80 && extensionCost !== null && (
              <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Est. Extension Cost
                </span>
                <span className="font-medium">{formatGBP(extensionCost)}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
