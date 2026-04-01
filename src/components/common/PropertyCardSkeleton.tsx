import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PropertyCardSkeletonProps {
  className?: string;
}

export function PropertyCardSkeleton({ className }: PropertyCardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card shadow-sm overflow-hidden',
        className,
      )}
    >
      {/* Image placeholder */}
      <Skeleton className="h-32 w-full rounded-none" />
      {/* Content area */}
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
