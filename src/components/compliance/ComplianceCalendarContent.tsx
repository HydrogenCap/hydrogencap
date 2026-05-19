import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, differenceInDays } from 'date-fns';
import { ChevronLeft, ChevronRight, AlertTriangle, FileCheck, Flame, Zap, Home, Shield, Building2, CheckCircle2, List, Wrench, Percent, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAllCompliance } from '@/hooks/useCompliance';
import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
import { useCalendarEvents, type CalendarEvent, type CalendarEventType } from '@/hooks/useCalendarEvents';
import { getComplianceItemStatus } from '@/lib/complianceTypes';
import { ComplianceStatusCard, type StatusType } from '@/components/compliance/ComplianceStatusCard';
import { ComplianceItemDrawer } from '@/components/compliance/ComplianceItemDrawer';
import { CalendarExportButton } from '@/components/compliance/CalendarExportButton';
import { useQueryClient } from '@tanstack/react-query';

interface ComplianceEvent {
  id: string;
  propertyId: string;
  address: string;
  date: Date;
  type: string;
  typeLabel: string;
  daysUntil: number;
  status: 'valid' | 'expiring_soon' | 'expired' | 'missing';
  issueDate?: string | null;
}

const EVENT_TYPE_CONFIG: Record<CalendarEventType, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  compliance: { icon: Shield, color: 'bg-blue-500', bgColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', label: 'Compliance' },
  job: { icon: Wrench, color: 'bg-amber-500', bgColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', label: 'Jobs' },
  mortgage: { icon: Percent, color: 'bg-purple-500', bgColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300', label: 'Mortgage' },
};

const COMPLIANCE_ICONS: Record<string, React.ElementType> = {
  GAS_SAFETY: Flame,
  EICR: Zap,
  EPC: Home,
  HMO_LICENCE: Building2,
  FIRE_ALARM: Shield,
  EMERGENCY_LIGHTING: Shield,
  LEGIONELLA: Shield,
  PAT_TESTING: Zap,
};

const COMPLIANCE_LABELS: Record<string, string> = {
  GAS_SAFETY: 'Gas Safety',
  EICR: 'EICR',
  EPC: 'EPC',
  HMO_LICENCE: 'HMO Licence',
  FIRE_ALARM: 'Fire Alarm',
  EMERGENCY_LIGHTING: 'Emergency Lighting',
  LEGIONELLA: 'Legionella',
  PAT_TESTING: 'PAT Testing',
};

export function ComplianceCalendarContent() {
  const { data: complianceData, isLoading: complianceLoading } = useAllCompliance();
  const complianceItems = complianceData?.items;
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState<StatusType | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibleEventTypes, setVisibleEventTypes] = useState<Set<CalendarEventType>>(
    new Set(['compliance', 'job', 'mortgage'])
  );
  const queryClient = useQueryClient();

  const { events: allCalendarEvents, eventsByDate: unifiedEventsByDate, isLoading: calendarLoading } = useCalendarEvents();

  const isLoading = complianceLoading || propertiesLoading || calendarLoading;

  const propertyMap = useMemo(() => {
    const map = new Map<string, string>();
    properties?.forEach(p => map.set(p.id, p.address_line));
    return map;
  }, [properties]);

  const complianceEvents = useMemo(() => {
    if (!complianceItems?.length) return [];

    const events: ComplianceEvent[] = [];
    const today = new Date();

    complianceItems.forEach(item => {
      if (!item.expiry_date) return;

      const expiryDate = new Date(item.expiry_date);
      const daysUntil = differenceInDays(expiryDate, today);
      const rawStatus = getComplianceItemStatus(item.expiry_date);
      const status: ComplianceEvent['status'] = 
        rawStatus === 'expired' ? 'expired' :
        rawStatus === 'expiring_soon' ? 'expiring_soon' :
        rawStatus === 'valid' ? 'valid' : 'missing';
      const address = propertyMap.get(item.property_id) || 'Unknown Property';

      events.push({
        id: item.id,
        propertyId: item.property_id,
        address,
        date: expiryDate,
        type: item.compliance_type,
        typeLabel: COMPLIANCE_LABELS[item.compliance_type] || item.compliance_type,
        daysUntil,
        status,
        issueDate: item.issue_date,
      });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [complianceItems, propertyMap]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = monthStart.getDay();
  const paddedDays = Array(firstDayOfWeek).fill(null).concat(calendarDays);

  const filteredEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    unifiedEventsByDate.forEach((events, dateKey) => {
      const filtered = events.filter(e => visibleEventTypes.has(e.eventType));
      if (filtered.length > 0) {
        map.set(dateKey, filtered);
      }
    });
    return map;
  }, [unifiedEventsByDate, visibleEventTypes]);

  const upcomingEvents = useMemo<CalendarEvent[]>(() => {
    const cutoff = addMonths(new Date(), 12);
    const now = new Date();
    return allCalendarEvents
      .filter(e => e.date >= now && e.date <= cutoff && visibleEventTypes.has(e.eventType))
      .slice(0, 50);
  }, [allCalendarEvents, visibleEventTypes]);

  const stats = useMemo(() => {
    const expired = complianceEvents.filter(e => e.status === 'expired');
    const within30 = complianceEvents.filter(e => e.daysUntil >= 0 && e.daysUntil <= 30);
    const within90 = complianceEvents.filter(e => e.daysUntil > 30 && e.daysUntil <= 90);
    const valid = complianceEvents.filter(e => e.daysUntil > 90);

    return { expired, within30, within90, valid, all: complianceEvents };
  }, [complianceEvents]);

  const filteredItems = useMemo(() => {
    if (!selectedStatus) return [];

    switch (selectedStatus) {
      case 'expired':
        return stats.expired;
      case 'expiring_soon':
        return stats.within30;
      case 'within_90':
        return stats.within90;
      case 'valid':
        return stats.valid;
      case 'all':
        return stats.all;
      default:
        return [];
    }
  }, [selectedStatus, stats]);

  const handleStatusClick = useCallback((status: StatusType) => {
    setSelectedStatus(status);
    setDrawerOpen(true);
  }, []);

  const handleItemUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['compliance', 'all'] });
    queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
  }, [queryClient]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth(prev => addMonths(prev, delta));
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.urgency === 'overdue') return 'bg-destructive';
    if (event.urgency === 'urgent') return 'bg-amber-500';
    if (event.urgency === 'warning') return 'bg-yellow-500';
    if (event.eventType === 'job') return 'bg-amber-500';
    if (event.eventType === 'mortgage') return 'bg-purple-500';
    return 'bg-emerald-500';
  };

  const toggleEventType = (type: CalendarEventType) => {
    const newTypes = new Set(visibleEventTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setVisibleEventTypes(newTypes);
  };

  const getEventIcon = (type: string) => {
    return COMPLIANCE_ICONS[type] || FileCheck;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Skeleton className="h-[500px]" />
          </div>
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter & Export */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Track certificate expiry dates across your portfolio. Click any status card to view and update items.
        </p>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter Events
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-3">
                <p className="text-sm font-medium">Show event types:</p>
                {(Object.entries(EVENT_TYPE_CONFIG) as [CalendarEventType, typeof EVENT_TYPE_CONFIG[CalendarEventType]][]).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={visibleEventTypes.has(type)}
                        onCheckedChange={() => toggleEventType(type)}
                      />
                      <div className={cn("w-3 h-3 rounded", config.color)} />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{config.label}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <CalendarExportButton />
        </div>
      </div>

      {/* Interactive Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <ComplianceStatusCard
          label="Expired"
          count={stats.expired.length}
          icon={AlertTriangle}
          status="expired"
          isActive={selectedStatus === 'expired'}
          onClick={() => handleStatusClick('expired')}
        />
        <ComplianceStatusCard
          label="Within 30 Days"
          count={stats.within30.length}
          icon={FileCheck}
          status="expiring_soon"
          isActive={selectedStatus === 'expiring_soon'}
          onClick={() => handleStatusClick('expiring_soon')}
        />
        <ComplianceStatusCard
          label="Within 90 Days"
          count={stats.within90.length}
          icon={FileCheck}
          status="within_90"
          isActive={selectedStatus === 'within_90'}
          onClick={() => handleStatusClick('within_90')}
        />
        <ComplianceStatusCard
          label="Valid"
          count={stats.valid.length}
          icon={CheckCircle2}
          status="valid"
          isActive={selectedStatus === 'valid'}
          onClick={() => handleStatusClick('valid')}
        />
        <ComplianceStatusCard
          label="All Items"
          count={stats.all.length}
          icon={List}
          status="all"
          isActive={selectedStatus === 'all'}
          onClick={() => handleStatusClick('all')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex items-center gap-2">
                <Button aria-label="Previous" variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
                <Button aria-label="Next" variant="outline" size="icon" onClick={() => navigateMonth(1)}>
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
                const dayEvents = filteredEventsByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);
                const hasOverdue = dayEvents.some(e => e.urgency === 'overdue');
                const hasUrgent = dayEvents.some(e => e.urgency === 'urgent');

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      'h-24 p-1 rounded border transition-colors cursor-pointer hover:bg-muted/50',
                      isCurrentMonth ? 'bg-card' : 'bg-muted/30',
                      isCurrentDay && 'border-primary ring-1 ring-primary/30',
                      hasOverdue && 'border-destructive/50 bg-destructive/5',
                      !hasOverdue && hasUrgent && 'border-amber-500/50'
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
                      {dayEvents.slice(0, 2).map(event => {
                        const typeConfig = EVENT_TYPE_CONFIG[event.eventType];
                        const Icon = event.complianceType ? getEventIcon(event.complianceType) : typeConfig.icon;
                        return (
                          <Tooltip key={event.id}>
                            <TooltipTrigger asChild>
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

        {/* Upcoming Events List */}
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
                    return (
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
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-destructive" />
          <span>Overdue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span>Urgent / Jobs</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span>Mortgage</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span>Valid</span>
        </div>
      </div>

      {/* Compliance Items Drawer */}
      <ComplianceItemDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        selectedStatus={selectedStatus}
        items={filteredItems}
        onItemUpdated={handleItemUpdated}
      />
    </div>
  );
}
