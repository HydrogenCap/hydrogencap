import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getExplainer, type KpiExplainer } from '@/lib/kpi/explainers';

interface KpiBreakdownPopoverProps {
  /** Lookup id in KPI_EXPLAINERS, or pass an inline explainer */
  explainerId?: string;
  explainer?: KpiExplainer;
  /** Live value to display at top */
  currentValue?: string;
  className?: string;
}

const toneClass: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-success/15 text-success border-success/30',
  warn: 'bg-warning/15 text-warning border-warning/30',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
};

/**
 * Small "i" button that opens a popover explaining what a KPI means,
 * how it is calculated, and what benchmarks apply. Designed to be passed
 * to KpiCard's `headerAction` prop.
 */
export function KpiBreakdownPopover({
  explainerId,
  explainer,
  currentValue,
  className,
}: KpiBreakdownPopoverProps) {
  const data = explainer ?? (explainerId ? getExplainer(explainerId) : undefined);
  if (!data) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`How ${data.label} is calculated`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground',
            'hover:bg-muted/80 hover:text-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {data.label}
          </div>
          {currentValue && (
            <div className="kpi-number text-2xl font-bold tracking-tight mt-0.5">
              {currentValue}
            </div>
          )}
        </div>

        <p className="text-sm text-foreground">{data.what}</p>

        <div className="rounded-md bg-muted/40 border border-border p-2 font-mono text-xs">
          {data.formula}
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Inputs
          </div>
          <ul className="space-y-1.5">
            {data.inputs.map((i) => (
              <li key={i.label} className="text-xs">
                <span className="font-medium text-foreground">{i.label}</span>
                <span className="text-muted-foreground"> — {i.description}</span>
              </li>
            ))}
          </ul>
        </div>

        {data.benchmarks && data.benchmarks.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Benchmarks
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.benchmarks.map((b) => (
                <Badge
                  key={b.label}
                  variant="outline"
                  className={cn('text-[11px] font-medium', toneClass[b.tone])}
                >
                  {b.label}: {b.range}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {data.notes && (
          <p className="text-[11px] text-muted-foreground italic">{data.notes}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
