import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export type StatusType = 'expired' | 'expiring_soon' | 'within_90' | 'valid' | 'all';

interface ComplianceStatusCardProps {
  label: string;
  count: number;
  icon: LucideIcon;
  status: StatusType;
  isActive: boolean;
  onClick: () => void;
}

const statusStyles: Record<StatusType, { border: string; bg: string; text: string; activeBorder: string }> = {
  expired: {
    border: 'border-destructive/50',
    bg: 'bg-destructive/5',
    text: 'text-destructive',
    activeBorder: 'ring-destructive',
  },
  expiring_soon: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/5',
    text: 'text-amber-600 dark:text-amber-400',
    activeBorder: 'ring-amber-500',
  },
  within_90: {
    border: 'border-yellow-500/50',
    bg: 'bg-yellow-500/5',
    text: 'text-yellow-600 dark:text-yellow-500',
    activeBorder: 'ring-yellow-500',
  },
  valid: {
    border: 'border-emerald-500/50',
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-600 dark:text-emerald-400',
    activeBorder: 'ring-emerald-500',
  },
  all: {
    border: 'border-border',
    bg: 'bg-muted/30',
    text: 'text-muted-foreground',
    activeBorder: 'ring-primary',
  },
};

export function ComplianceStatusCard({
  label,
  count,
  icon: Icon,
  status,
  isActive,
  onClick,
}: ComplianceStatusCardProps) {
  const styles = statusStyles[status];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all',
        'hover:shadow-md hover:scale-[1.02] cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        styles.border,
        styles.bg,
        isActive && `ring-2 ring-offset-2 ${styles.activeBorder}`,
        count === 0 && 'opacity-50'
      )}
    >
      <Icon className={cn('h-5 w-5 mb-1', styles.text)} />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn('text-2xl font-bold mt-0.5', count > 0 ? styles.text : 'text-muted-foreground')}>
        {count}
      </span>
    </button>
  );
}
