import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface ClickableStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
  borderClassName?: string;
  onClick?: () => void;
  disabled?: boolean;
  'aria-label'?: string;
  /** Optional toggle element to render in the header next to the icon */
  headerAction?: React.ReactNode;
}

export function ClickableStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  valueClassName,
  borderClassName,
  onClick,
  disabled = false,
  'aria-label': ariaLabel,
  headerAction,
}: ClickableStatCardProps) {
  const isClickable = !!onClick && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  // Handle click on the card, but don't trigger if clicking on the header action
  const handleCardClick = (e: React.MouseEvent) => {
    // Check if click originated from the header action area
    const target = e.target as HTMLElement;
    if (target.closest('[data-header-action]')) {
      return; // Don't trigger card click when clicking toggle
    }
    if (isClickable) {
      onClick?.();
    }
  };

  return (
    <Card
      className={cn(
        'bg-card border-border transition-all duration-200',
        borderClassName,
        isClickable && [
          'cursor-pointer',
          'hover:bg-muted/50 hover:border-primary/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'active:scale-[0.98]',
        ],
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      aria-label={ariaLabel || `View details for ${title}`}
      aria-disabled={disabled}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {headerAction && (
            <div data-header-action onClick={(e) => e.stopPropagation()}>
              {headerAction}
            </div>
          )}
          {Icon && <Icon className={cn('h-4 w-4', iconClassName)} />}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', valueClassName)}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}