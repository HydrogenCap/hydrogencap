import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  /** Action buttons (use small variants). */
  children?: React.ReactNode;
  className?: string;
  itemLabel?: string;
}

/**
 * Floating bulk-action bar that appears at the bottom of the viewport
 * whenever rows are selected. Place once near the list; it stays fixed.
 */
export function BulkActionBar({
  count,
  onClear,
  children,
  className,
  itemLabel = 'item',
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-40',
        'flex items-center gap-3 rounded-xl border border-border bg-card shadow-lg',
        'px-3 py-2 max-w-[calc(100vw-2rem)]',
        'animate-in slide-in-from-bottom-2 fade-in',
        className,
      )}
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={onClear}
        aria-label="Clear selection"
        className="h-8 w-8"
      >
        <X className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium whitespace-nowrap">
        {count} {itemLabel}
        {count === 1 ? '' : 's'} selected
      </span>
      <div className="h-6 w-px bg-border" />
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}
