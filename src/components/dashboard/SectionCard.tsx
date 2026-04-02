import React, { ReactNode } from 'react';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  showArrow?: boolean;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
}

/**
 * Section Card component matching the Demo dashboard styling.
 * Used for major content blocks with consistent header styling.
 */
export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  headerAction,
  children,
  onClick,
  showArrow = false,
  className,
  contentClassName,
  noPadding = false,
}: SectionCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      className={cn(
        // Base card styles
        'rounded-xl border border-border bg-card',
        'bg-gradient-to-br from-card to-card/80',
        'shadow-sm overflow-hidden',
        // Clickable styles
        isClickable && [
          'cursor-pointer',
          'transition-all duration-200',
          'hover:bg-muted/20 hover:border-primary/40',
          'hover:shadow-md hover:shadow-primary/5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
      aria-label={isClickable ? `${title}${subtitle ? `: ${subtitle}` : ''}` : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <Icon className={cn('h-4 w-4 text-primary', iconClassName)} aria-hidden="true" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          {showArrow && (
            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        !noPadding && 'p-5',
        contentClassName
      )}>
        {children}
      </div>
    </div>
  );
}
