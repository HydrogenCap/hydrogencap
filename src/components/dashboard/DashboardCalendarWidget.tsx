import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, eachDayOfInterval, isToday } from 'date-fns';
import { CalendarCheck, ChevronRight, Shield, Wrench, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCalendarEvents, type CalendarEvent, type CalendarEventType } from '@/hooks/useCalendarEvents';

const EVENT_ICONS: Record<CalendarEventType, React.ElementType> = {
  compliance: Shield,
  job: Wrench,
  mortgage: Percent,
};

const EVENT_COLORS: Record<string, string> = {
  overdue: 'bg-destructive',
  urgent: 'bg-amber-500',
  warning: 'bg-yellow-500',
  scheduled: 'bg-blue-500',
  upcoming: 'bg-emerald-500',
  normal: 'bg-primary',
};

export function DashboardCalendarWidget() {
  const { events, isLoading } = useCalendarEvents();

  // Next 30 days of events + any overdue
  const upcomingEvents = useMemo(() => {
    const cutoff = addDays(new Date(), 30);
    return events
      .filter(e => e.date <= cutoff || e.daysUntil < 0)
      .sort((a, b) => {
        if (a.daysUntil < 0 && b.daysUntil >= 0) return -1;
        if (b.daysUntil < 0 && a.daysUntil >= 0) return 1;
        return a.date.getTime() - b.date.getTime();
      })
      .slice(0, 12);
  }, [events]);

  // Mini calendar strip — next 14 days
  const calendarDays = useMemo(() => {
    const today = new Date();
    return eachDayOfInterval({
      start: today,
      end: addDays(today, 13),
    });
  }, []);

  // Events by date for the mini strip
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(event => {
      const key = format(event.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    });
    return map;
  }, [events]);

  // Summary counts
  const overdue = events.filter(e => e.daysUntil < 0).length;
  const thisWeek = events.filter(e => e.daysUntil >= 0 && e.daysUntil <= 7).length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      overdue > 0 && 'border-destructive/30'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Upcoming Deadlines
          </CardTitle>
          <Link to="/compliance-calendar">
            <Button variant="ghost" size="sm" className="text-xs">
              Full Calendar
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        {/* Summary badges */}
        <div className="flex gap-2 mt-1">
          {overdue > 0 && (
            <Badge variant="destructive" className="text-xs">
              {overdue} overdue
            </Badge>
          )}
          {thisWeek > 0 && (
            <Badge variant="secondary" className="text-xs">
              {thisWeek} this week
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mini 14-day calendar strip */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day labels */}
          {calendarDays.slice(0, 7).map(day => (
            <div key={`label-${format(day, 'E')}`} className="text-center text-[10px] text-muted-foreground font-medium">
              {format(day, 'EEE')}
            </div>
          ))}
          {/* Day cells — 2 rows of 7 */}
          {calendarDays.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateKey) || [];
            const hasOverdue = dayEvents.some(e => e.urgency === 'overdue');
            const hasUrgent = dayEvents.some(e => e.urgency === 'urgent');
            const today = isToday(day);

            return (
              <Tooltip key={dateKey}>
                <TooltipTrigger asChild>
                  <div className={cn(
                    'aspect-square rounded flex flex-col items-center justify-center text-xs cursor-default transition-colors',
                    today && 'ring-1 ring-primary font-bold',
                    dayEvents.length > 0 && !hasOverdue && !hasUrgent && 'bg-primary/10',
                    hasUrgent && !hasOverdue && 'bg-amber-500/15',
                    hasOverdue && 'bg-destructive/10',
                  )}>
                    <span className={cn(
                      'text-[11px]',
                      today && 'text-primary'
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map(e => (
                          <div
                            key={e.id}
                            className={cn('w-1 h-1 rounded-full', EVENT_COLORS[e.urgency])}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                {dayEvents.length > 0 && (
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <p className="font-medium">{format(day, 'dd MMM yyyy')}</p>
                      {dayEvents.map(e => (
                        <p key={e.id}>{e.title} — {e.propertyAddress.split(',')[0]}</p>
                      ))}
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        {/* Upcoming events list */}
        {upcomingEvents.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No upcoming deadlines — all clear
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {upcomingEvents.map(event => {
              const Icon = EVENT_ICONS[event.eventType];
              return (
                <Link
                  key={event.id}
                  to={event.eventType === 'job' && event.relatedJobId
                    ? `/jobs/${event.relatedJobId}`
                    : `/properties/${event.propertyId}?tab=${event.eventType === 'mortgage' ? 'finance' : 'compliance'}`}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                >
                  <div className={cn(
                    'p-1.5 rounded shrink-0',
                    event.urgency === 'overdue' ? 'bg-destructive/10 text-destructive' :
                    event.urgency === 'urgent' ? 'bg-amber-500/10 text-amber-600' :
                    'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {event.propertyAddress.split(',')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.title}
                    </p>
                  </div>
                  <Badge
                    variant={event.urgency === 'overdue' ? 'destructive' : event.urgency === 'urgent' ? 'secondary' : 'outline'}
                    className="shrink-0 text-[10px]"
                  >
                    {event.daysUntil < 0
                      ? `${Math.abs(event.daysUntil)}d overdue`
                      : event.daysUntil === 0
                        ? 'Today'
                        : `${event.daysUntil}d`}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
