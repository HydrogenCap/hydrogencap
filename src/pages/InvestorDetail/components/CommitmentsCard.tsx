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
              ) : commitments.map((c: any) => {
                const statusConfig = STATUS_BADGE[c.status || 'active'] || STATUS_BADGE.active;
                return (
                  <TableRow key={c.commitment_id}>
                    <TableCell className="font-semibold">{c.entity_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {COMMITMENT_TYPE_LABEL[c.commitment_type || ''] || c.commitment_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(c.committed_amount)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(c.drawn_amount)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(c.undrawn_amount)}</TableCell>
                    <TableCell className="text-right">{c.equity_percentage ? `${c.equity_percentage}%` : '-'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(c.investors_share_valuation)}</TableCell>
                    <TableCell className="text-center">{c.property_count || 0}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig.className}>{statusConfig.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.commitment_date ? format(new Date(c.commitment_date), 'dd MMM yyyy') : '-'}</TableCell>
                    <TableCell className="text-sm">{c.maturity_date ? format(new Date(c.maturity_date), 'dd MMM yyyy') : '-'}</TableCell>
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
