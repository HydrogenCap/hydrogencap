import { useEffect, useMemo, useRef } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import type { ComplianceMatrixRow } from '@/lib/complianceV2Types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ComplianceCalendarViewProps {
  rows: ComplianceMatrixRow[];
  /**
   * Mirrors the page-level dropdown so the calendar agrees with the headline
   * stat cards (e.g. only show items contributing to "Needs Attention").
   */
  statusFilter?: string;
  /** Open detail modal when a calendar item is clicked */
  onItemClick?: (row: ComplianceMatrixRow) => void;
}

const NEEDS_ATTENTION = new Set(['expiring_soon', 'critical', 'expired', 'missing']);

function passesFilter(status: string | null | undefined, filter: string | undefined): boolean {
  if (!filter || filter === 'all') return true;
  if (filter === 'needs_attention') return NEEDS_ATTENTION.has(status ?? '');
  return (status ?? '') === filter;
}

export function ComplianceCalendarView({ rows, statusFilter, onItemClick }: ComplianceCalendarViewProps) {
  const months = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(addMonths(start, 11));
    return eachMonthOfInterval({ start, end });
  }, []);

  const filteredRows = useMemo(
    () => rows.filter(r => r.is_required && passesFilter(r.calculated_status, statusFilter)),
    [rows, statusFilter],
  );

  const expiryByMonth = useMemo(() => {
    const map = new Map<string, ComplianceMatrixRow[]>();
    for (const month of months) {
      map.set(format(month, 'yyyy-MM'), []);
    }
    for (const row of filteredRows) {
      if (!row.expiry_date) continue;
      const key = format(new Date(row.expiry_date), 'yyyy-MM');
      if (map.has(key)) map.get(key)!.push(row);
    }
    // Sort items within each month by expiry date ascending
    for (const list of map.values()) {
      list.sort((a, b) => (a.expiry_date || '').localeCompare(b.expiry_date || ''));
    }
    return map;
  }, [filteredRows, months]);

  const missingItems = useMemo(
    () => filteredRows.filter(r => r.calculated_status === 'missing'),
    [filteredRows],
  );

  const expiredNoDateItems = useMemo(
    () => filteredRows.filter(r => r.calculated_status === 'expired' && !r.expiry_date),
    [filteredRows],
  );

  const visibleOnGrid =
    Array.from(expiryByMonth.values()).reduce((acc, list) => acc + list.length, 0);
  const offGrid = missingItems.length + expiredNoDateItems.length;

  // Heatmap: compute max count for intensity scaling
  const maxCount = Array.from(expiryByMonth.values()).reduce((m, list) => Math.max(m, list.length), 0);

  // Auto-scroll to first non-empty month on mount (once)
  const didScrollRef = useRef(false);
  useEffect(() => {
    if (didScrollRef.current) return;
    if (visibleOnGrid === 0) return;
    const firstNonZero = months.find(m => (expiryByMonth.get(format(m, 'yyyy-MM')) || []).length > 0);
    if (!firstNonZero) return;
    const el = document.getElementById(`cal-month-${format(firstNonZero, 'yyyy-MM')}`);
    if (el) {
      // Only scroll if it's not already visible
      const rect = el.getBoundingClientRect();
      const offscreen = rect.top < 0 || rect.bottom > window.innerHeight;
      if (offscreen) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      didScrollRef.current = true;
    }
  }, [visibleOnGrid, months, expiryByMonth]);

  return (
    <div className="space-y-3">
      {(missingItems.length > 0 || expiredNoDateItems.length > 0) && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'w-full border rounded-lg p-3 flex items-center justify-between gap-3 text-left',
                'border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors',
              )}
              title="Required certificates with no current document on file, or expired without a recorded expiry date. These don't appear on the monthly grid below."
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm font-medium truncate">
                  {missingItems.length} missing{expiredNoDateItems.length > 0 ? ` · ${expiredNoDateItems.length} expired (no date)` : ''}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground shrink-0">No expiry date — not on grid</p>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <p className="text-sm font-medium mb-2">Off-grid items</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...missingItems, ...expiredNoDateItems].map(item => {
                const content = (
                  <>
                    <p className="font-medium">{DOC_TYPE_DISPLAY_NAMES[item.document_type]}</p>
                    <p className="text-muted-foreground">{item.property_address}</p>
                    <p className="text-destructive">
                      {item.calculated_status === 'missing' ? 'No document uploaded' : 'Expired (no date)'}
                    </p>
                  </>
                );
                return onItemClick ? (
                  <button
                    key={`${item.property_id}-${item.requirement_id}`}
                    type="button"
                    onClick={() => onItemClick(item)}
                    className="text-xs border-b pb-1.5 last:border-b-0 w-full text-left hover:bg-muted/40 rounded px-1 -mx-1 transition-colors"
                  >
                    {content}
                  </button>
                ) : (
                  <div key={`${item.property_id}-${item.requirement_id}`} className="text-xs border-b pb-1.5 last:border-b-0">
                    {content}
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Jump-to-next-expiry */}
      {visibleOnGrid > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              const firstNonZero = months.find(m => (expiryByMonth.get(format(m, 'yyyy-MM')) || []).length > 0);
              if (!firstNonZero) return;
              const el = document.getElementById(`cal-month-${format(firstNonZero, 'yyyy-MM')}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
              }
            }}
            className="text-xs text-primary hover:underline"
          >
            Jump to next expiry →
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {months.map((month, idx) => {
          const key = format(month, 'yyyy-MM');
          const items = expiryByMonth.get(key) || [];
          const count = items.length;
          const isCurrent = idx === 0;
          return (
            <Popover key={key}>
              <PopoverTrigger asChild>
                <button
                  id={`cal-month-${key}`}
                  aria-label={`${format(month, 'MMMM yyyy')}: ${count} ${count === 1 ? 'expiry' : 'expiries'}`}
                  className={cn(
                    'border rounded-lg p-3 text-center hover:bg-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    count === 0 && 'border-success/30 bg-success/5 cursor-default hover:bg-success/5',
                    count >= 1 && count <= 2 && 'border-warning/30 bg-warning/5',
                    count >= 3 && 'border-destructive/30 bg-destructive/5',
                    isCurrent && 'ring-2 ring-primary/40',
                  )}
                >
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    {format(month, 'MMM yyyy')}
                    {isCurrent && <span className="text-[9px] uppercase font-semibold text-primary">Now</span>}
                  </p>
                  <p className={cn(
                    'text-2xl font-bold mt-1',
                    count === 0 && 'text-success',
                    count >= 1 && count <= 2 && 'text-warning',
                    count >= 3 && 'text-destructive',
                  )}>
                    {count}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{count === 1 ? 'expiry' : 'expiries'}</p>
                </button>
              </PopoverTrigger>
              {count > 0 && (
                <PopoverContent className="w-72 p-3" align="start">
                  <p className="text-sm font-medium mb-2">Expiring in {format(month, 'MMMM yyyy')}</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {items.map(item => {
                      const content = (
                        <>
                          <p className="font-medium">{DOC_TYPE_DISPLAY_NAMES[item.document_type]}</p>
                          <p className="text-muted-foreground">{item.property_address}</p>
                          <p className="text-muted-foreground">{item.expiry_date && format(new Date(item.expiry_date), 'dd/MM/yyyy')}</p>
                        </>
                      );
                      return onItemClick ? (
                        <button
                          key={item.requirement_id}
                          type="button"
                          onClick={() => onItemClick(item)}
                          className="text-xs border-b pb-1.5 last:border-b-0 w-full text-left hover:bg-muted/40 rounded px-1 -mx-1 transition-colors"
                        >
                          {content}
                        </button>
                      ) : (
                        <div key={item.requirement_id} className="text-xs border-b pb-1.5 last:border-b-0">
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Showing {visibleOnGrid} item{visibleOnGrid === 1 ? '' : 's'} expiring in the next 12 months
        {offGrid > 0 && ` · ${offGrid} more off-grid (no expiry date)`}
      </p>
    </div>
  );
}
