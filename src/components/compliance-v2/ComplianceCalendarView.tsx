import { useMemo } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import type { ComplianceMatrixRow } from '@/lib/complianceV2Types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ComplianceCalendarViewProps {
  rows: ComplianceMatrixRow[];
}

export function ComplianceCalendarView({ rows }: ComplianceCalendarViewProps) {
  const months = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(addMonths(start, 11));
    return eachMonthOfInterval({ start, end });
  }, []);

  const expiryByMonth = useMemo(() => {
    const map = new Map<string, ComplianceMatrixRow[]>();
    for (const month of months) {
      const key = format(month, 'yyyy-MM');
      map.set(key, []);
    }
    for (const row of rows) {
      if (!row.expiry_date || !row.is_required) continue;
      const key = format(new Date(row.expiry_date), 'yyyy-MM');
      if (map.has(key)) {
        map.get(key)!.push(row);
      }
    }
    return map;
  }, [rows, months]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {months.map(month => {
        const key = format(month, 'yyyy-MM');
        const items = expiryByMonth.get(key) || [];
        const count = items.length;
        return (
          <Popover key={key}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'border rounded-lg p-3 text-center hover:bg-muted/30 transition-colors',
                  count === 0 && 'border-success/30 bg-success/5',
                  count >= 1 && count <= 2 && 'border-warning/30 bg-warning/5',
                  count >= 3 && 'border-destructive/30 bg-destructive/5',
                )}
              >
                <p className="text-xs text-muted-foreground">{format(month, 'MMM yyyy')}</p>
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
                  {items.map(item => (
                    <div key={item.requirement_id} className="text-xs border-b pb-1.5 last:border-b-0">
                      <p className="font-medium">{DOC_TYPE_DISPLAY_NAMES[item.document_type]}</p>
                      <p className="text-muted-foreground">{item.property_address}</p>
                      <p className="text-muted-foreground">{item.expiry_date && format(new Date(item.expiry_date), 'dd/MM/yyyy')}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            )}
          </Popover>
        );
      })}
    </div>
  );
}
