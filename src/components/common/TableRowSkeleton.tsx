import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TableRowSkeletonProps {
  columns?: number;
  rows?: number;
  className?: string;
}

export function TableRowSkeleton({ columns = 5, rows = 5, className }: TableRowSkeletonProps) {
  return (
    <div className={cn('w-full space-y-2', className)}>
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`${r}-${c}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
