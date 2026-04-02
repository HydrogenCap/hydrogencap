import { cn } from '@/lib/utils';
import { SEVERITY, type SeverityLevel } from '@/lib/design-tokens';

interface StatusDotProps {
  severity: SeverityLevel;
  className?: string;
  pulse?: boolean;
}

export function StatusDot({ severity, className, pulse = false }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        SEVERITY[severity].dot,
        pulse && 'animate-pulse',
        className
      )}
      role="img"
      aria-label={`Status: ${severity}`}
    />
  );
}
