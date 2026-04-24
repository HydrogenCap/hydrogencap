import React from 'react';
import { cn } from '@/lib/utils';

interface MetricValueProps {
  value: string | number | null | undefined;
  type?: 'currency' | 'percent' | 'number' | 'text';
  colorize?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Metric Value component for consistent number formatting and coloring.
 * Automatically applies green for positive, red for negative values.
 */
export function MetricValue({
  value,
  type: _type = 'text',
  colorize = false,
  size = 'md',
  className,
}: MetricValueProps) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className={cn('text-muted-foreground', className)}>—</span>;
  }

  // Determine if value is positive/negative for coloring
  let numericValue: number | null = null;
  if (typeof value === 'number') {
    numericValue = value;
  } else if (typeof value === 'string') {
    // Try to parse numeric value from formatted string
    const parsed = parseFloat(value.replace(/[£$%,]/g, ''));
    if (!isNaN(parsed)) {
      numericValue = parsed;
    }
  }

  const isPositive = numericValue !== null && numericValue >= 0;
  const isNegative = numericValue !== null && numericValue < 0;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
  };

  const colorClasses = colorize
    ? isPositive
      ? 'text-success'
      : isNegative
      ? 'text-destructive'
      : ''
    : '';

  return (
    <span className={cn(sizeClasses[size], colorClasses, className)}>
      {value}
    </span>
  );
}

/**
 * Status Badge component for compliance and risk indicators.
 */
interface StatusBadgeProps {
  status: 'success' | 'warning' | 'danger' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const statusClasses = {
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-destructive/10 text-destructive border-destructive/20',
    neutral: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        statusClasses[status],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Percentage Badge for LTV, ownership percentages, etc.
 */
interface PercentBadgeProps {
  value: number;
  thresholds?: { warning: number; danger: number };
  className?: string;
}

export function PercentBadge({ 
  value, 
  thresholds = { warning: 75, danger: 85 },
  className 
}: PercentBadgeProps) {
  let status: 'success' | 'warning' | 'danger' = 'success';
  if (value >= thresholds.danger) {
    status = 'danger';
  } else if (value >= thresholds.warning) {
    status = 'warning';
  }

  return (
    <StatusBadge status={status} className={className}>
      {value.toFixed(1)}%
    </StatusBadge>
  );
}
