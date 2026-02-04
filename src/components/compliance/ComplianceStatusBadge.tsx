import { Badge } from '@/components/ui/badge';
import { 
  getComplianceItemStatus, 
  getComplianceStatusLabel, 
  getComplianceStatusColor,
  type ComplianceStatus 
} from '@/lib/complianceTypes';

interface ComplianceStatusBadgeProps {
  expiryDate: string | null;
  showLabel?: boolean;
}

export function ComplianceStatusBadge({ expiryDate, showLabel = true }: ComplianceStatusBadgeProps) {
  const status = getComplianceItemStatus(expiryDate);
  const label = getComplianceStatusLabel(status, expiryDate);
  const colorClass = getComplianceStatusColor(status);

  const statusText: Record<ComplianceStatus, string> = {
    valid: 'Valid',
    expiring_soon: 'Expiring Soon',
    expired: 'Expired',
    unknown: 'Unknown',
    not_required: 'Not Required',
    optional: 'Optional',
  };

  return (
    <div className="flex items-center gap-2">
      <Badge className={colorClass}>
        {statusText[status]}
      </Badge>
      {showLabel && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
