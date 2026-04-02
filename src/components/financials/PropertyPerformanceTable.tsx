import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatGBPDecimal } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import type { PropertyAnnualPerformance } from '@/lib/financialSnapshotTypes';

interface Props {
  data: PropertyAnnualPerformance[];
}

type PerformanceSortField = 'annual_noi' | 'annual_cash_flow' | 'net_yield_pct' | 'cash_on_cash_return_pct' | 'avg_occupancy' | 'avg_collection_rate' | 'annual_rent_received' | 'annual_costs';

function colorValue(val: number | null, greenThresh: number, amberThresh: number) {
  if (val == null) return 'text-muted-foreground';
  if (val >= greenThresh) return 'text-emerald-600 dark:text-emerald-400';
  if (val >= amberThresh) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function PropertyPerformanceTable({ data }: Props) {
  const navigate = useNavigate();
  const [sortField, setPerformanceSortField] = useState<PerformanceSortField>('annual_noi');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortField] ?? -Infinity;
      const bv = b[sortField] ?? -Infinity;
      return sortAsc ? av - bv : bv - av;
    });
  }, [data, sortField, sortAsc]);

  const toggleSort = (field: PerformanceSortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setPerformanceSortField(field); setSortAsc(false); }
  };

  const SortHeader = ({ field, label }: { field: PerformanceSortField; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field ? (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">Property Performance (Trailing 12m)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">No financial data yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Property Performance (Trailing 12m)</CardTitle>
          <Button
            variant="outline" size="sm"
            onClick={() => setSortAsc(!sortAsc)}
          >
            {sortAsc ? 'Worst Performers' : 'Best Performers'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Property</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Entity</th>
              <SortHeader field="annual_rent_received" label="Annual Rent" />
              <SortHeader field="annual_costs" label="Annual Costs" />
              <SortHeader field="annual_noi" label="Annual NOI" />
              <SortHeader field="annual_cash_flow" label="Cash Flow" />
              <SortHeader field="net_yield_pct" label="Net Yield" />
              <SortHeader field="cash_on_cash_return_pct" label="Cash-on-Cash" />
              <SortHeader field="avg_occupancy" label="Occupancy" />
              <SortHeader field="avg_collection_rate" label="Collection" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.property_id}
                className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate(`/properties-v2/${p.property_id}`)}
              >
                <td className="px-3 py-2 font-medium text-foreground max-w-[200px] truncate">{p.property_address}</td>
                <td className="px-3 py-2"><Badge variant="secondary" className="text-xs">{p.entity_name}</Badge></td>
                <td className="px-3 py-2">{formatGBPDecimal(p.annual_rent_received)}</td>
                <td className="px-3 py-2">{formatGBPDecimal(p.annual_costs)}</td>
                <td className={cn('px-3 py-2 font-medium', p.annual_noi >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {formatGBPDecimal(p.annual_noi)}
                </td>
                <td className={cn('px-3 py-2', p.annual_cash_flow >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {formatGBPDecimal(p.annual_cash_flow)}
                </td>
                <td className={cn('px-3 py-2', colorValue(p.net_yield_pct, 6, 4))}>
                  {p.net_yield_pct != null ? `${p.net_yield_pct.toFixed(1)}%` : '—'}
                </td>
                <td className={cn('px-3 py-2', colorValue(p.cash_on_cash_return_pct, 8, 5))}>
                  {p.cash_on_cash_return_pct != null ? `${p.cash_on_cash_return_pct.toFixed(1)}%` : '—'}
                </td>
                <td className={cn('px-3 py-2', colorValue(p.avg_occupancy, 92, 85))}>
                  {p.avg_occupancy != null ? `${p.avg_occupancy.toFixed(0)}%` : '—'}
                </td>
                <td className={cn('px-3 py-2', colorValue(p.avg_collection_rate, 95, 90))}>
                  {p.avg_collection_rate != null ? `${p.avg_collection_rate.toFixed(0)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
