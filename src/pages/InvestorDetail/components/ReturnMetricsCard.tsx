import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Database } from '@/integrations/supabase/types';
import { fmt } from '../utils/badges';

type ReturnMetricsRow = Database['public']['Views']['investor_return_metrics']['Row'];

export function ReturnMetricsCard({
  returnMetrics,
}: {
  returnMetrics: ReturnMetricsRow[] | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Return Metrics</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead className="text-right">Capital Invested</TableHead>
              <TableHead className="text-right">Total Distributions</TableHead>
              <TableHead className="text-right">Current Equity Value</TableHead>
              <TableHead className="text-right">Cash-on-Cash %</TableHead>
              <TableHead className="text-right">Equity Multiple</TableHead>
              <TableHead className="text-right">Unrealised Gain/Loss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!returnMetrics || returnMetrics.length === 0) ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No return data available</TableCell>
              </TableRow>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: investor_return_metrics view row; pending V2 view typing.
            ) : returnMetrics.map((m: any) => {
              const emColor = (m.equity_multiple || 0) >= 1.5 ? 'text-emerald-600' : (m.equity_multiple || 0) >= 1 ? 'text-amber-600' : 'text-destructive';
              const gainColor = (m.unrealised_gain_loss || 0) >= 0 ? 'text-emerald-600' : 'text-destructive';
              return (
                <TableRow key={m.commitment_id}>
                  <TableCell className="font-semibold">{m.entity_name}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(m.capital_invested)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(m.total_distributions)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmt(m.current_equity_value)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{(m.cash_on_cash_pct || 0).toFixed(1)}%</TableCell>
                  <TableCell className={`text-right font-mono text-sm font-semibold ${emColor}`}>
                    {(m.equity_multiple || 0).toFixed(2)}x
                  </TableCell>
                  <TableCell className={`text-right font-mono text-sm font-semibold ${gainColor}`}>
                    {fmt(m.unrealised_gain_loss)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
