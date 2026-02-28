import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { PoundSterling, Loader2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useTenancyLedger, useRentSchedule, type LedgerEntry, type RentScheduleWithDetails } from '@/hooks/useRentCollection';
import { useReconciledScheduleIds } from '@/hooks/useReconciliation';
import RecordPaymentDialog from '@/components/rent/RecordPaymentDialog';
import BulkMarkPaidDialog from '@/components/rent/BulkMarkPaidDialog';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

interface InlineTenancyLedgerProps {
  tenancyId: string;
  colSpan: number;
}

export function InlineTenancyLedger({ tenancyId, colSpan }: InlineTenancyLedgerProps) {
  const { data: ledger, isLoading } = useTenancyLedger(tenancyId);
  const { data: scheduleItems } = useRentSchedule({ tenancyId });
  const { data: reconciledIds } = useReconciledScheduleIds();
  const [paymentItem, setPaymentItem] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [markPaidMode, setMarkPaidMode] = useState<'on_time' | 'late' | null>(null);

  // Only show past & current entries (not future) in inline view
  const visibleEntries = ledger?.filter(e => !e.is_future) ?? [];

  // Unpaid rent entries that can be selected
  const selectableEntries = useMemo(() =>
    visibleEntries.filter(e => e.type === 'rent' && e.status !== 'paid' && e.rent_schedule_id),
    [visibleEntries]
  );

  const scheduleMap = useMemo(() => {
    const map = new Map<string, RentScheduleWithDetails>();
    scheduleItems?.items?.forEach(s => map.set(s.id, s));
    return map;
  }, [scheduleItems]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === selectableEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableEntries.map(e => e.rent_schedule_id!)));
    }
  };

  const selectedItems = useMemo(() =>
    Array.from(selectedIds).map(id => scheduleMap.get(id)).filter(Boolean) as RentScheduleWithDetails[],
    [selectedIds, scheduleMap]
  );

  const isAllSelected = selectableEntries.length > 0 && selectedIds.size === selectableEntries.length;
  const isPartial = selectedIds.size > 0 && selectedIds.size < selectableEntries.length;

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
                {selectedItems.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setMarkPaidMode('on_time')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Mark {selectedItems.length} as Paid
                  </Button>
                )}
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
                    <TableHead className="py-2 w-10">
                      {selectableEntries.length > 0 && (
                        <Checkbox
                          checked={isAllSelected ? true : isPartial ? 'indeterminate' : false}
                          onCheckedChange={toggleAll}
                          aria-label="Select all unpaid"
                        />
                      )}
                    </TableHead>
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
                    <InlineLedgerRow
                      key={entry.id}
                      entry={entry}
                      isSelected={!!entry.rent_schedule_id && selectedIds.has(entry.rent_schedule_id)}
                      isSelectable={entry.type === 'rent' && entry.status !== 'paid' && !!entry.rent_schedule_id}
                      isReconciled={!!entry.rent_schedule_id && !!reconciledIds?.has(entry.rent_schedule_id)}
                      onToggle={() => entry.rent_schedule_id && toggleSelection(entry.rent_schedule_id)}
                    />
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

      {markPaidMode && (
        <BulkMarkPaidDialog
          items={selectedItems}
          open={!!markPaidMode}
          onOpenChange={(open) => { if (!open) setMarkPaidMode(null); }}
          mode={markPaidMode}
          onSuccess={() => setSelectedIds(new Set())}
        />
      )}
    </>
  );
}

function InlineLedgerRow({
  entry,
  isSelected,
  isSelectable,
  isReconciled,
  onToggle,
}: {
  entry: LedgerEntry;
  isSelected: boolean;
  isSelectable: boolean;
  isReconciled: boolean;
  onToggle: () => void;
}) {
  const isPayment = entry.type === 'payment';

  return (
    <TableRow className={cn('text-sm', isPayment && 'bg-green-50/50 dark:bg-green-950/10', isSelected && 'bg-primary/5')}>
      <TableCell className="py-1.5 w-10">
        {isSelectable && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            aria-label={`Select ${entry.description}`}
          />
        )}
      </TableCell>
      <TableCell className={cn('py-1.5 tabular-nums', isPayment && 'text-green-600')}>
        {format(new Date(entry.date), 'dd MMM yyyy')}
      </TableCell>
      <TableCell className="py-1.5">{entry.description}</TableCell>
      <TableCell className="py-1.5">
        <div className="flex items-center gap-1">
          {getStatusBadge(entry)}
          {isReconciled && (
            <Badge variant="outline" className="text-[10px] py-0 border-green-500/40 text-green-600 dark:text-green-400">
              ✓ Reconciled
            </Badge>
          )}
        </div>
      </TableCell>
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
