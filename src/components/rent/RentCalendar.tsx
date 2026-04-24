import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SEVERITY } from '@/lib/design-tokens';
import { useRentCalendar, type RentCalendarEntry } from '@/hooks/useRentManagement';
import { cn } from '@/lib/utils';

const formatGBP = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

type EntryColor = 'green' | 'amber' | 'red' | 'grey';

function getEntryColor(entry: RentCalendarEntry): EntryColor {
  const today = new Date();
  const dueDate = new Date(entry.dueDate);

  if (entry.status === 'paid') {
    // Paid on time = green, paid late = amber
    return entry.paidOnTime ? 'green' : 'amber';
  }
  if (entry.status === 'overdue' || entry.status === 'partial') {
    return 'red';
  }
  if (entry.status === 'upcoming' || dueDate > today) {
    return 'grey';
  }
  // Due today
  return 'amber';
}

const COLOR_CLASSES: Record<EntryColor, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  grey: 'bg-muted-foreground/40',
};

const COLOR_RING_CLASSES: Record<EntryColor, string> = {
  green: 'ring-green-200 dark:ring-green-800',
  amber: 'ring-amber-200 dark:ring-amber-800',
  red: 'ring-red-200 dark:ring-red-800',
  grey: 'ring-muted',
};

export function RentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStr = format(currentDate, 'yyyy-MM');
  const { data: entries, isLoading: _isLoading } = useRentCalendar(monthStr);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, RentCalendarEntry[]>();
    if (!entries) return map;
    for (const entry of entries) {
      const dateKey = entry.dueDate;
      const existing = map.get(dateKey) || [];
      existing.push(entry);
      map.set(dateKey, existing);
    }
    return map;
  }, [entries]);

  // Generate calendar days
  const calendarDays: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  // Get entries for selected date
  const selectedEntries = selectedDate
    ? entriesByDate.get(format(selectedDate, 'yyyy-MM-dd')) || []
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-base">{format(currentDate, 'MMMM yyyy')}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Paid on time
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Paid late / Due
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              Overdue
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
              Upcoming
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((d) => {
                  const dateKey = format(d, 'yyyy-MM-dd');
                  const dayEntries = entriesByDate.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(d, currentDate);
                  const isSelected = selectedDate && isSameDay(d, selectedDate);
                  const isToday = isSameDay(d, new Date());

                  return (
                    <button
                      key={dateKey}
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        'relative flex flex-col items-center p-2 min-h-[64px] rounded-md transition-colors',
                        isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40',
                        isSelected && 'bg-primary/10 ring-1 ring-primary',
                        isToday && !isSelected && 'bg-muted',
                        !isSelected && 'hover:bg-muted/50'
                      )}
                    >
                      <span className={cn(
                        'text-sm',
                        isToday && 'font-bold',
                      )}>
                        {format(d, 'd')}
                      </span>
                      {dayEntries.length > 0 && (
                        <div className="flex items-center gap-0.5 mt-1 flex-wrap justify-center">
                          {dayEntries.length <= 4 ? (
                            dayEntries.map((entry) => {
                              const color = getEntryColor(entry);
                              return (
                                <div
                                  key={entry.id}
                                  className={cn('w-2 h-2 rounded-full', COLOR_CLASSES[color])}
                                />
                              );
                            })
                          ) : (
                            <>
                              <div className={cn('w-2 h-2 rounded-full', COLOR_CLASSES[getEntryColor(dayEntries[0])])} />
                              <span className="text-[10px] text-muted-foreground">+{dayEntries.length - 1}</span>
                            </>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Detail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedDate ? format(selectedDate, 'EEEE, dd MMMM yyyy') : 'Select a day'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Click a day to see payment details
            </p>
          ) : selectedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No rent due or received on this day
            </p>
          ) : (
            <div className="space-y-3">
              {selectedEntries.map((entry) => {
                const color = getEntryColor(entry);
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'p-3 rounded-lg border ring-1',
                      COLOR_RING_CLASSES[color]
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{entry.tenantName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.roomName !== 'Whole Property' ? `${entry.roomName} · ` : ''}
                          {entry.propertyAddress}
                        </p>
                      </div>
                      <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-1', COLOR_CLASSES[color])} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-semibold">{formatGBP(entry.amount)}</span>
                      <CalendarStatusBadge entry={entry} />
                    </div>
                    {entry.amountPaid > 0 && entry.amountPaid < entry.amount && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Paid: {formatGBP(entry.amountPaid)} — Remaining: {formatGBP(entry.amount - entry.amountPaid)}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Summary */}
              <div className="pt-2 border-t space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Due</span>
                  <span className="font-medium">
                    {formatGBP(selectedEntries.reduce((s, e) => s + e.amount, 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Received</span>
                  <span className="font-medium text-green-600">
                    {formatGBP(selectedEntries.reduce((s, e) => s + e.amountPaid, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarStatusBadge({ entry }: { entry: RentCalendarEntry }) {
  switch (entry.status) {
    case 'paid':
      return <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY.success.badge}`}>Paid</span>;
    case 'partial':
      return <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY.warning.badge}`}>Partial</span>;
    case 'overdue':
      return <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY.critical.badge}`}>Overdue</span>;
    case 'due':
      return <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY.info.badge}`}>Due</span>;
    case 'upcoming':
      return <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY.neutral.badge}`}>Upcoming</span>;
    default:
      return null;
  }
}
