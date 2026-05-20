import React, { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export type EmptyStateVariant = 'default' | 'success' | 'warning' | 'destructive';

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  children?: ReactNode;
  className?: string;
  /** Visual size — 'sm' for inline use, 'md' for full-section. */
  size?: 'sm' | 'md';
  /** Tone of the icon chip & subtle background. */
  variant?: EmptyStateVariant;
}

const variantStyles: Record<EmptyStateVariant, { chip: string; icon: string }> = {
  default: { chip: 'bg-muted text-muted-foreground', icon: 'text-muted-foreground' },
  success: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: 'text-emerald-600 dark:text-emerald-400' },
  warning: { chip: 'bg-warning/10 text-warning', icon: 'text-warning' },
  destructive: { chip: 'bg-destructive/10 text-destructive', icon: 'text-destructive' },
};

/**
 * Reusable empty-state pattern: icon, title, supporting copy, optional CTA.
 * Use whenever a list/grid/tab has no content to show.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
  size = 'md',
  variant = 'default',
}: EmptyStateProps) {
  const navigate = useNavigate();
  const tone = variantStyles[variant];

  const handle = (a: EmptyStateAction) => {
    if (a.onClick) a.onClick();
    else if (a.href) navigate(a.href);
  };

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
            'inline-flex items-center justify-center rounded-full mb-3',
            tone.chip,
            size === 'sm' ? 'h-9 w-9' : 'h-12 w-12',
          )}
        >
          <Icon className={cn(tone.icon, size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')} />
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
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button onClick={() => handle(action)} size={size === 'sm' ? 'sm' : 'default'}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              size={size === 'sm' ? 'sm' : 'default'}
              onClick={() => handle(secondaryAction)}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
      {children && <div className="mt-4 w-full">{children}</div>}
    </div>
  );
}
