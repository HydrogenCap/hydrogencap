import { useState } from 'react';
import {
  FileCheck,
  PoundSterling,
  TrendingUp,
  FileText,
  Activity,
  Rocket,
  Clock,
} from 'lucide-react';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { SEVERITY, type SeverityLevel } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

interface PropertyTimelineProps {
  propertyId: string;
}

const ENTRY_CONFIG: Record<string, { icon: React.ElementType; severity: SeverityLevel }> = {
  property_created: { icon: Activity, severity: 'info' },
  property_updated: { icon: FileText, severity: 'neutral' },
  valuation_changed: { icon: TrendingUp, severity: 'info' },
  mortgage_updated: { icon: PoundSterling, severity: 'info' },
  rate_changed: { icon: TrendingUp, severity: 'warning' },
  income_updated: { icon: PoundSterling, severity: 'success' },
  costs_updated: { icon: PoundSterling, severity: 'warning' },
  document_uploaded: { icon: FileCheck, severity: 'info' },
  document_accepted: { icon: FileCheck, severity: 'success' },
  note_added: { icon: FileText, severity: 'neutral' },
  manual: { icon: Activity, severity: 'neutral' },
  go_live: { icon: Rocket, severity: 'success' },
};

const DEFAULT_CONFIG = { icon: Activity, severity: 'neutral' as SeverityLevel };

function getConfig(entryType: string) {
  return ENTRY_CONFIG[entryType] || DEFAULT_CONFIG;
}

export function PropertyTimeline({ propertyId }: PropertyTimelineProps) {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useActivityLog(propertyId, { page, pageSize });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const items = data?.items ?? [];
  const hasMore = data ? data.page < data.totalPages : false;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No activity yet"
        description="Events like compliance updates, rent payments, and value changes will appear here."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" /> Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {items.map((item, i) => {
              const config = getConfig(item.entry_type);
              const Icon = config.icon;
              const isLast = i === items.length - 1;

              return (
                <div key={item.id} className="relative flex gap-3 pl-0">
                  {/* Icon circle */}
                  <div
                    className={cn(
                      'relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-background',
                      SEVERITY[config.severity].bg
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', SEVERITY[config.severity].text)} />
                  </div>

                  {/* Content */}
                  <div className={cn('flex-1 min-w-0 pb-4', isLast && 'pb-0')}>
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    {item.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      {' \u00b7 '}
                      {format(new Date(item.created_at), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {hasMore && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
              Load more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
