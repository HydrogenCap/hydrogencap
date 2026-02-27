import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DualKpiCardProps {
  label: string;
  grossValue: string;
  attrValue: string;
  groupParentName: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  grossClassName?: string;
  attrClassName?: string;
  onClick?: () => void;
  headerAction?: React.ReactNode;
  className?: string;
}

export function DualKpiCard({
  label,
  grossValue,
  attrValue,
  groupParentName,
  subtitle,
  icon: Icon,
  iconClassName,
  grossClassName,
  attrClassName,
  onClick,
  headerAction,
  className,
}: DualKpiCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      className={cn(
        'relative rounded-xl border border-border bg-card p-4',
        'bg-gradient-to-br from-card to-card/80',
        'shadow-sm',
        isClickable && [
          'cursor-pointer transition-all duration-200',
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
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
      } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
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
          {Icon && <Icon className={cn('h-4 w-4 text-muted-foreground', iconClassName)} />}
        </div>
      </div>

      {/* Dual values */}
      <div className="grid grid-cols-2 gap-3">
        {/* Gross */}
        <div>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Gross
          </span>
          <div className={cn('text-xl font-bold tracking-tight', grossClassName)}>
            {grossValue}
          </div>
        </div>

        {/* Attributable */}
        <div className="border-l border-border pl-3">
          <span className="text-[10px] font-medium text-primary/70 uppercase tracking-wider truncate block">
            {groupParentName}
          </span>
          <div className={cn('text-xl font-bold tracking-tight', attrClassName)}>
            {attrValue}
          </div>
        </div>
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
      )}
    </div>
  );
}
