import { Link } from 'react-router-dom';
import { format, isSameMonth, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/hooks/useCalendarEvents';
import { EVENT_TYPE_CONFIG, getEventColor, getEventIcon } from '../utils/calendarConfig';

interface Props {
  currentMonth: Date;
  paddedDays: (Date | null)[];
  filteredEventsByDate: Map<string, CalendarEvent[]>;
  isInRenewalWindow: (day: Date) => boolean;
  handleExpiryClick: (event: CalendarEvent) => void;
  navigateMonth: (delta: number) => void;
  setCurrentMonth: (d: Date) => void;
}

export function CalendarGrid({
  currentMonth, paddedDays, filteredEventsByDate, isInRenewalWindow,
  handleExpiryClick, navigateMonth, setCurrentMonth,
}: Props) {
  return (
    <Card className="lg:col-span-3">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next month" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {paddedDays.map((day, idx) => {
            if (!day) {
              return <div key={`pad-${idx}`} className="h-24 bg-muted/20 rounded" />;
            }

            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = filteredEventsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);
            const hasOverdue = dayEvents.some(e => e.urgency === 'overdue');
            const hasUrgent = dayEvents.some(e => e.urgency === 'urgent');
            const inRenewalWindow = isInRenewalWindow(day);

            return (
              <div
                key={dateKey}
                className={cn(
                  'h-24 p-1 rounded border transition-colors cursor-pointer hover:bg-muted/50',
                  isCurrentMonth ? 'bg-card' : 'bg-muted/30',
                  isCurrentDay && 'border-primary ring-1 ring-primary/30',
                  hasOverdue && 'border-destructive/50 bg-destructive/5',
                  !hasOverdue && hasUrgent && 'border-amber-500/50',
                  !hasOverdue && !hasUrgent && inRenewalWindow && 'bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-800/30'
                )}
              >
                <div className={cn(
                  'text-xs font-medium mb-1 flex items-center gap-1',
                  isCurrentDay && 'text-primary',
                  !isCurrentMonth && 'text-muted-foreground'
                )}>
                  {format(day, 'd')}
                  {inRenewalWindow && !hasOverdue && !hasUrgent && (
                    <RefreshCw className="h-2.5 w-2.5 text-green-500" />
                  )}
                </div>

                <div className="space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 2).map(event => {
                    const typeConfig = EVENT_TYPE_CONFIG[event.eventType];
                    const Icon = event.complianceType ? getEventIcon(event.complianceType) : typeConfig.icon;
                    const isComplianceEvent = event.eventType === 'compliance';
                    return (
                      <Tooltip key={event.id}>
                        <TooltipTrigger asChild>
                          {isComplianceEvent ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExpiryClick(event); }}
                              className={cn(
                                'flex items-center gap-1 text-[10px] px-1 py-0.5 rounded truncate text-white w-full text-left',
                                getEventColor(event)
                              )}
                            >
                              <Icon className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{event.propertyAddress.split(',')[0]}</span>
                            </button>
                          ) : (
                            <Link
                              to={event.eventType === 'job' && event.relatedJobId
                                ? `/jobs/${event.relatedJobId}`
                                : `/properties/${event.propertyId}?tab=${event.eventType === 'mortgage' ? 'finance' : 'compliance'}`}
                              className={cn(
                                'flex items-center gap-1 text-[10px] px-1 py-0.5 rounded truncate text-white',
                                getEventColor(event)
                              )}
                            >
                              <Icon className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{event.propertyAddress.split(',')[0]}</span>
                            </Link>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <p className="font-medium">{event.propertyAddress}</p>
                            <p>{event.title}</p>
                            <p className="text-muted-foreground">
                              {event.daysUntil < 0
                                ? `${Math.abs(event.daysUntil)} days overdue`
                                : event.daysUntil === 0
                                  ? 'Today'
                                  : `In ${event.daysUntil} days`}
                            </p>
                            {isComplianceEvent && (
                              <p className="text-primary font-medium mt-1">Click to start renewal</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
