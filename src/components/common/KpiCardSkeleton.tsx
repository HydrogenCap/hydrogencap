import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface KpiCardSkeletonProps {
  showDelta?: boolean;
  className?: string;
}

export function KpiCardSkeleton({ showDelta = true, className }: KpiCardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-sm space-y-2',
        className,
      )}
      aria-busy="true"
      aria-label="Loading metric"
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-32" />
      {showDelta && <Skeleton className="h-3 w-14" />}
    </div>
  );
}
