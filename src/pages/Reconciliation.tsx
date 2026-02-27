import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, CheckCircle2, Link2, Loader2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUnreconciledTransactions } from '@/hooks/useBankTransactions';
import { useRentSchedule, type RentScheduleWithDetails } from '@/hooks/useRentCollection';
import { useReconcileTransaction, useBulkReconcile } from '@/hooks/useBankTransactions';
import { findMatches, getConfidenceLabel, type ReconciliationMatch } from '@/lib/reconciliationMatcher';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

export default function Reconciliation() {
  const navigate = useNavigate();
  const { data: transactions, isLoading: txnLoading } = useUnreconciledTransactions();
  const { data: schedule, isLoading: schedLoading } = useRentSchedule();
  const reconcile = useReconcileTransaction();
  const bulkReconcile = useBulkReconcile();

  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  const matches = useMemo(() => {
    if (!transactions || !schedule) return [];
    return findMatches(transactions, schedule);
  }, [transactions, schedule]);

  const visibleMatches = matches.filter(
    m => !confirmedIds.has(m.transaction.id) && !rejectedIds.has(m.transaction.id)
  );

  const highConfidence = visibleMatches.filter(m => m.confidence >= 0.85);
  const unmatchedTxns = useMemo(() => {
    if (!transactions) return [];
    const matchedIds = new Set(matches.map(m => m.transaction.id));
    return transactions.filter(t => !matchedIds.has(t.id) && !confirmedIds.has(t.id));
  }, [transactions, matches, confirmedIds]);

  const handleConfirm = (match: ReconciliationMatch) => {
    reconcile.mutate({
      transactionId: match.transaction.id,
      rentScheduleId: match.scheduleItem.id,
      amount: match.transaction.amount,
      paymentDate: match.transaction.transaction_date,
      tenancyId: match.scheduleItem.tenancy_id,
      confidence: match.confidence,
    }, {
      onSuccess: () => setConfirmedIds(prev => new Set(prev).add(match.transaction.id)),
    });
  };

  const handleReject = (txnId: string) => {
    setRejectedIds(prev => new Set(prev).add(txnId));
  };

  const handleBulkConfirm = () => {
    const items = highConfidence.map(m => ({
      transactionId: m.transaction.id,
      rentScheduleId: m.scheduleItem.id,
      amount: m.transaction.amount,
      paymentDate: m.transaction.transaction_date,
      tenancyId: m.scheduleItem.tenancy_id,
      confidence: m.confidence,
    }));
    bulkReconcile.mutate(items, {
      onSuccess: () => {
        const ids = new Set(confirmedIds);
        highConfidence.forEach(m => ids.add(m.transaction.id));
        setConfirmedIds(ids);
      },
    });
  };

  const isLoading = txnLoading || schedLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/rent')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Link2 className="h-6 w-6" />
              Reconciliation
            </h1>
            <p className="text-muted-foreground">Match bank transactions to rent entries</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Unreconciled Transactions</p>
              <p className="text-2xl font-bold">{transactions?.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Suggested Matches</p>
              <p className="text-2xl font-bold">{visibleMatches.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">High Confidence</p>
              <p className="text-2xl font-bold text-green-600">{highConfidence.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Bulk confirm */}
        {highConfidence.length > 0 && (
          <Button onClick={handleBulkConfirm} disabled={bulkReconcile.isPending}>
            {bulkReconcile.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-1" />
            )}
            Confirm All High-Confidence Matches ({highConfidence.length})
          </Button>
        )}

        {/* Matches */}
        {visibleMatches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Suggested Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Bank Transaction</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Rent Entry</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMatches.map(match => {
                    const { label, color } = getConfidenceLabel(match.confidence);
                    return (
                      <TableRow key={match.transaction.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{match.transaction.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(match.transaction.transaction_date), 'dd MMM yyyy')}
                            {match.transaction.reference && ` · ${match.transaction.reference}`}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums font-medium text-green-600">
                          {fmt(match.transaction.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {match.scheduleItem.tenancy.tenant.first_name} {match.scheduleItem.tenancy.tenant.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {match.scheduleItem.tenancy.room.room_name} · {fmt(match.scheduleItem.amount_outstanding)} outstanding
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', color)}>{label}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">{match.reason}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => handleConfirm(match)} disabled={reconcile.isPending}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Confirm
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleReject(match.transaction.id)}>
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Unmatched */}
        {unmatchedTxns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unmatched Transactions ({unmatchedTxns.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedTxns.map(txn => (
                    <TableRow key={txn.id}>
                      <TableCell className="tabular-nums text-sm">
                        {format(new Date(txn.transaction_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-sm">{txn.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{txn.reference || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-green-600">
                        {fmt(txn.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!isLoading && visibleMatches.length === 0 && unmatchedTxns.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="font-medium">All caught up!</p>
            <p className="text-sm">No unreconciled transactions. Import a bank statement to get started.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
