import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, AlertTriangle, Calendar } from 'lucide-react';
import { SEVERITY } from '@/lib/design-tokens';
import { useLeaseholdAlerts } from '@/hooks/useLeaseholdDetails';
import { format } from 'date-fns';

export function LeaseholdAlertWidget() {
  const navigate = useNavigate();
  const { data: alerts = [], isLoading } = useLeaseholdAlerts();

  if (isLoading || alerts.length === 0) return null;

  const shortLeaseAlerts = alerts.filter(a => a.alertType === 'short_lease');
  const groundRentAlerts = alerts.filter(a => a.alertType === 'ground_rent_review');

  const criticalCount = shortLeaseAlerts.filter(a => (a.remainingYears ?? 999) < 60).length;
  const warningCount = shortLeaseAlerts.filter(a => {
    const y = a.remainingYears ?? 999;
    return y >= 60 && y < 80;
  }).length;

  return (
    <Card className={`border ${criticalCount > 0 ? SEVERITY.critical.border : SEVERITY.warning.border}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Leasehold Alerts
          </span>
          <div className="flex gap-1.5">
            {criticalCount > 0 && (
              <Badge className={SEVERITY.critical.badge}>{criticalCount} critical</Badge>
            )}
            {warningCount > 0 && (
              <Badge className={SEVERITY.warning.badge}>{warningCount} warning</Badge>
            )}
            {groundRentAlerts.length > 0 && (
              <Badge className={SEVERITY.info.badge}>{groundRentAlerts.length} review</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Short Lease Properties */}
        {shortLeaseAlerts.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Short Leases</p>
            {shortLeaseAlerts.map((alert) => {
              const isCritical = (alert.remainingYears ?? 999) < 60;
              const sev = isCritical ? SEVERITY.critical : SEVERITY.warning;
              return (
                <button
                  key={`short-${alert.propertyId}`}
                  onClick={() => navigate(`/properties/${alert.propertyId}`)}
                  className={`w-full text-left flex items-center justify-between p-2 rounded-md ${sev.bg} hover:opacity-80 transition-opacity`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${sev.text}`} />
                    <span className="text-sm truncate">{alert.addressLine1}, {alert.city}</span>
                  </div>
                  <span className={`text-xs font-semibold whitespace-nowrap ml-2 ${sev.text}`}>
                    {alert.remainingYears}yr
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Ground Rent Reviews */}
        {groundRentAlerts.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ground Rent Reviews (next 12 months)</p>
            {groundRentAlerts.map((alert) => (
              <button
                key={`review-${alert.propertyId}`}
                onClick={() => navigate(`/properties/${alert.propertyId}`)}
                className={`w-full text-left flex items-center justify-between p-2 rounded-md ${SEVERITY.info.bg} hover:opacity-80 transition-opacity`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className={`h-3.5 w-3.5 shrink-0 ${SEVERITY.info.text}`} />
                  <span className="text-sm truncate">{alert.addressLine1}, {alert.city}</span>
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ml-2 ${SEVERITY.info.text}`}>
                  {alert.groundRentReviewDate ? format(new Date(alert.groundRentReviewDate), 'dd MMM yyyy') : '—'}
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
