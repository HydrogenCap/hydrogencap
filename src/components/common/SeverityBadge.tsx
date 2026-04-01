import { cn } from '@/lib/utils';
import { SEVERITY, type SeverityLevel } from '@/lib/design-tokens';

interface SeverityBadgeProps {
  severity: SeverityLevel;
  children: React.ReactNode;
  className?: string;
}

export function SeverityBadge({ severity, children, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        SEVERITY[severity].badge,
        className
      )}
    >
      {children}
    </span>
  );
}
