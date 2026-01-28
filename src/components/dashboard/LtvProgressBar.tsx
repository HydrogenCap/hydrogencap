import React from 'react';
import { cn } from '@/lib/utils';

interface LtvProgressBarProps {
  name: string;
  ltv: number;
  value?: string;
  className?: string;
}

/**
 * LTV Progress Bar matching the Demo dashboard styling.
 * Shows entity name, LTV percentage, and a progress bar with color coding.
 */
export function LtvProgressBar({
  name,
  ltv,
  value,
  className,
}: LtvProgressBarProps) {
  // Color coding based on LTV thresholds
  const getBarColor = () => {
    if (ltv >= 85) return 'bg-destructive';
    if (ltv >= 75) return 'bg-warning';
    return 'bg-primary';
  };

  const getTextColor = () => {
    if (ltv >= 85) return 'text-destructive';
    if (ltv >= 75) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex justify-between text-sm">
        <span className="font-medium text-foreground truncate">{name}</span>
        <span className={cn('font-medium', getTextColor())}>{ltv.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', getBarColor())}
          style={{ width: `${Math.min(ltv, 100)}%` }}
        />
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">{value}</p>
      )}
    </div>
  );
}

interface LtvProgressListProps {
  items: Array<{
    id: string;
    name: string;
    ltv: number;
    value?: string;
  }>;
  className?: string;
}

/**
 * List of LTV Progress Bars for multiple entities.
 */
export function LtvProgressList({ items, className }: LtvProgressListProps) {
  if (items.length === 0) {
    return (
      <div className={cn('text-center py-4 text-muted-foreground text-sm', className)}>
        No data available
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {items.map((item) => (
        <LtvProgressBar
          key={item.id}
          name={item.name}
          ltv={item.ltv}
          value={item.value}
        />
      ))}
    </div>
  );
}
