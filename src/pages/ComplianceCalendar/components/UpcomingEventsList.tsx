import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/hooks/useCalendarEvents';
import { EVENT_TYPE_CONFIG, getEventIcon } from '../utils/calendarConfig';

interface Props {
  upcomingEvents: CalendarEvent[];
  handleExpiryClick: (event: CalendarEvent) => void;
}

export function UpcomingEventsList({ upcomingEvents, handleExpiryClick }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Upcoming Events</CardTitle>
        <CardDescription>Next 12 months (filtered)</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[450px]">
          <div className="space-y-2 p-4 pt-0">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No upcoming events
              </p>
            ) : (
              upcomingEvents.map(event => {
                const typeConfig = EVENT_TYPE_CONFIG[event.eventType];
                const Icon = event.complianceType ? getEventIcon(event.complianceType) : typeConfig.icon;
                const isComplianceEvent = event.eventType === 'compliance';
                return isComplianceEvent ? (
                  <button
                    key={event.id}
                    onClick={() => handleExpiryClick(event)}
                    className="block w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={cn(
                          'p-1.5 rounded',
                          event.urgency === 'overdue' ? 'bg-destructive/10 text-destructive' :
                          event.urgency === 'urgent' ? 'bg-amber-500/10 text-amber-600' :
                          typeConfig.bgColor
                        )}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{event.propertyAddress.split(',')[0]}</p>
                          <p className="text-xs text-muted-foreground">{event.title}</p>
                        </div>
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
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {format(event.date, 'dd MMM yyyy')}
                    </div>
                  </button>
                ) : (
                  <Link
                    key={event.id}
                    to={event.eventType === 'job' && event.relatedJobId
                      ? `/jobs/${event.relatedJobId}`
                      : `/properties/${event.propertyId}?tab=${event.eventType === 'mortgage' ? 'finance' : 'compliance'}`}
                    className="block p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={cn(
                          'p-1.5 rounded',
                          event.urgency === 'overdue' ? 'bg-destructive/10 text-destructive' :
                          event.urgency === 'urgent' ? 'bg-amber-500/10 text-amber-600' :
                          typeConfig.bgColor
                        )}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{event.propertyAddress.split(',')[0]}</p>
                          <p className="text-xs text-muted-foreground">{event.title}</p>
                        </div>
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
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {format(event.date, 'dd MMM yyyy')}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
