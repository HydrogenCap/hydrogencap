import { cn } from '@/lib/utils';
import { LayoutGrid, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface StatusFilterBoxProps {
  label: string;
  count: number;
  variant: 'total' | 'valid' | 'expiring' | 'expired' | 'unknown';
  isActive: boolean;
  onClick: () => void;
}

const variantConfig = {
  total: {
    icon: LayoutGrid,
    base: 'bg-card border-border',
    active: 'ring-2 ring-offset-2 ring-offset-background ring-primary border-primary',
    hover: 'hover:border-muted-foreground/50 hover:shadow-md',
    iconColor: 'text-muted-foreground/30',
    numberColor: 'text-foreground',
    labelColor: 'text-muted-foreground',
    indicator: 'bg-primary',
  },
  valid: {
    icon: CheckCircle2,
    base: 'bg-card border-success/30',
    active: 'ring-2 ring-offset-2 ring-offset-background ring-success border-success',
    hover: 'hover:border-success/60 hover:shadow-md',
    iconColor: 'text-success/20',
    numberColor: 'text-success',
    labelColor: 'text-success/80',
    indicator: 'bg-success',
  },
  expiring: {
    icon: Clock,
    base: 'bg-card border-warning/30',
    active: 'ring-2 ring-offset-2 ring-offset-background ring-warning border-warning',
    hover: 'hover:border-warning/60 hover:shadow-md',
    iconColor: 'text-warning/20',
    numberColor: 'text-warning',
    labelColor: 'text-warning/80',
    indicator: 'bg-warning',
  },
  expired: {
    icon: AlertTriangle,
    base: 'bg-card border-destructive/30',
    active: 'ring-2 ring-offset-2 ring-offset-background ring-destructive border-destructive',
    hover: 'hover:border-destructive/60 hover:shadow-md',
    iconColor: 'text-destructive/20',
    numberColor: 'text-destructive',
    labelColor: 'text-destructive/80',
    indicator: 'bg-destructive',
  },
  unknown: {
    icon: LayoutGrid,
    base: 'bg-card border-border',
    active: 'ring-2 ring-offset-2 ring-offset-background ring-muted-foreground border-muted-foreground',
    hover: 'hover:border-muted-foreground/70 hover:shadow-md',
    iconColor: 'text-muted-foreground/20',
    numberColor: 'text-muted-foreground',
    labelColor: 'text-muted-foreground/80',
    indicator: 'bg-muted-foreground',
  },
};

export function StatusFilterBox({ label, count, variant, isActive, onClick }: StatusFilterBoxProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-start justify-between min-h-[120px] lg:min-h-[140px] p-5 lg:p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer overflow-hidden',
        'hover:scale-[1.02] active:scale-[0.98]',
        config.base,
        config.hover,
        isActive && config.active
      )}
    >
      {/* Background icon */}
      <div className="absolute top-4 right-4 transition-all duration-200 group-hover:scale-110">
        <Icon className={cn('h-10 w-10 lg:h-12 lg:w-12', config.iconColor)} />
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-start">
        <span className={cn(
          'text-3xl lg:text-4xl font-bold tracking-tight mb-1',
          config.numberColor
        )}>
          {count}
        </span>
        <span className={cn(
          'text-sm lg:text-base font-medium',
          config.labelColor
        )}>
          {label}
        </span>
      </div>
      
      {/* Active indicator line */}
      {isActive && (
        <div className={cn(
          'absolute bottom-0 left-0 right-0 h-1',
          config.indicator
        )} />
      )}
    </button>
  );
}
