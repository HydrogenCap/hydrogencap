import { useState } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProperties } from '@/hooks/useProperties';
import {
  usePortfolioTimeline,
  prepareTimelineNarrativeData,
  type TimelineFilters,
} from '@/hooks/usePortfolioTimeline';
import {
  TimelineControls,
  TimelineEventCard,
  TimelineSummaryRail,
  TimelineNarrative,
} from '@/components/timeline';

export default function Timeline() {
  const { data: properties, isLoading: propertiesLoading } = useProperties();

  const [filters, setFilters] = useState<TimelineFilters>({
    dateRange: 'all',
    categories: [],
    viewMode: 'gross',
  });

  const { events, groupedEvents, currentSnapshot, totalEvents } = usePortfolioTimeline({
    properties,
    filters,
  });

  const narrativeData = properties && events.length > 0
    ? prepareTimelineNarrativeData(properties, events, currentSnapshot)
    : '';

  if (propertiesLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Portfolio Timeline</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Track how your portfolio has evolved over time
          </p>
        </div>

        {/* AI Narrative */}
        <TimelineNarrative
          narrativeData={narrativeData}
          isDataReady={!!properties?.length && events.length > 0}
        />

        {/* Controls */}
        <TimelineControls
          filters={filters}
          onFiltersChange={setFilters}
          totalEvents={totalEvents}
        />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Timeline */}
          <div className="lg:col-span-3">
            {events.length === 0 ? (
              <div className="text-center py-16 bg-muted/30 rounded-lg border border-dashed">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No events found</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {filters.categories.length > 0
                    ? 'Try clearing the category filters to see more events.'
                    : 'Add properties with purchase dates to see your portfolio timeline.'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-400px)] pr-4">
                <div className="space-y-8">
                  {groupedEvents.map(group => (
                    <div key={group.key}>
                      {/* Month/Year Separator */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-sm font-medium text-muted-foreground px-3 py-1 bg-muted rounded-full">
                          {group.label}
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>

                      {/* Events in this month */}
                      <div className="space-y-3 relative">
                        {/* Timeline line */}
                        <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />

                        {group.events.map((event, idx) => (
                          <div key={event.id} className="relative pl-14">
                            {/* Timeline dot */}
                            <div className="absolute left-[22px] top-4 w-2 h-2 rounded-full bg-primary ring-4 ring-background" />
                            <TimelineEventCard
                              event={event}
                              showSnapshot={idx === 0 && event.type === 'acquisition'}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Summary Rail */}
          <div className="hidden lg:block">
            <TimelineSummaryRail
              snapshot={currentSnapshot}
              viewMode={filters.viewMode}
              isLoading={propertiesLoading}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
