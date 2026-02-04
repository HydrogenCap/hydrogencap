import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, differenceInDays } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Building2, Percent, ArrowUpRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/lib/calculations';
import { useProperties } from '@/hooks/useProperties';

interface MortgageEvent {
  id: string;
  propertyId: string;
  address: string;
  date: Date;
  type: 'rate_expiry' | 'refinance_target';
  lender?: string;
  currentRate?: number;
  reversionRate?: number;
  balance?: number;
  daysUntil: number;
}

export default function RefinanceCalendar() {
  const { data: properties, isLoading } = useProperties();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Extract all mortgage events
  const mortgageEvents = useMemo(() => {
    if (!properties?.length) return [];

    const events: MortgageEvent[] = [];
    const today = new Date();

    properties.forEach(property => {
      const loan = property.loans?.[0];
      if (!loan) return;

      // Fixed rate expiry
      if (loan.fixed_rate_expires) {
        const expiryDate = new Date(loan.fixed_rate_expires);
        events.push({
          id: `rate-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          date: expiryDate,
          type: 'rate_expiry',
          lender: loan.lender || undefined,
          currentRate: loan.interest_rate_percent ? Number(loan.interest_rate_percent) : undefined,
          reversionRate: loan.reversion_rate_percent ? Number(loan.reversion_rate_percent) : undefined,
          balance: loan.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : undefined,
          daysUntil: differenceInDays(expiryDate, today),
        });
      }

      // Refinance target date
      if (loan.refinance_target_date) {
        const targetDate = new Date(loan.refinance_target_date);
        events.push({
          id: `refi-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          date: targetDate,
          type: 'refinance_target',
          lender: loan.lender || undefined,
          balance: loan.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : undefined,
          daysUntil: differenceInDays(targetDate, today),
        });
      }
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [properties]);

  // Events for the current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad to start on Sunday
  const firstDayOfWeek = monthStart.getDay();
  const paddedDays = Array(firstDayOfWeek).fill(null).concat(calendarDays);

  // Group events by date for calendar display
  const eventsByDate = useMemo(() => {
    const map = new Map<string, MortgageEvent[]>();
    mortgageEvents.forEach(event => {
      const key = format(event.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    });
    return map;
  }, [mortgageEvents]);

  // Upcoming events (next 12 months)
  const upcomingEvents = useMemo(() => {
    const cutoff = addMonths(new Date(), 12);
    return mortgageEvents.filter(e => e.date >= new Date() && e.date <= cutoff);
  }, [mortgageEvents]);

  // Stats
  const stats = useMemo(() => {
    const expired = mortgageEvents.filter(e => e.daysUntil < 0 && e.type === 'rate_expiry');
    const within30 = mortgageEvents.filter(e => e.daysUntil >= 0 && e.daysUntil <= 30 && e.type === 'rate_expiry');
    const within90 = mortgageEvents.filter(e => e.daysUntil > 30 && e.daysUntil <= 90 && e.type === 'rate_expiry');
    const totalExposure = within90.reduce((sum, e) => sum + (e.balance || 0), 0) +
                          within30.reduce((sum, e) => sum + (e.balance || 0), 0);

    return { expired, within30, within90, totalExposure };
  }, [mortgageEvents]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth(prev => addMonths(prev, delta));
  };

  const getEventColor = (event: MortgageEvent) => {
    if (event.daysUntil < 0) return 'bg-destructive';
    if (event.daysUntil <= 30) return 'bg-amber-500';
    if (event.daysUntil <= 90) return 'bg-yellow-500';
    return 'bg-primary';
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Skeleton className="h-[500px]" />
            </div>
            <Skeleton className="h-[500px]" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Refinance Calendar</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Track mortgage rate expiries and refinancing deadlines
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={cn(stats.expired.length > 0 && 'border-destructive')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn('h-4 w-4', stats.expired.length > 0 ? 'text-destructive' : 'text-muted-foreground')} />
                <span className="text-sm text-muted-foreground">Expired Rates</span>
              </div>
              <p className={cn('text-2xl font-bold mt-1', stats.expired.length > 0 && 'text-destructive')}>
                {stats.expired.length}
              </p>
            </CardContent>
          </Card>

          <Card className={cn(stats.within30.length > 0 && 'border-amber-500')}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Within 30 Days</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.within30.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Within 90 Days</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.within90.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">90-Day Exposure</span>
              </div>
              <p className="text-2xl font-bold mt-1">{formatGBP(stats.totalExposure)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {paddedDays.map((day, idx) => {
                  if (!day) {
                    return <div key={`pad-${idx}`} className="h-24 bg-muted/20 rounded" />;
                  }

                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayEvents = eventsByDate.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isCurrentDay = isToday(day);

                  return (
                    <div
                      key={dateKey}
                      className={cn(
                        'h-24 p-1 rounded border transition-colors',
                        isCurrentMonth ? 'bg-card' : 'bg-muted/30',
                        isCurrentDay && 'border-primary',
                        dayEvents.length > 0 && 'ring-1 ring-primary/20'
                      )}
                    >
                      <div className={cn(
                        'text-xs font-medium mb-1',
                        isCurrentDay && 'text-primary',
                        !isCurrentMonth && 'text-muted-foreground'
                      )}>
                        {format(day, 'd')}
                      </div>

                      <div className="space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 2).map(event => (
                          <Tooltip key={event.id}>
                            <TooltipTrigger asChild>
                              <Link
                                to={`/properties/${event.propertyId}`}
                                className={cn(
                                  'block text-[10px] px-1 py-0.5 rounded truncate text-white',
                                  getEventColor(event)
                                )}
                              >
                                {event.type === 'rate_expiry' ? '⚠️' : '🎯'} {event.address.split(',')[0]}
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                <p className="font-medium">{event.address}</p>
                                <p>{event.type === 'rate_expiry' ? 'Rate Expiry' : 'Refinance Target'}</p>
                                {event.currentRate && <p>Current: {event.currentRate}%</p>}
                                {event.reversionRate && <p>Reversion: {event.reversionRate}%</p>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
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

          {/* Upcoming Events List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Upcoming Events</CardTitle>
              <CardDescription>Next 12 months</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[450px]">
                <div className="space-y-2 p-4 pt-0">
                  {upcomingEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No upcoming mortgage events
                    </p>
                  ) : (
                    upcomingEvents.map(event => (
                      <Link
                        key={event.id}
                        to={`/properties/${event.propertyId}`}
                        className="block p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{event.address.split(',')[0]}</p>
                            <p className="text-xs text-muted-foreground">
                              {event.type === 'rate_expiry' ? 'Rate Expiry' : 'Refinance Target'}
                            </p>
                          </div>
                          <Badge
                            variant={event.daysUntil <= 30 ? 'destructive' : event.daysUntil <= 90 ? 'secondary' : 'outline'}
                            className="shrink-0 text-[10px]"
                          >
                            {event.daysUntil < 0
                              ? `${Math.abs(event.daysUntil)}d ago`
                              : event.daysUntil === 0
                              ? 'Today'
                              : `${event.daysUntil}d`}
                          </Badge>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {format(event.date, 'dd MMM yyyy')}
                          </span>
                          <div className="flex items-center gap-2">
                            {event.currentRate && (
                              <span>{event.currentRate}%</span>
                            )}
                            {event.reversionRate && (
                              <span className="text-muted-foreground">→ {event.reversionRate}%</span>
                            )}
                          </div>
                        </div>

                        {event.balance && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Balance: {formatGBP(event.balance)}
                          </div>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-destructive" />
            <span>Expired</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span>Within 30 days</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span>Within 90 days</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-primary" />
            <span>Future</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
