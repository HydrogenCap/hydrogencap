import { useMemo } from 'react';
import { Shield, Home, AlertTriangle, BarChart3, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { usePropertyCompliance } from '@/hooks/useCompliance';
import { usePropertyPassport, calculatePassportCompleteness } from '@/hooks/usePropertyPassport';
import { usePortfolioRisks } from '@/hooks/usePortfolioRisks';
import { useTenancies } from '@/hooks/useTenancies';
import { getExpiryStatus } from '@/lib/calculations';
import { getComplianceStatus } from '@/lib/complianceStatus';

interface PropertyStatusBarProps {
  propertyId: string;
  lifecycleType?: string;
}

export function PropertyStatusBar({ propertyId, lifecycleType }: PropertyStatusBarProps) {
  const { data: complianceItems } = usePropertyCompliance(propertyId);
  const { data: passport } = usePropertyPassport(propertyId);
  const { risks } = usePortfolioRisks();
  const { data: tenancies } = useTenancies({ propertyId, status: 'active' });

  const passportCompleteness = useMemo(
    () => calculatePassportCompleteness(passport ?? null),
    [passport]
  );

  // Compliance summary
  const complianceSummary = useMemo(() => {
    if (!complianceItems || complianceItems.length === 0) {
      return { status: 'unknown' as const, label: 'Not checked', issues: 0 };
    }
    const required = complianceItems;
    const issues = required.filter(i => {
      if (!i.expiry_date) return true; // missing
      const status = getExpiryStatus(i.expiry_date);
      return status === 'expired';
    });
    if (issues.length === 0) return { status: 'good' as const, label: 'Compliant', issues: 0 };
    return { status: 'bad' as const, label: `${issues.length} issue${issues.length > 1 ? 's' : ''}`, issues: issues.length };
  }, [complianceItems]);

  // Tenancy summary
  const tenancySummary = useMemo(() => {
    if (lifecycleType === 'development') {
      return { status: 'neutral' as const, label: 'Development' };
    }
    if (!tenancies || tenancies.length === 0) {
      return { status: 'bad' as const, label: 'Void' };
    }
    const active = tenancies[0];
    const tenantName = `${active.tenant?.first_name || ''} ${active.tenant?.last_name || ''}`.trim() || 'Tenant';
    const endStr = active.end_date ? ` · ends ${format(new Date(active.end_date), 'dd MMM yy')}` : '';
    return { status: 'good' as const, label: `${tenantName}${endStr}` };
  }, [tenancies, lifecycleType]);

  // Next action (most urgent risk for this property)
  const nextAction = useMemo(() => {
    if (!risks) return null;
    const propertyRisks = risks.filter(r => r.propertyId === propertyId);
    if (propertyRisks.length === 0) return null;
    // Critical first
    const sorted = [...propertyRisks].sort((a, b) =>
      a.severity === 'critical' && b.severity !== 'critical' ? -1 : 1
    );
    return sorted[0];
  }, [risks, propertyId]);

  const statusDot = (s: 'good' | 'bad' | 'neutral' | 'unknown') => {
    const colors = {
      good: 'bg-green-500',
      bad: 'bg-red-500',
      neutral: 'bg-muted-foreground',
      unknown: 'bg-muted-foreground/50',
    };
    return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${colors[s]}`} />;
  };

  return (
    <div className="rounded-lg bg-muted/30 border px-4 py-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0 md:divide-x divide-border">
        {/* Compliance */}
        <div className="flex items-center gap-2 md:pr-4">
          <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
          {statusDot(complianceSummary.status)}
          <span className="text-sm truncate">{complianceSummary.label}</span>
        </div>

        {/* Tenancy */}
        <div className="flex items-center gap-2 md:px-4">
          <Home className="h-4 w-4 text-muted-foreground shrink-0" />
          {statusDot(tenancySummary.status)}
          <span className="text-sm truncate">{tenancySummary.label}</span>
        </div>

        {/* Next Action */}
        <div className="flex items-center gap-2 md:px-4">
          {nextAction ? (
            <>
              <AlertTriangle className={`h-4 w-4 shrink-0 ${nextAction.severity === 'critical' ? 'text-destructive' : 'text-warning'}`} />
              {statusDot(nextAction.severity === 'critical' ? 'bad' : 'neutral')}
              <span className="text-sm truncate">{nextAction.message}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              {statusDot('good')}
              <span className="text-sm truncate">No actions due</span>
            </>
          )}
        </div>

        {/* Data Quality */}
        <div className="flex items-center gap-2 md:pl-4">
          <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center">
              <span className="text-[10px] font-bold leading-none">{passportCompleteness.percentage}</span>
            </div>
            <span className="text-sm text-muted-foreground">Data</span>
          </div>
        </div>
      </div>
    </div>
  );
}
