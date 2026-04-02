import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  getComplianceStatus,
  getComplianceStatusColor,
  formatComplianceDate,
} from '@/lib/complianceStatus';
import { cn } from '@/lib/utils';

interface ComplianceStatusBadgeProps {
  dueDate: string | null | undefined;
  showDate?: boolean;
  compact?: boolean;
  className?: string;
}

export function ComplianceStatusBadge({ 
  dueDate, 
  showDate = true,
  compact = false,
  className 
}: ComplianceStatusBadgeProps) {
  const { status, label } = getComplianceStatus(dueDate);
  
  if (!dueDate) {
    return (
      <span className={cn('text-muted-foreground text-sm', className)}>
        —
      </span>
    );
  }

  if (compact) {
    return (
      <div className={cn('flex flex-col items-start gap-0.5', className)}>
        <span className="text-sm">{formatComplianceDate(dueDate)}</span>
        <Badge 
          className={cn(
            'text-[10px] px-1.5 py-0',
            getComplianceStatusColor(status)
          )}
        >
          {status === 'ok' ? 'OK' : status === 'due_soon' ? 'Due Soon' : 'Overdue'}
        </Badge>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showDate && (
        <span className="text-sm">{formatComplianceDate(dueDate)}</span>
      )}
      <Badge className={cn('text-xs', getComplianceStatusColor(status))}>
        {label}
      </Badge>
    </div>
  );
}
