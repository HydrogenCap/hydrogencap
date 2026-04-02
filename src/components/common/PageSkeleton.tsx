import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PageSkeletonProps {
  tabs?: number;
  className?: string;
}

export function PageSkeleton({ tabs, className }: PageSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)} aria-busy="true" aria-label="Loading page">
      {/* Page title */}
      <Skeleton className="h-8 w-64" />

      {/* Optional tab bar */}
      {tabs && tabs > 0 && (
        <div className="flex gap-2 border-b border-border pb-2">
          {Array.from({ length: tabs }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-md" />
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
