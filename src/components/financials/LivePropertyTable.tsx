import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatGBPDecimal } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import type { PropertyFinancialSummary } from '@/hooks/usePortfolioFinancials';

interface Props {
  data: PropertyFinancialSummary[];
}

type LivePropertySortField = 'monthlyIncome' | 'monthlyCosts' | 'noi' | 'cashflow' | 'netYield';

export function LivePropertyTable({ data }: Props) {
  const navigate = useNavigate();
  const [sortField, setLivePropertySortField] = useState<LivePropertySortField>('netYield');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortField] ?? -Infinity;
      const bv = b[sortField] ?? -Infinity;
      return sortAsc ? av - bv : bv - av;
    });
  }, [data, sortField, sortAsc]);

  const toggleSort = (field: LivePropertySortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setLivePropertySortField(field); setSortAsc(false); }
  };

  const SortHeader = ({ field, label }: { field: LivePropertySortField; label: string }) => (
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
        <CardHeader><CardTitle className="text-lg">Property Performance (Live)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">No property data yet.</p>
        </CardContent>
      </Card>
    );
  }

  const statusIcon = (s: string) => s === 'positive' ? '🟢' : s === 'breakeven' ? '🟡' : '🔴';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Property Performance (Live)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Property</th>
              <SortHeader field="monthlyIncome" label="Income/mo" />
              <SortHeader field="monthlyCosts" label="Costs/mo" />
              <SortHeader field="noi" label="NOI/mo" />
              <SortHeader field="cashflow" label="Cashflow/mo" />
              <SortHeader field="netYield" label="Net Yield" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.propertyId}
                className={cn(
                  'border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors',
                  p.status === 'negative' && 'bg-destructive/5'
                )}
                onClick={() => navigate(`/properties-v2/${p.propertyId}`)}
              >
                <td className="px-3 py-2.5">
                  <div className="font-medium text-foreground max-w-[220px] truncate">{p.address}</div>
                  <div className="text-xs text-muted-foreground">{p.entityName}</div>
                </td>
                <td className="px-3 py-2.5">{formatGBPDecimal(p.monthlyIncome)}</td>
                <td className="px-3 py-2.5">{formatGBPDecimal(p.monthlyCosts)}</td>
                <td className={cn('px-3 py-2.5 font-medium', p.noi >= 0 ? 'text-primary' : 'text-destructive')}>
                  {formatGBPDecimal(p.noi)}
                </td>
                <td className={cn('px-3 py-2.5 font-medium', p.cashflow >= 0 ? 'text-primary' : 'text-destructive')}>
                  {formatGBPDecimal(p.cashflow)}
                </td>
                <td className={cn('px-3 py-2.5', p.netYield >= 6 ? 'text-primary' : p.netYield >= 4 ? 'text-warning' : 'text-destructive')}>
                  {p.netYield.toFixed(1)}%
                </td>
                <td className="px-3 py-2.5 text-center">{statusIcon(p.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
