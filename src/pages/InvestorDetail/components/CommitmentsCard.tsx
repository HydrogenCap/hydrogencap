import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { COMMITMENT_TYPE_LABEL, STATUS_BADGE, fmt } from '../utils/badges';

export function CommitmentsCard({
  commitments,
  onAdd,
}: {
  commitments: Array<Record<string, unknown>> | undefined;
  onAdd: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Capital Commitments</CardTitle>
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />Add Commitment
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Committed</TableHead>
                <TableHead className="text-right">Drawn</TableHead>
                <TableHead className="text-right">Undrawn</TableHead>
                <TableHead className="text-right">Equity %</TableHead>
                <TableHead className="text-right">Share of Value</TableHead>
                <TableHead className="text-center">Properties</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Maturity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!commitments || commitments.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No commitments yet</TableCell>
                </TableRow>
              ) : commitments.map((c) => {
                const r = c as Record<string, string | number | null | undefined>;
                const statusConfig = STATUS_BADGE[(r.status as string) || 'active'] || STATUS_BADGE.active;
                return (
                  <TableRow key={r.commitment_id as string}>
                    <TableCell className="font-semibold">{r.entity_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {COMMITMENT_TYPE_LABEL[(r.commitment_type as string) || ''] || r.commitment_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.committed_amount as number)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.drawn_amount as number)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.undrawn_amount as number)}</TableCell>
                    <TableCell className="text-right">{r.equity_percentage ? `${r.equity_percentage}%` : '-'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.investors_share_valuation as number)}</TableCell>
                    <TableCell className="text-center">{r.property_count || 0}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig.className}>{statusConfig.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.commitment_date ? format(new Date(r.commitment_date as string), 'dd MMM yyyy') : '-'}</TableCell>
                    <TableCell className="text-sm">{r.maturity_date ? format(new Date(r.maturity_date as string), 'dd MMM yyyy') : '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
