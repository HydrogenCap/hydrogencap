import { cn } from '@/lib/utils';

interface KPIStatProps {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function KPIStat({ label, value, trend, trendUp, className }: KPIStatProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl md:text-3xl font-bold">{value}</span>
        {trend && (
          <span
            className={cn(
              'text-xs font-medium',
              trendUp ? 'text-success' : 'text-destructive'
            )}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
