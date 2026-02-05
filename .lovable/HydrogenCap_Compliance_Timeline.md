# HydrogenCap Implementation Specification
## Enhancement: Compliance Expiry on Timeline/Calendar

Ensure expiring compliance items appear visually on the timeline/calendar views, not just as background jobs.

---

# The Problem

Currently:
- ✅ Auto-creates jobs when compliance expires within 90 days
- ✅ Sends email reminders
- ❌ **NOT visible on any calendar/timeline view in the app**

Users need to SEE upcoming compliance expirations in context with:
- Booked contractor jobs
- Mortgage rate expiry dates
- Development milestones
- Rent due dates

---

# Solution: Unified Timeline/Calendar

## Option A: Add to Existing Compliance Calendar

Enhance the Compliance Calendar page to show:

```tsx
// Calendar events include:
1. Compliance expiry dates (from compliance_items)
2. Booked contractor jobs (from contractor_jobs where booked_date IS NOT NULL)
3. Mortgage rate expiry (from properties.mortgage_fixed_until)
4. Rent due dates (from rent_schedule) [if tenant module enabled]
```

## Option B: Create a Master Calendar/Timeline

New page `/calendar` showing ALL time-sensitive items across the portfolio.

---

# Implementation

## Database View: Unified Calendar Events

```sql
-- View that combines all time-sensitive events
CREATE OR REPLACE VIEW calendar_events AS

-- Compliance expirations
SELECT 
  'compliance' as event_type,
  ci.id as event_id,
  ci.property_id,
  p.address_line as property_address,
  ci.compliance_type as title,
  ci.expiry_date as event_date,
  NULL as end_date,
  CASE 
    WHEN ci.expiry_date <= CURRENT_DATE THEN 'overdue'
    WHEN ci.expiry_date <= CURRENT_DATE + 14 THEN 'urgent'
    WHEN ci.expiry_date <= CURRENT_DATE + 30 THEN 'warning'
    ELSE 'upcoming'
  END as urgency,
  ci.auto_job_id as related_job_id,
  ci.org_id
FROM compliance_items ci
JOIN properties p ON p.id = ci.property_id
WHERE ci.expiry_date IS NOT NULL
AND ci.expiry_date >= CURRENT_DATE - 30  -- Show past 30 days too
AND ci.expiry_date <= CURRENT_DATE + 180  -- Next 6 months

UNION ALL

-- Booked contractor jobs
SELECT 
  'job' as event_type,
  cj.id as event_id,
  cj.property_id,
  p.address_line as property_address,
  cj.job_type || ' - ' || COALESCE(c.name, 'No contractor') as title,
  cj.booked_date as event_date,
  NULL as end_date,
  CASE cj.status
    WHEN 'booked' THEN 'scheduled'
    WHEN 'in_progress' THEN 'active'
    ELSE 'normal'
  END as urgency,
  cj.id as related_job_id,
  cj.org_id
FROM contractor_jobs cj
JOIN properties p ON p.id = cj.property_id
LEFT JOIN contractors c ON c.id = cj.contractor_id
WHERE cj.booked_date IS NOT NULL
AND cj.status NOT IN ('completed', 'verified', 'cancelled')

UNION ALL

-- Mortgage rate expiry
SELECT 
  'mortgage' as event_type,
  p.id as event_id,
  p.id as property_id,
  p.address_line as property_address,
  'Mortgage rate expires' as title,
  p.mortgage_fixed_until as event_date,
  NULL as end_date,
  CASE 
    WHEN p.mortgage_fixed_until <= CURRENT_DATE THEN 'overdue'
    WHEN p.mortgage_fixed_until <= CURRENT_DATE + 30 THEN 'urgent'
    WHEN p.mortgage_fixed_until <= CURRENT_DATE + 90 THEN 'warning'
    ELSE 'upcoming'
  END as urgency,
  NULL as related_job_id,
  p.org_id
FROM properties p
WHERE p.mortgage_fixed_until IS NOT NULL
AND p.mortgage_fixed_until >= CURRENT_DATE - 30
AND p.mortgage_fixed_until <= CURRENT_DATE + 365

UNION ALL

-- Development milestones
SELECT 
  'milestone' as event_type,
  pm.id as event_id,
  dp.property_id,
  p.address_line as property_address,
  pm.name as title,
  COALESCE(pm.actual_date, pm.target_date) as event_date,
  NULL as end_date,
  CASE pm.status
    WHEN 'delayed' THEN 'urgent'
    WHEN 'in_progress' THEN 'active'
    WHEN 'completed' THEN 'done'
    ELSE 'upcoming'
  END as urgency,
  NULL as related_job_id,
  dp.org_id
FROM project_milestones pm
JOIN development_projects dp ON dp.id = pm.project_id
JOIN properties p ON p.id = dp.property_id
WHERE pm.status NOT IN ('completed', 'cancelled')
AND COALESCE(pm.actual_date, pm.target_date) IS NOT NULL;
```

---

# Frontend: Enhanced Compliance Calendar

## src/hooks/useCalendarEvents.ts

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CalendarEvent {
  event_type: 'compliance' | 'job' | 'mortgage' | 'milestone' | 'rent';
  event_id: string;
  property_id: string;
  property_address: string;
  title: string;
  event_date: string;
  end_date: string | null;
  urgency: 'overdue' | 'urgent' | 'warning' | 'upcoming' | 'scheduled' | 'active' | 'done' | 'normal';
  related_job_id: string | null;
}

export function useCalendarEvents(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['calendar-events', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date');

      if (error) throw error;
      return data as CalendarEvent[];
    },
  });
}

export function useUpcomingEvents(days: number = 30) {
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return useCalendarEvents(startDate, endDate);
}
```

## src/components/calendar/UnifiedCalendar.tsx

```typescript
import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Shield, Wrench, Percent, Flag, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCalendarEvents, CalendarEvent } from '@/hooks/useCalendarEvents';
import { cn } from '@/lib/utils';

const EVENT_CONFIG = {
  compliance: { 
    icon: Shield, 
    color: 'bg-blue-500', 
    label: 'Compliance',
    lightColor: 'bg-blue-100 text-blue-700'
  },
  job: { 
    icon: Wrench, 
    color: 'bg-amber-500', 
    label: 'Jobs',
    lightColor: 'bg-amber-100 text-amber-700'
  },
  mortgage: { 
    icon: Percent, 
    color: 'bg-purple-500', 
    label: 'Mortgage',
    lightColor: 'bg-purple-100 text-purple-700'
  },
  milestone: { 
    icon: Flag, 
    color: 'bg-emerald-500', 
    label: 'Milestones',
    lightColor: 'bg-emerald-100 text-emerald-700'
  },
};

const URGENCY_COLORS = {
  overdue: 'bg-red-500 text-white',
  urgent: 'bg-red-100 text-red-700 border-red-300',
  warning: 'bg-amber-100 text-amber-700 border-amber-300',
  upcoming: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  done: 'bg-slate-50 text-slate-500',
  normal: 'bg-slate-100 text-slate-700',
};

export function UnifiedCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(['compliance', 'job', 'mortgage', 'milestone'])
  );

  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  
  const { data: events, isLoading } = useCalendarEvents(startDate, endDate);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getEventsForDay = (day: Date) => {
    return events?.filter(e => 
      isSameDay(new Date(e.event_date), day) &&
      visibleTypes.has(e.event_type)
    ) || [];
  };

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const toggleEventType = (type: string) => {
    const newTypes = new Set(visibleTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setVisibleTypes(newTypes);
  };

  return (
    <div className="flex gap-6">
      {/* Calendar */}
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => {
                const newMonth = new Date(currentMonth);
                newMonth.setMonth(newMonth.getMonth() - 1);
                setCurrentMonth(newMonth);
              }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold min-w-[180px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <Button variant="outline" size="icon" onClick={() => {
                const newMonth = new Date(currentMonth);
                newMonth.setMonth(newMonth.getMonth() + 1);
                setCurrentMonth(newMonth);
              }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="space-y-2">
                  {Object.entries(EVENT_CONFIG).map(([type, config]) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={visibleTypes.has(type)}
                        onCheckedChange={() => toggleEventType(type)}
                      />
                      <div className={cn("w-3 h-3 rounded", config.color)} />
                      <span className="text-sm">{config.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start */}
            {Array.from({ length: (days[0].getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24" />
            ))}

            {days.map(day => {
              const dayEvents = getEventsForDay(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const hasOverdue = dayEvents.some(e => e.urgency === 'overdue');
              const hasUrgent = dayEvents.some(e => e.urgency === 'urgent');

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "h-24 p-1 border rounded cursor-pointer transition-colors",
                    isSelected && "ring-2 ring-primary",
                    isToday && "bg-primary/5",
                    hasOverdue && "border-red-300 bg-red-50/50",
                    hasUrgent && !hasOverdue && "border-amber-300 bg-amber-50/50",
                    "hover:bg-muted/50"
                  )}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    isToday && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>

                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map(event => {
                      const config = EVENT_CONFIG[event.event_type];
                      return (
                        <div
                          key={event.event_id}
                          className={cn(
                            "text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-1",
                            config.lightColor,
                            event.urgency === 'overdue' && "bg-red-500 text-white",
                            event.urgency === 'urgent' && "bg-red-100 text-red-700"
                          )}
                        >
                          <config.icon className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{event.title}</span>
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Details */}
      <Card className="w-80 shrink-0">
        <CardHeader>
          <CardTitle className="text-base">
            {selectedDate ? format(selectedDate, 'EEEE, d MMMM') : 'Select a day'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground">
              Click on a day to see events
            </p>
          ) : selectedDayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events on this day
            </p>
          ) : (
            <div className="space-y-3">
              {selectedDayEvents.map(event => {
                const config = EVENT_CONFIG[event.event_type];
                const Icon = config.icon;

                return (
                  <div
                    key={event.event_id}
                    className={cn(
                      "p-3 rounded-lg border",
                      URGENCY_COLORS[event.urgency]
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn("p-1.5 rounded", config.color)}>
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{event.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {event.property_address?.split(',')[0]}
                        </p>
                        {event.urgency === 'overdue' && (
                          <Badge variant="destructive" className="mt-1 text-[10px]">
                            Overdue
                          </Badge>
                        )}
                        {event.related_job_id && (
                          <a 
                            href={`/jobs/${event.related_job_id}`}
                            className="text-xs text-primary hover:underline mt-1 block"
                          >
                            View Job →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

# Dashboard Widget: Upcoming Expirations

## src/components/dashboard/UpcomingExpirationWidget.tsx

```typescript
import React from 'react';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { Shield, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUpcomingEvents } from '@/hooks/useCalendarEvents';
import { cn } from '@/lib/utils';

export function UpcomingExpirationsWidget() {
  const { data: events, isLoading } = useUpcomingEvents(60); // Next 60 days

  // Filter to compliance only
  const complianceEvents = events?.filter(e => e.event_type === 'compliance') || [];
  
  // Group by urgency
  const overdue = complianceEvents.filter(e => e.urgency === 'overdue');
  const urgent = complianceEvents.filter(e => e.urgency === 'urgent');
  const warning = complianceEvents.filter(e => e.urgency === 'warning');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="h-32 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      overdue.length > 0 && "border-red-200",
      overdue.length === 0 && urgent.length > 0 && "border-amber-200"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Expiring
          </CardTitle>
          <Link to="/compliance">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {complianceEvents.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">All compliance up to date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary badges */}
            <div className="flex gap-2">
              {overdue.length > 0 && (
                <Badge variant="destructive">
                  {overdue.length} expired
                </Badge>
              )}
              {urgent.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700">
                  {urgent.length} urgent (&lt;14 days)
                </Badge>
              )}
              {warning.length > 0 && (
                <Badge variant="secondary">
                  {warning.length} upcoming
                </Badge>
              )}
            </div>

            {/* Top 5 items */}
            <div className="space-y-2">
              {complianceEvents.slice(0, 5).map(event => {
                const daysUntil = differenceInDays(new Date(event.event_date), new Date());
                
                return (
                  <Link
                    key={event.event_id}
                    to={`/compliance?highlight=${event.event_id}`}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 transition-colors",
                      event.urgency === 'overdue' && "bg-red-50 border-red-200",
                      event.urgency === 'urgent' && "bg-amber-50 border-amber-200"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.property_address?.split(',')[0]}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={cn(
                        "text-sm font-medium",
                        daysUntil < 0 && "text-red-600",
                        daysUntil >= 0 && daysUntil <= 14 && "text-amber-600"
                      )}>
                        {daysUntil < 0 
                          ? `${Math.abs(daysUntil)}d overdue`
                          : daysUntil === 0 
                            ? 'Today'
                            : `${daysUntil}d`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.event_date), 'dd MMM')}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {complianceEvents.length > 5 && (
              <Link to="/compliance" className="block">
                <Button variant="outline" className="w-full" size="sm">
                  View all {complianceEvents.length} items
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

# Integration Points

## Add to Dashboard

```tsx
// In Dashboard.tsx
import { UpcomingExpirationsWidget } from '@/components/dashboard/UpcomingExpirationsWidget';

// In dashboard grid:
<UpcomingExpirationsWidget />
```

## Add Calendar Page

```tsx
// New route: /calendar
// Shows UnifiedCalendar component with all event types
```

## Add to Navigation

```tsx
// In AppSidebar.tsx
{ title: 'Calendar', icon: Calendar, href: '/calendar' },
```

---

# Summary

Now compliance expirations will appear:

1. ✅ **Dashboard Widget** - Shows expiring compliance with days countdown
2. ✅ **Unified Calendar** - Visual calendar showing compliance + jobs + mortgages + milestones
3. ✅ **Auto-created Jobs** - Still creates draft jobs at 90 days (background)
4. ✅ **Email Reminders** - Still sends emails at 60/30/14/7 days

The calendar shows:
- 🔵 **Compliance** - Certificates expiring
- 🟡 **Jobs** - Booked contractor jobs
- 🟣 **Mortgage** - Fixed rate expiry dates  
- 🟢 **Milestones** - Development project milestones

Color coding by urgency:
- 🔴 **Overdue** - Past due date
- 🟠 **Urgent** - Within 14 days
- 🟡 **Warning** - Within 30 days
- ⚪ **Upcoming** - More than 30 days

---

*Ready for Lovable.dev implementation*
