import { CalendarCheck, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarExportButton } from '@/components/compliance/CalendarExportButton';
import { DensityToggle } from '@/components/DensityToggle';
import { cn } from '@/lib/utils';
import type { CalendarEventType } from '@/hooks/useCalendarEvents';
import { EVENT_TYPE_CONFIG } from '../utils/calendarConfig';

interface Props {
  visibleEventTypes: Set<CalendarEventType>;
  toggleEventType: (type: CalendarEventType) => void;
}

export function CalendarHeader({ visibleEventTypes, toggleEventType }: Props) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Compliance Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <DensityToggle />
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
                      <div className={cn('w-3 h-3 rounded', config.color)} />
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
      <p className="text-muted-foreground mt-1">
        Track certificate expiry dates across your portfolio. Click any status card to view and update items.
      </p>
    </div>
  );
}
