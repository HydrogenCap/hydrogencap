import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Download, FileText, ChevronRight, Check } from 'lucide-react';
import { formatGBP, formatGBPDecimal, formatDateShort } from '@/lib/calculations';
import {
  useDistributionRuns,
  useDistributionLineItems,
  useApproveDistribution,
  useMarkPayment,
  useCancelDistribution,
  type DistributionRun,
} from '@/hooks/useDistributionWorkflow';
import { InvestorStatement } from './InvestorStatement';

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  review: { label: 'In Review', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  processing: { label: 'Processing', variant: 'outline', className: 'border-amber-500 text-amber-600' },
  completed: { label: 'Completed', variant: 'default', className: 'bg-success text-success-foreground' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

function LineItemsExpanded({ run }: { run: DistributionRun }) {
  const { data: lineItems, isLoading } = useDistributionLineItems(run.id);
  const approve = useApproveDistribution();
  const cancel = useCancelDistribution();
  const markPaid = useMarkPayment();
  const [statementItem, setStatementItem] = useState<typeof lineItems extends (infer T)[] | undefined ? T : never>(undefined);

  if (isLoading) return <p className="text-sm text-muted-foreground p-2">Loading line items...</p>;
  if (!lineItems?.length) return <p className="text-sm text-muted-foreground p-2">No line items.</p>;

  const paidCount = lineItems.filter(li => li.payment_status === 'paid').length;
  const pendingCount = lineItems.filter(li => li.payment_status === 'pending').length;

  return (
    <div className="space-y-3 pt-2">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Distributable:</span>{' '}
          <span className="font-medium text-primary">{formatGBP(run.total_distributable)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Distributed:</span>{' '}
          <span className="font-medium text-success">{formatGBP(run.total_distributed)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Retained:</span>{' '}
          <span className="font-medium">{formatGBP(run.retained_amount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Payments:</span>{' '}
          <Badge variant="default" className="text-xs">{paidCount} paid</Badge>{' '}
          {pendingCount > 0 && <Badge variant="secondary" className="text-xs">{pendingCount} pending</Badge>}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Investor</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map(li => (
              <TableRow key={li.id}>
                <TableCell className="font-medium">
                  {li.investor?.investor_name || 'Unknown'}
                </TableCell>
                <TableCell className="text-right">{li.ownership_pct.toFixed(1)}%</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatGBPDecimal(li.gross_amount)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatGBPDecimal(li.withholding_tax)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">{formatGBPDecimal(li.net_amount)}</TableCell>
                <TableCell className="text-center">
                  {li.payment_status === 'paid' ? (
                    <Badge className="bg-success text-success-foreground">Paid</Badge>
                  ) : li.payment_status === 'failed' ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    {li.payment_status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markPaid.mutate({ id: li.id })}
                        disabled={markPaid.isPending}
                      >
                        <Check className="h-3 w-3 mr-1" /> Paid
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setStatementItem(li)}
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        {run.status === 'draft' && (
          <>
            <Button size="sm" variant="destructive" onClick={() => cancel.mutate(run.id)} disabled={cancel.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => approve.mutate(run.id)} disabled={approve.isPending}>
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
          </>
        )}
      </div>

      {/* Investor Statement Dialog */}
      {statementItem && (
        <Dialog open={!!statementItem} onOpenChange={() => setStatementItem(undefined)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Investor Statement</DialogTitle>
            </DialogHeader>
            <InvestorStatement run={run} lineItem={statementItem} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function exportToCSV(runs: DistributionRun[]) {
  const headers = ['Period', 'Status', 'Distributable', 'Distributed', 'Retained', 'Created'];
  const rows = runs.map(r => [
    r.period,
    r.status,
    r.total_distributable.toFixed(2),
    r.total_distributed.toFixed(2),
    r.retained_amount.toFixed(2),
    formatDateShort(r.created_at),
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `distribution-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DistributionHistory() {
  const { data: runs, isLoading } = useDistributionRuns();

  const sortedRuns = useMemo(() => {
    if (!runs) return [];
    return [...runs].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [runs]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading distribution history...
        </CardContent>
      </Card>
    );
  }

  if (!sortedRuns.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Distribution History</CardTitle>
          <CardDescription>Past and active distribution runs</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => exportToCSV(sortedRuns)}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {sortedRuns.map(run => {
            const statusConfig = STATUS_BADGE[run.status] || STATUS_BADGE.draft;
            return (
              <AccordionItem key={run.id} value={run.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{run.period}</span>
                      <Badge variant={statusConfig.variant} className={statusConfig.className}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Distributed: <span className="font-medium text-success">{formatGBP(run.total_distributed)}</span>
                      </span>
                      <span className="text-muted-foreground hidden md:inline">
                        {formatDateShort(run.created_at)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <LineItemsExpanded run={run} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
