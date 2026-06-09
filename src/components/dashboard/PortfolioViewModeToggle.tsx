import { Users, Globe2 } from 'lucide-react';
import { usePortfolioViewMode, type PortfolioViewMode } from '@/hooks/usePortfolioViewMode';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PortfolioViewModeToggleProps {
  className?: string;
}

/**
 * Portfolio-wide toggle: "Gross" vs "My share".
 * Persists per user (profiles.portfolio_view_mode) and mirrors to
 * localStorage so subsequent loads are instant.
 */
export function PortfolioViewModeToggle({ className }: PortfolioViewModeToggleProps) {
  const { mode, setMode, isSaving, fullName, email } = usePortfolioViewMode();
  const meLabel = fullName || (email ? email.split('@')[0] : 'Me');

  const buttons: Array<{ value: PortfolioViewMode; label: string; icon: React.ElementType; tip: string }> = [
    { value: 'gross', label: 'Gross', icon: Globe2, tip: 'Full portfolio totals across every property' },
    { value: 'mine', label: 'My share', icon: Users, tip: `Weighted by your effective beneficial ownership (${meLabel})` },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Portfolio view mode"
      className={cn(
        'inline-flex items-center rounded-lg border border-border bg-card p-1 shadow-sm',
        className
      )}
    >
      {buttons.map(({ value, label, icon: Icon, tip }) => {
        const active = mode === value;
        return (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                disabled={isSaving}
                onClick={() => !active && setMode(value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{tip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
