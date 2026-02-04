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
    base: 'bg-gradient-to-br from-secondary to-muted border-border',
    active: 'ring-2 ring-offset-2 ring-offset-background ring-primary border-primary',
    hover: 'hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-muted/20',
    iconColor: 'text-muted-foreground',
    numberColor: 'text-foreground',
    labelColor: 'text-muted-foreground',
  },
  valid: {
    icon: CheckCircle2,
    base: 'bg-gradient-to-br from-green-950/40 to-green-900/20 border-green-800/50',
    active: 'ring-2 ring-offset-2 ring-offset-background ring-green-500 border-green-500',
    hover: 'hover:border-green-600 hover:shadow-lg hover:shadow-green-900/30',
    iconColor: 'text-green-500/30',
    numberColor: 'text-green-400',
    labelColor: 'text-green-400/80',
  },
  expiring: {
    icon: Clock,
    base: 'bg-gradient-to-br from-amber-950/40 to-amber-900/20 border-amber-800/50',
    active: 'ring-2 ring-offset-2 ring-offset-background ring-amber-500 border-amber-500',
    hover: 'hover:border-amber-600 hover:shadow-lg hover:shadow-amber-900/30',
    iconColor: 'text-amber-500/30',
    numberColor: 'text-amber-400',
    labelColor: 'text-amber-400/80',
  },
  expired: {
    icon: AlertTriangle,
    base: 'bg-gradient-to-br from-red-950/40 to-red-900/20 border-red-800/50',
    active: 'ring-2 ring-offset-2 ring-offset-background ring-red-500 border-red-500',
    hover: 'hover:border-red-600 hover:shadow-lg hover:shadow-red-900/30',
    iconColor: 'text-red-500/30',
    numberColor: 'text-red-400',
    labelColor: 'text-red-400/80',
  },
  unknown: {
    icon: LayoutGrid,
    base: 'bg-gradient-to-br from-muted to-secondary border-border',
    active: 'ring-2 ring-offset-2 ring-offset-background ring-muted-foreground border-muted-foreground',
    hover: 'hover:border-muted-foreground/70 hover:shadow-lg hover:shadow-muted/20',
    iconColor: 'text-muted-foreground/30',
    numberColor: 'text-muted-foreground',
    labelColor: 'text-muted-foreground/80',
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
          variant === 'valid' && 'bg-green-500',
          variant === 'expiring' && 'bg-amber-500',
          variant === 'expired' && 'bg-red-500',
          variant === 'total' && 'bg-primary',
          variant === 'unknown' && 'bg-muted-foreground'
        )} />
      )}
    </button>
  );
}
