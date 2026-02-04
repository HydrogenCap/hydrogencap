import { CheckCircle2, Clock, XCircle, AlertCircle, Upload, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getComplianceItemStatus, type ComplianceStatus } from '@/lib/complianceTypes';

interface ComplianceRegisterItemProps {
  id: string;
  complianceType: string;
  expiryDate: string | null;
  issueDate?: string | null;
  certificateNumber?: string | null;
  onUpload: () => void;
}

const statusConfig: Record<ComplianceStatus, {
  icon: typeof CheckCircle2;
  iconClass: string;
  badgeClass: string;
  label: (days: number | null) => string;
  buttonLabel: string;
  buttonVariant: 'default' | 'outline';
}> = {
  valid: {
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200',
    label: (days) => days !== null ? `Valid for ${days} days` : 'Valid',
    buttonLabel: 'Update',
    buttonVariant: 'outline',
  },
  expiring_soon: {
    icon: Clock,
    iconClass: 'text-amber-600',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
    label: (days) => days !== null ? (days === 0 ? 'Expires today' : `Expires in ${days} days`) : 'Expiring Soon',
    buttonLabel: 'Update',
    buttonVariant: 'outline',
  },
  expired: {
    icon: XCircle,
    iconClass: 'text-red-600',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200',
    label: (days) => days !== null ? `Expired ${Math.abs(days)} days ago` : 'Expired',
    buttonLabel: 'Upload',
    buttonVariant: 'default',
  },
  unknown: {
    icon: AlertCircle,
    iconClass: 'text-gray-500',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200',
    label: () => 'Unknown',
    buttonLabel: 'Upload',
    buttonVariant: 'default',
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

export function ComplianceRegisterItem({
  complianceType,
  expiryDate,
  issueDate,
  certificateNumber,
  onUpload,
}: ComplianceRegisterItemProps) {
  const status = getComplianceItemStatus(expiryDate);
  const config = statusConfig[status];
  const Icon = config.icon;
  const days = getDaysUntilExpiry(expiryDate);

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

  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Icon className={cn('h-5 w-5 flex-shrink-0', config.iconClass)} />
        <div className="min-w-0">
          <p className="font-medium truncate">{complianceType}</p>
          {(expiryDate || certificateNumber) && (
            <p className="text-sm text-muted-foreground truncate">
              {expiryDate && `Expires: ${formatDate(expiryDate)}`}
              {expiryDate && certificateNumber && ' • '}
              {certificateNumber && `#${certificateNumber}`}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge variant="outline" className={cn('font-normal', config.badgeClass)}>
          {config.label(days)}
        </Badge>
        <Button
          size="sm"
          variant={config.buttonVariant}
          onClick={onUpload}
          className="gap-1.5"
        >
          {config.buttonVariant === 'default' ? (
            <Upload className="h-3.5 w-3.5" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {config.buttonLabel}
        </Button>
      </div>
    </div>
  );
}
