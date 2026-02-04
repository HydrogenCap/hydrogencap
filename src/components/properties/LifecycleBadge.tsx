import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type LifecycleType = 'development' | 'core_rental';

const LIFECYCLE_CONFIG: Record<LifecycleType, { label: string; className: string }> = {
  development: {
    label: 'Development',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  core_rental: {
    label: 'Investment',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
};

interface LifecycleBadgeProps {
  lifecycle: string | null | undefined;
  compact?: boolean;
}

export function LifecycleBadge({ lifecycle, compact = false }: LifecycleBadgeProps) {
  const type = (lifecycle as LifecycleType) || 'development';
  const config = LIFECYCLE_CONFIG[type] || LIFECYCLE_CONFIG.development;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        'font-medium',
        config.className,
        compact && 'text-xs px-1.5 py-0'
      )}
    >
      {config.label}
    </Badge>
  );
}
