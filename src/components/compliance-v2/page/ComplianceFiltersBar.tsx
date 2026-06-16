import { RefObject } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarDays, Grid3X3, Rows3, Rows4, Search, X } from 'lucide-react';
import { SavedViewsMenu } from '@/components/common';

interface Props {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  propertyType: string;
  setPropertyType: (v: string) => void;
  propertyTypes: string[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  monthFocus: boolean;
  setMonthFocus: (v: boolean) => void;
  filtersActive: boolean;
  clearFilters: () => void;
  viewMode: 'matrix' | 'calendar';
  setViewMode: (v: 'matrix' | 'calendar') => void;
  density: 'comfortable' | 'compact';
  setDensity: (updater: (d: 'comfortable' | 'compact') => 'comfortable' | 'compact') => void;
}

export function ComplianceFiltersBar(p: Props) {
  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={p.statusFilter} onValueChange={p.setStatusFilter}>
            <SelectTrigger className="w-[180px]" aria-label="Status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="needs_attention">Needs Attention</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="expired">Expired Only</SelectItem>
              <SelectItem value="missing">Missing Only</SelectItem>
              <SelectItem value="valid">Valid Only</SelectItem>
            </SelectContent>
          </Select>

          {p.propertyTypes.length > 1 && (
            <Select value={p.propertyType} onValueChange={p.setPropertyType}>
              <SelectTrigger className="w-[160px]" aria-label="Property type filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {p.propertyTypes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={p.searchInputRef}
              placeholder="Search property... (press /)"
              value={p.searchQuery}
              onChange={e => p.setSearchQuery(e.target.value)}
              className="pl-9 pr-8 w-[220px]"
              aria-label="Search properties"
            />
            {p.searchQuery && (
              <button
                type="button"
                onClick={() => { p.setSearchQuery(''); p.searchInputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            variant={p.monthFocus ? 'default' : 'outline'}
            size="sm"
            onClick={() => p.setMonthFocus(!p.monthFocus)}
            aria-pressed={p.monthFocus}
            title="Show only items broken or expiring within the current calendar month"
          >
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            Focus this month
          </Button>

          {p.filtersActive && (
            <Button variant="ghost" size="sm" onClick={p.clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" /> Clear filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {p.viewMode === 'matrix' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => p.setDensity(d => d === 'comfortable' ? 'compact' : 'comfortable')}
                  aria-label={`Switch to ${p.density === 'comfortable' ? 'compact' : 'comfortable'} density`}
                >
                  {p.density === 'comfortable' ? <Rows3 className="h-4 w-4" /> : <Rows4 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {p.density === 'comfortable' ? 'Switch to compact rows' : 'Switch to comfortable rows'}
              </TooltipContent>
            </Tooltip>
          )}

          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            <Button
              variant={p.viewMode === 'matrix' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => p.setViewMode('matrix')}
              aria-pressed={p.viewMode === 'matrix'}
            >
              <Grid3X3 className="h-4 w-4 mr-1" /> Matrix
            </Button>
            <Button
              variant={p.viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => p.setViewMode('calendar')}
              aria-pressed={p.viewMode === 'calendar'}
            >
              <CalendarDays className="h-4 w-4 mr-1" /> Calendar
            </Button>
          </div>
          <SavedViewsMenu
            scope="compliance"
            currentFilters={{ statusFilter: p.statusFilter, searchQuery: p.searchQuery, propertyType: p.propertyType, viewMode: p.viewMode }}
            onApply={(f) => {
              if (typeof f.statusFilter === 'string') p.setStatusFilter(f.statusFilter);
              if (typeof f.searchQuery === 'string') p.setSearchQuery(f.searchQuery);
              if (typeof f.propertyType === 'string') p.setPropertyType(f.propertyType);
              if (f.viewMode === 'matrix' || f.viewMode === 'calendar') p.setViewMode(f.viewMode);
            }}
          />
        </div>
      </div>

      {p.filtersActive && (
        <div className="flex items-center gap-2 flex-wrap text-xs print:hidden -mt-2">
          <span className="text-muted-foreground">Active filters:</span>
          {p.statusFilter !== 'needs_attention' && (
            <button
              type="button"
              onClick={() => p.setStatusFilter('needs_attention')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-muted/70 transition-colors"
            >
              Status: {p.statusFilter.replace('_', ' ')} <X className="h-3 w-3" />
            </button>
          )}
          {p.propertyType !== 'all' && (
            <button
              type="button"
              onClick={() => p.setPropertyType('all')}
              className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-muted/70 transition-colors')}
            >
              Type: {p.propertyType} <X className="h-3 w-3" />
            </button>
          )}
          {p.searchQuery && (
            <button
              type="button"
              onClick={() => p.setSearchQuery('')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-muted/70 transition-colors"
            >
              Search: "{p.searchQuery}" <X className="h-3 w-3" />
            </button>
          )}
          {p.monthFocus && (
            <button
              type="button"
              onClick={() => p.setMonthFocus(false)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Focus: this month <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
