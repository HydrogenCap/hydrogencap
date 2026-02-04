import { cn } from '@/lib/utils';

interface StatusFilterBoxProps {
  label: string;
  count: number;
  variant: 'total' | 'valid' | 'expiring' | 'expired' | 'unknown';
  isActive: boolean;
  onClick: () => void;
}

const variantStyles = {
  total: {
    base: 'bg-muted/50 border-border',
    active: 'ring-2 ring-primary/50 border-primary bg-muted',
    text: 'text-foreground',
  },
  valid: {
    base: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
    active: 'ring-2 ring-green-500/50 border-green-500 bg-green-100 dark:bg-green-900/50',
    text: 'text-green-700 dark:text-green-400',
  },
  expiring: {
    base: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    active: 'ring-2 ring-amber-500/50 border-amber-500 bg-amber-100 dark:bg-amber-900/50',
    text: 'text-amber-700 dark:text-amber-400',
  },
  expired: {
    base: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    active: 'ring-2 ring-red-500/50 border-red-500 bg-red-100 dark:bg-red-900/50',
    text: 'text-red-700 dark:text-red-400',
  },
  unknown: {
    base: 'bg-gray-50 border-gray-200 dark:bg-gray-800/30 dark:border-gray-700',
    active: 'ring-2 ring-gray-500/50 border-gray-500 bg-gray-100 dark:bg-gray-800/50',
    text: 'text-gray-600 dark:text-gray-400',
  },
};

export function StatusFilterBox({ label, count, variant, isActive, onClick }: StatusFilterBoxProps) {
  const styles = variantStyles[variant];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-4 rounded-lg border transition-all cursor-pointer',
        'hover:scale-[1.02] active:scale-[0.98]',
        styles.base,
        isActive && styles.active
      )}
    >
      <span className={cn('text-2xl font-bold', styles.text)}>{count}</span>
      <span className={cn('text-sm font-medium', styles.text)}>{label}</span>
    </button>
  );
}
