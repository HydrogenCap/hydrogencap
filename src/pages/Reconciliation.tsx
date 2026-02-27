import { useState, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Wand2, Check, X, Ban, ArrowLeft } from 'lucide-react';
import { formatGBP } from '@/lib/calculations';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

import { useBankAccounts } from '@/hooks/useBankAccounts';
import {
  useImportStatement,
  useUnmatchedTransactions,
  useMatchedTransactions,
  useRunAutoMatch,
  useConfirmMatch,
  useBulkConfirmMatches,
  useRejectMatch,
  useExcludeTransaction,
  useReconciliationSummary,
} from '@/hooks/useReconciliation';
import { confidenceLabel, confidenceBadgeClass } from '@/lib/reconciliationEngine';

// ─── Import Section ──────────────────────────────────────────────────

function ImportSection({ bankAccountId }: { bankAccountId: string }) {
  const importStatement = useImportStatement();

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    importStatement.mutate({ csvText: text, bankAccountId });
    e.target.value = '';
  }, [bankAccountId, importStatement]);

  return (
    <label className="cursor-pointer">
      <input type="file" accept=".csv,.ofx" className="hidden" onChange={handleFileUpload} />
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed",
        "border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors",
        "text-sm font-medium text-primary"
      )}>
        <Upload className="h-4 w-4" />
        Import Statement
      </div>
    </label>
  );
}

// ─── Transaction Row ─────────────────────────────────────────────────

function TransactionRow({
  txn,
  confidence,
  onConfirm,
  onReject,
  onExclude,
  isConfirming,
}: {
  txn: any;
  confidence?: number;
  onConfirm?: () => void;
  onReject?: () => void;
  onExclude?: () => void;
  isConfirming?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{formatGBP(txn.amount)}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(txn.transaction_date), 'dd MMM yyyy')}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{txn.description}</p>
        {txn.reference && (
          <p className="text-xs text-muted-foreground/70 truncate">Ref: {txn.reference}</p>
        )}
        {confidence !== undefined && (
          <Badge className={cn('text-[10px] mt-1', confidenceBadgeClass(confidence))}>
            {confidenceLabel(confidence)} ({confidence}%)
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onConfirm && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600"
            onClick={onConfirm} disabled={isConfirming}>
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        {onReject && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
            onClick={onReject}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        {onExclude && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
            onClick={onExclude} title="Not rent">
            <Ban className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function Reconciliation() {
  const navigate = useNavigate();
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();

  const { data: accounts } = useBankAccounts();
  const { data: unmatched } = useUnmatchedTransactions(selectedAccountId);
  const { data: matched } = useMatchedTransactions(selectedAccountId);
  const { data: summary } = useReconciliationSummary(selectedAccountId);

  const autoMatch = useRunAutoMatch();
  const confirmMatch = useConfirmMatch();
  const bulkConfirm = useBulkConfirmMatches();
  const rejectMatch = useRejectMatch();
  const excludeTxn = useExcludeTransaction();

  // Split unmatched into suggested vs truly unmatched
  const suggested = useMemo(() =>
    (unmatched || []).filter((t: any) => t.status === 'suggested'),
  [unmatched]);

  const trulyUnmatched = useMemo(() =>
    (unmatched || []).filter((t: any) => t.status === 'unmatched'),
  [unmatched]);

  // Auto-select first account
  const effectiveAccountId = selectedAccountId || accounts?.[0]?.id;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/rent')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Rent Reconciliation</h1>
              <p className="text-muted-foreground">Match bank statement entries to rent payments</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {effectiveAccountId && (
              <ImportSection bankAccountId={effectiveAccountId} />
            )}
          </div>
        </div>

        {/* Bank Account Selector + Auto-Match */}
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={effectiveAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select bank account" />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => autoMatch.mutate(effectiveAccountId)}
            disabled={autoMatch.isPending}
            className="gap-2"
          >
            <Wand2 className="h-4 w-4" />
            Auto-Match
          </Button>

          {suggested.length > 0 && (
            <Button
              variant="default"
              onClick={() => {
                const pairs = suggested
                  .filter((t: any) => t.matched_schedule_id)
                  .map((t: any) => ({ transactionId: t.id, scheduleId: t.matched_schedule_id! }));
                bulkConfirm.mutate(pairs);
              }}
              disabled={bulkConfirm.isPending}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Confirm All ({suggested.length})
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase">Unmatched</p>
                <p className="text-xl font-bold">{summary.unmatched.count}</p>
                <p className="text-xs text-muted-foreground">{formatGBP(summary.unmatched.total)}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30">
              <CardContent className="pt-4">
                <p className="text-xs text-amber-600 dark:text-amber-400 uppercase">Suggested</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{summary.suggested.count}</p>
                <p className="text-xs text-muted-foreground">{formatGBP(summary.suggested.total)}</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/30">
              <CardContent className="pt-4">
                <p className="text-xs text-green-600 dark:text-green-400 uppercase">Matched</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{summary.matched.count}</p>
                <p className="text-xs text-muted-foreground">{formatGBP(summary.matched.total)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase">Excluded / Non-Rent</p>
                <p className="text-xl font-bold">{summary.excluded.count + summary.non_rent.count}</p>
                <p className="text-xs text-muted-foreground">
                  {formatGBP(summary.excluded.total + summary.non_rent.total)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Three-column layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Column 1: Unmatched */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Unmatched
                {trulyUnmatched.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{trulyUnmatched.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
              {trulyUnmatched.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  All transactions matched or excluded
                </p>
              ) : (
                trulyUnmatched.map((txn: any) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    onExclude={() => excludeTxn.mutate({ id: txn.id, reason: 'non_rent' })}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Column 2: Suggested Matches */}
          <Card className="border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Suggested Matches
                {suggested.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-amber-600 dark:text-amber-400 border-amber-500/40">
                    {suggested.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
              {suggested.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Run Auto-Match to find suggestions
                </p>
              ) : (
                suggested.map((txn: any) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    onConfirm={() => confirmMatch.mutate({
                      transactionId: txn.id,
                      scheduleId: txn.matched_schedule_id!,
                    })}
                    onReject={() => rejectMatch.mutate(txn.id)}
                    isConfirming={confirmMatch.isPending}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Column 3: Confirmed */}
          <Card className="border-green-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Confirmed
                {matched && matched.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-green-600 dark:text-green-400 border-green-500/40">
                    {matched.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
              {(!matched || matched.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No confirmed matches yet
                </p>
              ) : (
                matched.slice(0, 50).map((txn: any) => (
                  <TransactionRow key={txn.id} txn={txn} />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
