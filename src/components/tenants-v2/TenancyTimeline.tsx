/**
 * Tenancy Timeline Component (AA4a)
 * Horizontal visual timeline for a single tenancy showing key dates.
 */
import { useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';

interface TenancyTimelineProps {
  startDate: string;
  endDate: string | null;
  breakClauseDate?: string | null;
  lastRentReviewDate?: string | null;
}

interface TimelineMarker {
  date: Date;
  label: string;
  type: 'start' | 'end' | 'break' | 'review' | 'today';
  status: 'passed' | 'upcoming' | 'action_required' | 'overdue';
}

export function TenancyTimeline({ startDate, endDate, breakClauseDate, lastRentReviewDate }: TenancyTimelineProps) {
  const markers = useMemo(() => {
    const now = new Date();
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    const result: TimelineMarker[] = [];

    result.push({
      date: start,
      label: `Start: ${format(start, 'dd MMM yyyy')}`,
      type: 'start',
      status: 'passed',
    });

    if (breakClauseDate) {
      const breakD = new Date(breakClauseDate);
      const daysUntil = differenceInDays(breakD, now);
      result.push({
        date: breakD,
        label: `Break clause: ${format(breakD, 'dd MMM yyyy')}`,
        type: 'break',
        status: daysUntil < 0 ? 'passed' : daysUntil <= 60 ? 'action_required' : 'upcoming',
      });
    }

    if (end) {
      const daysUntil = differenceInDays(end, now);
      result.push({
        date: end,
        label: `End: ${format(end, 'dd MMM yyyy')}`,
        type: 'end',
        status: daysUntil < 0 ? 'overdue' : daysUntil <= 60 ? 'action_required' : 'upcoming',
      });
    }

    // Sort by date
    result.sort((a, b) => a.date.getTime() - b.date.getTime());
    return result;
  }, [startDate, endDate, breakClauseDate]);

  const now = new Date();
  const timelineStart = markers[0]?.date || now;
  const timelineEnd = markers[markers.length - 1]?.date || now;
  const totalDays = Math.max(differenceInDays(timelineEnd, timelineStart), 1);
  const todayPosition = Math.max(0, Math.min(100, (differenceInDays(now, timelineStart) / totalDays) * 100));

  const statusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'bg-muted-foreground';
      case 'upcoming': return 'bg-primary';
      case 'action_required': return 'bg-warning';
      case 'overdue': return 'bg-destructive';
      default: return 'bg-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Tenancy Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-12 mt-2">
          {/* Track */}
          <div className="absolute top-5 left-0 right-0 h-1 bg-border rounded-full" />
          
          {/* Today marker */}
          <div
            className="absolute top-2 w-0.5 h-8 bg-foreground/60 z-10"
            style={{ left: `${todayPosition}%` }}
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
              Today
            </span>
          </div>

          {/* Event markers */}
          <TooltipProvider>
            {markers.map((marker, i) => {
              const position = (differenceInDays(marker.date, timelineStart) / totalDays) * 100;
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'absolute top-3 w-3.5 h-3.5 rounded-full border-2 border-background z-20 cursor-pointer transition-transform hover:scale-125',
                        statusColor(marker.status)
                      )}
                      style={{ left: `calc(${position}% - 7px)` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-medium">{marker.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted-foreground" /> Passed</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /> Upcoming</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-warning" /> Action needed</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> Overdue</div>
        </div>
      </CardContent>
    </Card>
  );
}
