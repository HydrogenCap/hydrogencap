import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  /** Secondary attributed value shown beneath the primary gross value */
  secondaryLabel?: string;
  secondaryValue?: string | number;
  secondaryValueClassName?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
  onClick?: () => void;
  headerAction?: React.ReactNode;
  className?: string;
}

/**
 * KPI Card component matching the Demo dashboard styling.
 * Elevated card with subtle gradient, consistent spacing, and clear hierarchy.
 */
export function KpiCard({
  label,
  value,
  trend,
  trendUp,
  subtitle,
  secondaryLabel,
  secondaryValue,
  secondaryValueClassName,
  icon: Icon,
  iconClassName,
  valueClassName,
  onClick,
  headerAction,
  className,
}: KpiCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      className={cn(
        // Base styles matching Demo
        'relative rounded-xl border border-border bg-card p-4',
        // Subtle gradient overlay
        'bg-gradient-to-br from-card to-card/80',
        // Shadow for elevation
        'shadow-sm',
        // Hover states for clickable cards
        isClickable && [
          'cursor-pointer',
          'transition-all duration-200',
          'hover:bg-muted/30 hover:border-primary/40',
          'hover:shadow-md hover:shadow-primary/5',
          'active:scale-[0.98]',
        ],
        className
      )}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
    >
      {/* Header row with label and optional icon/action */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {headerAction && (
            <div 
              data-header-action 
              onClick={(e) => e.stopPropagation()}
              className="z-10"
            >
              {headerAction}
            </div>
          )}
          {Icon && (
            <Icon className={cn('h-4 w-4 text-muted-foreground', iconClassName)} />
          )}
        </div>
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-2">
        <span className={cn('text-xl md:text-2xl font-bold tracking-tight', valueClassName)}>
          {value}
        </span>
        {trend && (
          <span className={cn(
            'text-xs font-medium flex items-center gap-0.5',
            trendUp ? 'text-success' : 'text-destructive'
          )}>
            {trendUp ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trend}
          </span>
        )}
      </div>

      {/* Optional subtitle */}
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}

      {/* Secondary attributed value */}
      {secondaryValue !== undefined && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              {secondaryLabel ?? 'Attributed'}
            </span>
            <span className={cn('text-sm font-semibold', secondaryValueClassName)}>
              {secondaryValue}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
