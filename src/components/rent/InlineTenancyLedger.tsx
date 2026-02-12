import { useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { PoundSterling, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useTenancyLedger, useRentSchedule, type LedgerEntry } from '@/hooks/useRentCollection';
import RecordPaymentDialog from '@/components/rent/RecordPaymentDialog';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

interface InlineTenancyLedgerProps {
  tenancyId: string;
  colSpan: number;
}

export function InlineTenancyLedger({ tenancyId, colSpan }: InlineTenancyLedgerProps) {
  const { data: ledger, isLoading } = useTenancyLedger(tenancyId);
  const { data: scheduleItems } = useRentSchedule({ tenancyId });
  const [paymentItem, setPaymentItem] = useState<any>(null);

  // Only show past & current entries (not future) in inline view
  const visibleEntries = ledger?.filter(e => !e.is_future) ?? [];

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan}>
          <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading ledger…
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (!ledger || visibleEntries.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan}>
          <div className="text-center py-4 text-muted-foreground text-sm">
            No ledger entries yet
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // Get the first schedule item for recording payment
  const firstItem = scheduleItems?.[0];

  return (
    <>
      <TableRow>
        <TableCell colSpan={colSpan} className="p-0">
          <div className="border-t border-border bg-muted/20 px-6 py-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground">Tenancy Ledger</h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { if (firstItem) setPaymentItem(firstItem); }}
                >
                  <PoundSterling className="h-3.5 w-3.5 mr-1" />
                  Log Payment
                </Button>
                <Link to={`/rent/tenancy/${tenancyId}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    Full Ledger →
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-md border border-border overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="py-2">Date</TableHead>
                    <TableHead className="py-2">Type</TableHead>
                    <TableHead className="py-2">Status</TableHead>
                    <TableHead className="text-right py-2">Amount</TableHead>
                    <TableHead className="text-right py-2">Balance</TableHead>
                    <TableHead className="py-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEntries.map((entry) => (
                    <InlineLedgerRow key={entry.id} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TableCell>
      </TableRow>

      <RecordPaymentDialog
        item={paymentItem}
        open={!!paymentItem}
        onOpenChange={(open) => { if (!open) setPaymentItem(null); }}
      />
    </>
  );
}

function InlineLedgerRow({ entry }: { entry: LedgerEntry }) {
  const isPayment = entry.type === 'payment';

  return (
    <TableRow className={cn('text-sm', isPayment && 'bg-green-50/50 dark:bg-green-950/10')}>
      <TableCell className={cn('py-1.5 tabular-nums', isPayment && 'text-green-600')}>
        {format(new Date(entry.date), 'dd MMM yyyy')}
      </TableCell>
      <TableCell className="py-1.5">{entry.description}</TableCell>
      <TableCell className="py-1.5">{getStatusBadge(entry)}</TableCell>
      <TableCell className={cn('text-right py-1.5 tabular-nums font-medium', isPayment ? 'text-green-600' : '')}>
        {isPayment ? `−${fmt(Math.abs(entry.amount))}` : fmt(entry.amount)}
      </TableCell>
      <TableCell className={cn(
        'text-right py-1.5 tabular-nums',
        entry.running_balance > 0 ? 'text-destructive font-bold' : ''
      )}>
        {fmt(entry.running_balance)}
      </TableCell>
      <TableCell className="py-1.5">
        {entry.rent_schedule_id && entry.type === 'rent' && (
          <Link to={`/rent/${entry.rent_schedule_id}`} className="text-xs text-primary hover:underline">
            View
          </Link>
        )}
      </TableCell>
    </TableRow>
  );
}

function getStatusBadge(entry: LedgerEntry) {
  if (entry.is_future || entry.type === 'payment') return null;
  switch (entry.status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs py-0">Paid</Badge>;
    case 'overdue':
      return <Badge variant="destructive" className="text-xs py-0">Overdue</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 text-xs py-0">Partial</Badge>;
    case 'due':
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-xs py-0">Due</Badge>;
    case 'bad_debt':
      return <Badge variant="destructive" className="text-xs py-0">Bad Debt</Badge>;
    default:
      return null;
  }
}
