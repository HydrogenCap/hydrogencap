import { Shield, PoundSterling, ShieldCheck, Zap, Landmark } from 'lucide-react';
import { StatusDot } from '@/components/common/StatusDot';
import { SEVERITY, type SeverityLevel } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import type { ComplianceMatrixRow } from '@/lib/complianceV2Types';
import type { InsurancePolicy } from '@/hooks/useInsurance';
import type { LoanFacility } from '@/hooks/useLoanFacilities';

interface PropertyStatusBarProps {
  complianceRows: ComplianceMatrixRow[] | undefined;
  insurancePolicies: InsurancePolicy[] | undefined;
  loans: LoanFacility[] | undefined;
  epcRating: string | null | undefined;
  rentStatus?: 'paid' | 'partial' | 'overdue' | 'void' | null;
}

interface StatusIndicator {
  label: string;
  severity: SeverityLevel;
  icon: React.ElementType;
}

function getComplianceSeverity(rows: ComplianceMatrixRow[] | undefined): SeverityLevel {
  if (!rows || rows.length === 0) return 'neutral';
  const required = rows.filter(r => r.is_required);
  if (required.length === 0) return 'neutral';
  if (required.some(r => r.calculated_status === 'expired' || r.calculated_status === 'missing')) return 'critical';
  if (required.some(r => r.calculated_status === 'expiring_soon' || r.calculated_status === 'critical')) return 'warning';
  return 'success';
}

function getComplianceLabel(rows: ComplianceMatrixRow[] | undefined): string {
  if (!rows || rows.length === 0) return 'Awaiting first cert';
  const required = rows.filter(r => r.is_required);
  const expired = required.filter(r => r.calculated_status === 'expired' || r.calculated_status === 'missing');
  const expiring = required.filter(r => r.calculated_status === 'expiring_soon' || r.calculated_status === 'critical');
  if (expired.length > 0) return `${expired.length} expired`;
  if (expiring.length > 0) return `${expiring.length} expiring`;
  return 'Compliant';
}

function getRentSeverity(status: string | null | undefined): SeverityLevel {
  if (!status) return 'neutral';
  switch (status) {
    case 'paid': return 'success';
    case 'partial': return 'warning';
    case 'overdue': return 'critical';
    case 'void': return 'neutral';
    default: return 'neutral';
  }
}

function getRentLabel(status: string | null | undefined): string {
  if (!status) return 'No rent recorded';
  switch (status) {
    case 'paid': return 'Fully paid';
    case 'partial': return 'Partial';
    case 'overdue': return 'Overdue';
    case 'void': return 'Void';
    default: return status;
  }
}

function getInsuranceSeverity(policies: InsurancePolicy[] | undefined): SeverityLevel {
  if (!policies || policies.length === 0) return 'critical';
  const now = new Date();
  const hasExpired = policies.some(p => {
    if (!p.renewal_date) return false;
    return new Date(p.renewal_date) < now;
  });
  if (hasExpired) return 'critical';
  return 'success';
}

function getInsuranceLabel(policies: InsurancePolicy[] | undefined): string {
  if (!policies || policies.length === 0) return 'Missing';
  const now = new Date();
  const expired = policies.filter(p => p.renewal_date && new Date(p.renewal_date) < now);
  if (expired.length > 0) return 'Expired';
  return 'Insured';
}

function getEpcSeverity(rating: string | null | undefined): SeverityLevel {
  if (!rating) return 'neutral';
  const r = rating.toUpperCase();
  if (['A', 'B', 'C'].includes(r)) return 'success';
  if (r === 'D') return 'warning';
  return 'critical';
}

function getEpcLabel(rating: string | null | undefined): string {
  if (!rating) return 'No EPC';
  const r = rating.toUpperCase();
  if (['E', 'F', 'G'].includes(r)) return `EPC: ${r} (below min)`;
  return `EPC: ${r}`;
}

function getMortgageSeverity(loans: LoanFacility[] | undefined): SeverityLevel {
  if (!loans || loans.length === 0) return 'neutral';
  const now = new Date();
  const sixMonths = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  const hasExpired = loans.some(l => {
    if (l.rate_type === 'variable' || l.rate_type === 'tracker') return true;
    if (l.rate_expiry_date && new Date(l.rate_expiry_date) < now) return true;
    return false;
  });
  if (hasExpired) return 'critical';
  const expiringSoon = loans.some(l => l.rate_expiry_date && new Date(l.rate_expiry_date) < sixMonths);
  if (expiringSoon) return 'warning';
  return 'success';
}

function getMortgageLabel(loans: LoanFacility[] | undefined): string {
  if (!loans || loans.length === 0) return 'No mortgage';
  const now = new Date();
  const onSvr = loans.some(l => {
    if (l.rate_type === 'variable') return true;
    if (l.rate_expiry_date && new Date(l.rate_expiry_date) < now) return true;
    return false;
  });
  if (onSvr) return 'On SVR';
  const fixed = loans.every(l => l.rate_type === 'fixed');
  if (fixed) return 'Fixed';
  return 'Mixed rates';
}

export function PropertyStatusBar({
  complianceRows,
  insurancePolicies,
  loans,
  epcRating,
  rentStatus,
}: PropertyStatusBarProps) {
  const indicators: StatusIndicator[] = [
    {
      label: getComplianceLabel(complianceRows),
      severity: getComplianceSeverity(complianceRows),
      icon: Shield,
    },
    {
      label: `Rent: ${getRentLabel(rentStatus)}`,
      severity: getRentSeverity(rentStatus),
      icon: PoundSterling,
    },
    {
      label: getInsuranceLabel(insurancePolicies),
      severity: getInsuranceSeverity(insurancePolicies),
      icon: ShieldCheck,
    },
    {
      label: getEpcLabel(epcRating),
      severity: getEpcSeverity(epcRating),
      icon: Zap,
    },
    {
      label: getMortgageLabel(loans),
      severity: getMortgageSeverity(loans),
      icon: Landmark,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
      {indicators.map((ind, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && <div className="mx-2 h-4 w-px bg-border" />}
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
              SEVERITY[ind.severity].badge
            )}
          >
            <StatusDot severity={ind.severity} pulse={ind.severity === 'critical'} />
            <ind.icon className="h-3 w-3" />
            <span>{ind.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
