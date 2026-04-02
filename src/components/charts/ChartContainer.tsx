import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  height?: number;
  className?: string;
  headerAction?: ReactNode;
}

export function ChartContainer({
  title,
  subtitle,
  children,
  loading = false,
  empty = false,
  emptyMessage = 'Add properties with financial data to see this chart',
  height = 280,
  className,
  headerAction,
}: ChartContainerProps) {
  return (
    <Card className={cn('bg-card border-border', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <ChartSkeleton height={height} />
        ) : empty ? (
          <ChartEmpty height={height} message={emptyMessage} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div className="space-y-3" style={{ height }}>
      <div className="flex items-end gap-2 h-full">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function ChartEmpty({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-muted-foreground gap-2"
      style={{ height }}
    >
      <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-center max-w-[240px]">{message}</p>
    </div>
  );
}
