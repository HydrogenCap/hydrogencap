import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { History } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useRentHistory } from '@/hooks/useRentManagement';
import { ListState } from '@/components/ListState';

const formatGBP = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  standing_order: 'Standing Order',
  direct_debit: 'Direct Debit',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};

export function PaymentHistoryList() {
  const { data: payments, isLoading, error, refetch } = useRentHistory();
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  const filtered = useMemo(() => {
    if (!payments) return [];
    return payments.filter(p => {
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const searchable = [
          p.reference,
          p.notes,
          p.payment_method,
          p.amount.toString(),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [payments, search, methodFilter]);

  return (
    <ListState
      isLoading={isLoading}
      error={(error as Error | null) ?? null}
      isEmpty={!isLoading && (payments?.length ?? 0) === 0}
      emptyTitle="No payment history yet"
      emptyDescription="Recorded rent payments will appear here once tenants start paying."
      emptyIcon={History}
      onRetry={() => refetch()}
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Input
              placeholder="Search by reference, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {Object.entries(METHOD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Reconciled</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <History className="h-6 w-6 mx-auto mb-2 text-muted-foreground/70" />
                    No payments match your filters
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm tabular-nums">
                      {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium text-green-600">
                      {formatGBP(payment.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {METHOD_LABELS[payment.payment_method || ''] || payment.payment_method || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {payment.reference || '—'}
                    </TableCell>
                    <TableCell>
                      {payment.is_reconciled ? (
                        <Badge variant="outline" className="text-xs border-green-500/40 text-green-600">
                          Reconciled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {payment.notes || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </ListState>
  );
}
