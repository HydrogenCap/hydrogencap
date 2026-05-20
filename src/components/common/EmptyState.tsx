import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Visual size — 'sm' for inline use, 'md' for full-section. */
  size?: 'sm' | 'md';
}

/**
 * Reusable empty-state pattern: icon, title, supporting copy, optional CTA.
 * Use whenever a list/grid/tab has no content to show.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'rounded-lg border border-dashed bg-muted/20',
        size === 'sm' ? 'py-8 px-4' : 'py-12 px-6',
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground mb-3',
            size === 'sm' ? 'h-9 w-9' : 'h-12 w-12',
          )}
        >
          <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
        </span>
      )}
      <h3 className={cn('font-semibold text-foreground', size === 'sm' ? 'text-sm' : 'text-base')}>
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            'text-muted-foreground mt-1 max-w-md',
            size === 'sm' ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
