import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatGBPDecimal } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import type { EntityFinancialSummary } from '@/lib/financialSnapshotTypes';

interface Props {
  data: EntityFinancialSummary[];
  isLoading: boolean;
}

const ENTITY_TYPE_BG: Record<string, string> = {
  spv: 'bg-blue-100 text-blue-700', personal: 'bg-emerald-100 text-emerald-700',
  joint_venture: 'bg-purple-100 text-purple-700', trust: 'bg-amber-100 text-amber-700',
};

export function EntitySummaryTable({ data, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-32" />;
  if (data.length === 0) return <p className="text-muted-foreground text-center py-6">No entity data for this month.</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Entity</th>
          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Properties</th>
          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Monthly Rent</th>
          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Monthly Costs</th>
          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Monthly NOI</th>
          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Monthly Cash Flow</th>
        </tr>
      </thead>
      <tbody>
        {data.map((e) => (
          <tr key={e.entity_id} className="border-b border-border/50">
            <td className="px-3 py-2">
              <span className="font-medium">{e.entity_name}</span>
              <Badge className={cn('ml-2 text-xs', ENTITY_TYPE_BG[e.entity_type] || '')} variant="secondary">{e.entity_type}</Badge>
            </td>
            <td className="px-3 py-2">{e.property_count}</td>
            <td className="px-3 py-2">{formatGBPDecimal(e.total_rent_received)}</td>
            <td className="px-3 py-2">{formatGBPDecimal(e.total_costs)}</td>
            <td className={cn('px-3 py-2 font-medium', e.total_noi >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {formatGBPDecimal(e.total_noi)}
            </td>
            <td className={cn('px-3 py-2', e.total_cash_flow >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {formatGBPDecimal(e.total_cash_flow)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
