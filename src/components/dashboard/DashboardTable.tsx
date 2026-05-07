import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render: (item: T, index: number) => ReactNode;
}

interface DashboardTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  maxHeight?: string;
}

/**
 * Dashboard Table component matching the Demo dashboard styling.
 * Features sticky header, proper alignment, hover states, and subtle separators.
 */
export function DashboardTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = "Quiet for now — as soon as there's activity, it'll show up in this table.",
  className,
  maxHeight,
}: DashboardTableProps<T>) {
  return (
    <div 
      className={cn('overflow-x-auto', className)}
      style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
    >
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/40 border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.align !== 'right' && col.align !== 'center' && 'text-left',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {data.length === 0 ? (
            <tr>
              <td 
                colSpan={columns.length} 
                className="px-4 py-8 text-center text-muted-foreground text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={keyExtractor(item, index)}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-muted/30',
                  !onRowClick && 'hover:bg-muted/20'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-sm',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className
                    )}
                  >
                    {col.render(item, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
