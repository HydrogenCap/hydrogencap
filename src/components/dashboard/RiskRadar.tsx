import React from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from './MetricValue';

interface RiskItem {
  id: string;
  title: string;
  subtitle: string;
  severity: 'expired' | 'critical' | 'warning' | 'info';
  daysText?: string;
}

interface RiskRadarProps {
  items: RiskItem[];
  maxItems?: number;
  emptyMessage?: string;
  className?: string;
}

/**
 * Risk Radar component matching the Demo dashboard styling.
 * Displays a list of risk items with severity badges.
 */
export function RiskRadar({
  items,
  maxItems = 10,
  emptyMessage = 'No risks detected',
  className,
}: RiskRadarProps) {
  const displayItems = items.slice(0, maxItems);
  const remainingCount = items.length - maxItems;

  const getSeverityStatus = (severity: RiskItem['severity']): 'danger' | 'warning' | 'neutral' => {
    switch (severity) {
      case 'expired':
      case 'critical':
        return 'danger';
      case 'warning':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const getSeverityLabel = (severity: RiskItem['severity']): string => {
    switch (severity) {
      case 'expired':
        return 'Expired';
      case 'critical':
        return 'Critical';
      case 'warning':
        return 'Warning';
      default:
        return 'Info';
    }
  };

  if (items.length === 0) {
    return (
      <div className={cn('text-center py-6', className)}>
        <div className="text-success font-medium mb-1">✓ All clear</div>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {displayItems.map((item) => (
        <div
          key={item.id}
          className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-medium text-sm text-foreground truncate">
              {item.title}
            </span>
            <StatusBadge status={getSeverityStatus(item.severity)}>
              {getSeverityLabel(item.severity)}
            </StatusBadge>
          </div>
          <p className="text-xs text-muted-foreground">
            {item.subtitle}
            {item.daysText && ` • ${item.daysText}`}
          </p>
        </div>
      ))}
      {remainingCount > 0 && (
        <p className="text-center text-xs text-muted-foreground pt-1">
          +{remainingCount} more items
        </p>
      )}
    </div>
  );
}
