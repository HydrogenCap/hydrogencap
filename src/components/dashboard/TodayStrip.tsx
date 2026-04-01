import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ShieldCheck, PoundSterling, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/lib/calculations';
import type { RiskItem } from '@/hooks/usePortfolioRisks';
import type { LoanAlert } from '@/hooks/useLoanFacilities';
import type { RentScheduleWithDetails } from '@/hooks/useRentCollection';

interface TodayStripProps {
  /** Portfolio risk items from usePortfolioRisks */
  risks: RiskItem[];
  criticalCount: number;
  /** Loan alerts from useLoanAlerts */
  loanAlerts: LoanAlert[] | undefined;
  /** Rent schedule items for the current month */
  rentSchedule: RentScheduleWithDetails[] | undefined;
  /** Upcoming compliance events from useUpcomingComplianceEvents */
  complianceEvents: { title: string; propertyAddress: string; daysUntil: number }[] | undefined;
}

interface StripItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sublabel?: string;
  href?: string;
  variant?: 'default' | 'warning' | 'critical' | 'success';
}

function StripItem({ icon: Icon, label, value, sublabel, href, variant = 'default' }: StripItemProps) {
  const colorMap = {
    default: 'text-muted-foreground',
    warning: 'text-warning',
    critical: 'text-destructive',
    success: 'text-success',
  };

  const content = (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className={cn('h-4 w-4 shrink-0', colorMap[variant])} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={cn('text-sm font-semibold truncate', colorMap[variant])}>{value}</p>
        {sublabel && <p className="text-xs text-muted-foreground truncate">{sublabel}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        to={href}
        className="flex-1 min-w-[140px] rounded-lg border bg-card px-3 py-2 hover:bg-accent/50 transition-colors"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex-1 min-w-[140px] rounded-lg border bg-card px-3 py-2">
      {content}
    </div>
  );
}

export function TodayStrip({ risks, criticalCount, loanAlerts, rentSchedule, complianceEvents }: TodayStripProps) {
  // 1. Critical action count
  const actionVariant = criticalCount > 0 ? 'critical' : risks.length > 0 ? 'warning' : 'success';
  const actionValue = risks.length === 0 ? 'All clear' : `${risks.length} actions`;
  const actionSublabel = criticalCount > 0 ? `${criticalCount} critical` : undefined;

  // 2. Next expiring certificate (compliance event soonest in the future)
  const nextCert = complianceEvents?.find(e => e.daysUntil > 0);
  const certValue = nextCert
    ? `${nextCert.daysUntil}d`
    : 'None due';
  const certSublabel = nextCert?.title ?? undefined;
  const certVariant: StripItemProps['variant'] = !nextCert
    ? 'success'
    : nextCert.daysUntil <= 14
      ? 'critical'
      : nextCert.daysUntil <= 30
        ? 'warning'
        : 'default';

  // 3. Next rent due
  const now = new Date();
  const upcomingRent = rentSchedule
    ?.filter(r => (r.status === 'upcoming' || r.status === 'due') && new Date(r.due_date) >= now)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
  const rentValue = upcomingRent ? formatGBP(upcomingRent.rent_amount) : 'None due';
  const rentSublabel = upcomingRent
    ? new Date(upcomingRent.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : undefined;

  // 4. Mortgage rate expiring soonest
  const soonestRate = loanAlerts
    ?.filter(a => a.days_to_rate_expiry !== null && a.days_to_rate_expiry > 0)
    .sort((a, b) => (a.days_to_rate_expiry ?? Infinity) - (b.days_to_rate_expiry ?? Infinity))[0];
  const rateValue = soonestRate
    ? `${soonestRate.days_to_rate_expiry}d`
    : 'No expiry';
  const rateSublabel = soonestRate?.property_address ?? undefined;
  const rateVariant: StripItemProps['variant'] = !soonestRate
    ? 'success'
    : (soonestRate.days_to_rate_expiry ?? Infinity) <= 30
      ? 'critical'
      : (soonestRate.days_to_rate_expiry ?? Infinity) <= 90
        ? 'warning'
        : 'default';

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <StripItem
        icon={AlertTriangle}
        label="Actions"
        value={actionValue}
        sublabel={actionSublabel}
        href="/actions"
        variant={actionVariant}
      />
      <StripItem
        icon={ShieldCheck}
        label="Next certificate"
        value={certValue}
        sublabel={certSublabel}
        variant={certVariant}
      />
      <StripItem
        icon={PoundSterling}
        label="Next rent due"
        value={rentValue}
        sublabel={rentSublabel}
      />
      <StripItem
        icon={Percent}
        label="Rate expiry"
        value={rateValue}
        sublabel={rateSublabel}
        variant={rateVariant}
      />
    </div>
  );
}
