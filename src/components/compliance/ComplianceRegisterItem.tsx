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
  iconBgClass: string;
  iconClass: string;
  badgeClass: string;
  label: (days: number | null, reason?: string) => string;
  buttonLabel: string;
  buttonVariant: 'default' | 'outline' | 'ghost';
  showButton: boolean;
}> = {
  valid: {
    icon: CheckCircle2,
    iconBgClass: 'bg-success/20',
    iconClass: 'text-success',
    badgeClass: 'bg-success/20 text-success border-success/30',
    label: (days) => days !== null ? `Valid for ${days} days` : 'Valid',
    buttonLabel: 'Update',
    buttonVariant: 'outline',
    showButton: true,
  },
  expiring_soon: {
    icon: Clock,
    iconBgClass: 'bg-warning/20',
    iconClass: 'text-warning',
    badgeClass: 'bg-warning/20 text-warning border-warning/30',
    label: (days) => days !== null ? (days === 0 ? 'Expires today' : `Expires in ${days} days`) : 'Expiring Soon',
    buttonLabel: 'Update',
    buttonVariant: 'outline',
    showButton: true,
  },
  expired: {
    icon: XCircle,
    iconBgClass: 'bg-destructive/20',
    iconClass: 'text-destructive',
    badgeClass: 'bg-destructive/20 text-destructive border-destructive/30',
    label: (days) => days !== null ? `Expired ${Math.abs(days)} days ago` : 'Expired',
    buttonLabel: 'Upload',
    buttonVariant: 'default',
    showButton: true,
  },
  unknown: {
    icon: AlertCircle,
    iconBgClass: 'bg-muted',
    iconClass: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    label: () => 'Not uploaded',
    buttonLabel: 'Upload',
    buttonVariant: 'default',
    showButton: true,
  },
  not_required: {
    icon: Info,
    iconBgClass: 'bg-primary/10',
    iconClass: 'text-primary/60',
    badgeClass: 'bg-primary/10 text-primary/80 border-primary/20',
    label: () => 'Not required',
    buttonLabel: 'Upload',
    buttonVariant: 'ghost',
    showButton: false,
  },
  optional: {
    icon: Info,
    iconBgClass: 'bg-primary/10',
    iconClass: 'text-primary/60',
    badgeClass: 'bg-primary/10 text-primary/80 border-primary/20',
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
      'group flex items-center justify-between px-5 py-4 transition-colors duration-150',
      'hover:bg-accent/30',
      // Border between items
      'border-b border-border/50 last:border-b-0',
      // Conditional items styling
      isConditionalItem && 'opacity-60 hover:opacity-80'
    )}>
      {/* Left side - Icon & Info */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Status icon in colored circle */}
        <div className={cn(
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-200',
          'group-hover:scale-110',
          config.iconBgClass
        )}>
          <Icon className={cn('h-5 w-5', config.iconClass)} />
        </div>
        
        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            'font-medium text-foreground truncate',
            isConditionalItem && 'text-muted-foreground'
          )}>
            {complianceType}
          </div>
          
          {/* Secondary info */}
          <div className="text-sm text-muted-foreground mt-0.5 truncate">
            {isConditionalItem && conditionalReason ? (
              conditionalReason
            ) : isMissing ? (
              <span className="italic">
                Not uploaded
                {alternativeType && (
                  <span className="ml-1 text-xs">• Or upload {alternativeType}</span>
                )}
              </span>
            ) : (expiryDate || certificateNumber) ? (
              <>
                {expiryDate && `Expires: ${formatDate(expiryDate)}`}
                {expiryDate && certificateNumber && ' • '}
                {certificateNumber && `#${certificateNumber}`}
              </>
            ) : null}
          </div>
        </div>
      </div>
      
      {/* Right side - Status badge & button */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Status badge - prominent */}
        <Badge 
          variant="outline" 
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
            config.badgeClass
          )}
        >
          {config.label(days, conditionalReason)}
        </Badge>
        
        {/* Action button */}
        {config.showButton && (
          <Button
            size="sm"
            variant={config.buttonVariant}
            onClick={onUpload}
            className={cn(
              'min-w-[90px] h-9 transition-all duration-150',
              needsAction && 'bg-primary hover:bg-primary/90',
              status === 'optional' && 'text-muted-foreground'
            )}
          >
            {needsAction ? (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            {status === 'optional' ? 'Upload' : config.buttonLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
