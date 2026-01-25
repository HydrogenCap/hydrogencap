import { Users, Building2, Landmark, FileCheck, Award, Calendar } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TimelineFilters, TimelineEventCategory } from '@/hooks/usePortfolioTimeline';

interface TimelineControlsProps {
  filters: TimelineFilters;
  onFiltersChange: (filters: TimelineFilters) => void;
  totalEvents: number;
}

const categoryOptions: { value: TimelineEventCategory; label: string; icon: React.ElementType }[] = [
  { value: 'expansion', label: 'Acquisitions', icon: Building2 },
  { value: 'finance', label: 'Finance', icon: Landmark },
  { value: 'compliance', label: 'Compliance', icon: FileCheck },
  { value: 'performance', label: 'Highlights', icon: Award },
];

export function TimelineControls({ filters, onFiltersChange, totalEvents }: TimelineControlsProps) {
  const handleDateRangeChange = (range: 'all' | '12m' | '24m' | 'custom') => {
    onFiltersChange({ ...filters, dateRange: range });
  };

  const handleViewModeChange = (mode: 'gross' | 'attributable') => {
    if (mode) onFiltersChange({ ...filters, viewMode: mode });
  };

  const handleCategoryToggle = (category: TimelineEventCategory) => {
    const current = filters.categories;
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category];
    onFiltersChange({ ...filters, categories: updated });
  };

  const handleClearCategories = () => {
    onFiltersChange({ ...filters, categories: [] });
  };

  return (
    <div className="bg-card border rounded-lg p-4 sticky top-0 z-10 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Time Range */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Time range:</span>
          <ToggleGroup
            type="single"
            value={filters.dateRange}
            onValueChange={(v) => v && handleDateRangeChange(v as typeof filters.dateRange)}
            className="bg-muted/50 p-1 rounded-lg"
          >
            <ToggleGroupItem value="all" className="text-xs px-3">
              All time
            </ToggleGroupItem>
            <ToggleGroupItem value="12m" className="text-xs px-3">
              12 months
            </ToggleGroupItem>
            <ToggleGroupItem value="24m" className="text-xs px-3">
              24 months
            </ToggleGroupItem>
            <Popover>
              <PopoverTrigger asChild>
                <ToggleGroupItem value="custom" className="text-xs px-3">
                  <Calendar className="h-3 w-3 mr-1" />
                  Custom
                </ToggleGroupItem>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={{
                    from: filters.customStart,
                    to: filters.customEnd,
                  }}
                  onSelect={(range) => {
                    onFiltersChange({
                      ...filters,
                      dateRange: 'custom',
                      customStart: range?.from,
                      customEnd: range?.to,
                    });
                  }}
                />
              </PopoverContent>
            </Popover>
          </ToggleGroup>
        </div>

        {/* View Mode */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">View:</span>
          <ToggleGroup
            type="single"
            value={filters.viewMode}
            onValueChange={(v) => v && handleViewModeChange(v as 'gross' | 'attributable')}
            className="bg-muted/50 p-1 rounded-lg"
          >
            <ToggleGroupItem value="gross" className="text-xs px-3">
              Gross (100%)
            </ToggleGroupItem>
            <ToggleGroupItem value="attributable" className="text-xs px-3">
              <Users className="h-3 w-3 mr-1" />
              Attributable
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Event count */}
        <Badge variant="secondary" className="text-xs">
          {totalEvents} events
        </Badge>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {categoryOptions.map(cat => {
          const isActive = filters.categories.length === 0 || filters.categories.includes(cat.value);
          return (
            <Button
              key={cat.value}
              variant={isActive ? 'secondary' : 'outline'}
              size="sm"
              className={cn(
                'text-xs gap-1.5',
                !isActive && 'opacity-50'
              )}
              onClick={() => handleCategoryToggle(cat.value)}
            >
              <cat.icon className="h-3 w-3" />
              {cat.label}
            </Button>
          );
        })}
        {filters.categories.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={handleClearCategories}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
