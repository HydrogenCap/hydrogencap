import { CheckCircle2, Clock, XCircle, AlertCircle, Upload, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type ComplianceStatus } from '@/lib/complianceTypes';

interface ComplianceRegisterItemProps {
  id: string;
  complianceType: string;
  expiryDate: string | null;
  issueDate?: string | null;
  certificateNumber?: string | null;
  status?: ComplianceStatus;
  daysUntilExpiry?: number | null;
  isMissing?: boolean;
  conditionalReason?: string;
  alternativeType?: string;
  onUpload: () => void;
}

const statusConfig: Record<ComplianceStatus, {
  icon: typeof CheckCircle2;
  iconClass: string;
  badgeClass: string;
  label: (days: number | null, reason?: string) => string;
  buttonLabel: string;
  buttonVariant: 'default' | 'outline' | 'ghost';
  showButton: boolean;
}> = {
  valid: {
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200',
    label: (days) => days !== null ? `Valid for ${days} days` : 'Valid',
    buttonLabel: 'Update',
    buttonVariant: 'outline',
    showButton: true,
  },
  expiring_soon: {
    icon: Clock,
    iconClass: 'text-amber-600',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
    label: (days) => days !== null ? (days === 0 ? 'Expires today' : `Expires in ${days} days`) : 'Expiring Soon',
    buttonLabel: 'Update',
    buttonVariant: 'outline',
    showButton: true,
  },
  expired: {
    icon: XCircle,
    iconClass: 'text-red-600',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200',
    label: (days) => days !== null ? `Expired ${Math.abs(days)} days ago` : 'Expired',
    buttonLabel: 'Upload',
    buttonVariant: 'default',
    showButton: true,
  },
  unknown: {
    icon: AlertCircle,
    iconClass: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    label: () => 'Not uploaded',
    buttonLabel: 'Upload',
    buttonVariant: 'default',
    showButton: true,
  },
  not_required: {
    icon: Info,
    iconClass: 'text-blue-500',
    badgeClass: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200',
    label: () => 'Not required',
    buttonLabel: 'Upload',
    buttonVariant: 'ghost',
    showButton: false,
  },
  optional: {
    icon: Info,
    iconClass: 'text-blue-500',
    badgeClass: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200',
    label: () => 'Optional',
    buttonLabel: 'Upload',
    buttonVariant: 'ghost',
    showButton: true,
  },
};

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusFromExpiry(expiryDate: string | null): ComplianceStatus {
  if (!expiryDate) return 'unknown';
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return 'unknown';
  if (days < 0) return 'expired';
  if (days <= 60) return 'expiring_soon';
  return 'valid';
}

export function ComplianceRegisterItem({
  complianceType,
  expiryDate,
  issueDate,
  certificateNumber,
  status: statusProp,
  daysUntilExpiry: daysUntilExpiryProp,
  isMissing = false,
  conditionalReason,
  alternativeType,
  onUpload,
}: ComplianceRegisterItemProps) {
  // Use provided status/days or calculate from expiryDate
  const status = statusProp ?? getStatusFromExpiry(expiryDate);
  const days = daysUntilExpiryProp ?? getDaysUntilExpiry(expiryDate);
  const config = statusConfig[status];
  const Icon = config.icon;

  const formatDate = (date: string | null) => {
    if (!date) return null;
    try {
      return new Date(date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  };

  // Determine visual treatment based on status
  const isConditionalItem = status === 'not_required' || status === 'optional';
  const needsAction = status === 'expired' || status === 'unknown';

  return (
    <div className={cn(
      'flex items-center justify-between py-3 first:pt-0 last:pb-0',
      // Visual treatment for different states
      needsAction && isMissing && 'bg-amber-50/50 dark:bg-amber-900/10 -mx-4 px-4 border-l-4 border-amber-400',
      isConditionalItem && 'bg-gray-50/50 dark:bg-gray-900/20 -mx-4 px-4 border-l-4 border-gray-200 dark:border-gray-700 opacity-75'
    )}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Icon className={cn('h-5 w-5 flex-shrink-0', config.iconClass)} />
        <div className="min-w-0">
          <p className={cn(
            'font-medium truncate',
            isConditionalItem && 'text-muted-foreground'
          )}>
            {complianceType}
          </p>
          {/* Show conditional reason for not_required/optional items */}
          {isConditionalItem && conditionalReason ? (
            <p className="text-xs text-muted-foreground truncate">
              {conditionalReason}
            </p>
          ) : isMissing ? (
            <p className="text-sm text-muted-foreground italic truncate">
              Not uploaded
              {alternativeType && (
                <span className="ml-1 text-xs">• Or upload {alternativeType}</span>
              )}
            </p>
          ) : (expiryDate || certificateNumber) ? (
            <p className="text-sm text-muted-foreground truncate">
              {expiryDate && `Expires: ${formatDate(expiryDate)}`}
              {expiryDate && certificateNumber && ' • '}
              {certificateNumber && `#${certificateNumber}`}
            </p>
          ) : null}
        </div>
      </div>
      
      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge variant="outline" className={cn('font-normal', config.badgeClass)}>
          {config.label(days, conditionalReason)}
        </Badge>
        {config.showButton && (
          <Button
            size="sm"
            variant={config.buttonVariant}
            onClick={onUpload}
            className={cn(
              'gap-1.5',
              status === 'optional' && 'text-muted-foreground'
            )}
          >
            {config.buttonVariant === 'default' ? (
              <Upload className="h-3.5 w-3.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {status === 'optional' ? 'Upload (Optional)' : config.buttonLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
