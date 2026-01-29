import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/lib/calculations';

interface AttributionKPICardProps {
  title: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  tooltip?: string;
  helperText?: string;
  variant?: 'neutral' | 'positive' | 'negative' | 'highlight';
  onClick?: () => void;
}

export function AttributionKPICard({
  title,
  value,
  suffix,
  icon: Icon,
  tooltip,
  helperText,
  variant = 'neutral',
  onClick,
}: AttributionKPICardProps) {
  const variantStyles = {
    neutral: 'border-border/50',
    positive: 'border-success/30 bg-success/5',
    negative: 'border-destructive/30 bg-destructive/5',
    highlight: 'border-primary/30 bg-primary/5',
  };

  const valueStyles = {
    neutral: 'text-foreground',
    positive: 'text-success',
    negative: 'text-destructive',
    highlight: 'text-primary',
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:bg-muted/50 hover:border-primary/40 active:scale-[0.98]'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-muted/50">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </span>
          </div>
          {tooltip && (
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button className="p-1 rounded hover:bg-muted/50 transition-colors">
                    <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-sm">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className={cn('text-2xl font-bold tracking-tight', valueStyles[variant])}>
          {formatGBP(value)}
          {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
        </div>
        {helperText && (
          <p className="text-xs text-muted-foreground/70 mt-1.5">{helperText}</p>
        )}
      </CardContent>
    </Card>
  );
}
