import React from 'react';
import { cn } from '@/lib/utils';

interface ComplianceStatusBarProps {
  compliant: number;
  expiringSoon: number;
  expired: number;
  notRequired?: number;
  showLabels?: boolean;
  className?: string;
}

/**
 * Compliance Status Bar matching the Demo dashboard styling.
 * Horizontal stacked bar with legend showing compliance breakdown.
 */
export function ComplianceStatusBar({
  compliant,
  expiringSoon,
  expired,
  notRequired = 0,
  showLabels = true,
  className,
}: ComplianceStatusBarProps) {
  const total = compliant + expiringSoon + expired + notRequired;
  
  if (total === 0) {
    return (
      <div className={cn('text-center py-4 text-muted-foreground text-sm', className)}>
        No compliance items tracked
      </div>
    );
  }

  const segments = [
    { label: 'Compliant', count: compliant, color: 'bg-success', percent: (compliant / total) * 100 },
    { label: 'Expiring Soon', count: expiringSoon, color: 'bg-warning', percent: (expiringSoon / total) * 100 },
    { label: 'Expired', count: expired, color: 'bg-destructive', percent: (expired / total) * 100 },
    { label: 'Not Required', count: notRequired, color: 'bg-muted', percent: (notRequired / total) * 100 },
  ].filter(s => s.count > 0);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Labels */}
      {showLabels && (
        <div className="space-y-2">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('h-3 w-3 rounded-full', segment.color)} />
                <span className="text-sm text-foreground">{segment.label}</span>
              </div>
              <span className="font-semibold text-foreground">{segment.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={cn('h-full transition-all duration-300', segment.color)}
            style={{ width: `${segment.percent}%` }}
          />
        ))}
      </div>
    </div>
  );
}
