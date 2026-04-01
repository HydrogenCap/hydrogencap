import { SeverityBadge } from '@/components/common';
import {
  getComplianceItemStatus,
  getComplianceStatusLabel,
  type ComplianceStatus
} from '@/lib/complianceTypes';
import { type SeverityLevel } from '@/lib/design-tokens';

const STATUS_SEVERITY: Record<ComplianceStatus, SeverityLevel> = {
  expired: 'critical',
  expiring_soon: 'warning',
  valid: 'success',
  not_required: 'info',
  optional: 'info',
  unknown: 'neutral',
};

const STATUS_TEXT: Record<ComplianceStatus, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  unknown: 'Unknown',
  not_required: 'Not Required',
  optional: 'Optional',
};

interface ComplianceStatusBadgeProps {
  expiryDate: string | null;
  showLabel?: boolean;
}

export function ComplianceStatusBadge({ expiryDate, showLabel = true }: ComplianceStatusBadgeProps) {
  const status = getComplianceItemStatus(expiryDate);
  const label = getComplianceStatusLabel(status, expiryDate);

  return (
    <div className="flex items-center gap-2">
      <SeverityBadge severity={STATUS_SEVERITY[status]}>
        {STATUS_TEXT[status]}
      </SeverityBadge>
      {showLabel && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
