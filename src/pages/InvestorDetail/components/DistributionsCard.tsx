import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Database } from '@/integrations/supabase/types';
import { DIST_TYPE_LABEL, fmt } from '../utils/badges';

type DistributionRow = Database['public']['Tables']['investor_distributions']['Row'];

export function DistributionsCard({
  distributions,
  distStats,
  onAdd,
}: {
  distributions: DistributionRow[] | undefined;
  distStats: { allTime: number; thisYear: number; lastYear: number; yield: number };
  onAdd: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Distributions</CardTitle>
          <div className="flex gap-6 mt-2 text-sm text-muted-foreground">
            <span>All-time: <strong className="text-foreground">{fmt(distStats.allTime)}</strong></span>
            <span>This year: <strong className="text-foreground">{fmt(distStats.thisYear)}</strong></span>
            <span>Last year: <strong className="text-foreground">{fmt(distStats.lastYear)}</strong></span>
            <span>Yield: <strong className="text-foreground">{distStats.yield.toFixed(1)}%</strong></span>
          </div>
        </div>
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />Record Distribution
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!distributions || distributions.length === 0) ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No distributions recorded</TableCell>
              </TableRow>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: investor_distributions view row; pending V2 view typing.
            ) : distributions.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="text-sm">{format(new Date(d.distribution_date), 'dd MMM yyyy')}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{DIST_TYPE_LABEL[d.distribution_type] || d.distribution_type}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(d.amount)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(d.tax_deducted)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{fmt(d.net_amount)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.period_from && d.period_to
                    ? `${format(new Date(d.period_from), 'MMM yy')} - ${format(new Date(d.period_to), 'MMM yy')}`
                    : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.payment_reference || '-'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={d.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                    {d.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
