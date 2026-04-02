import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Upload,
  Link2,
  Unlink,
  EyeOff,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useBankStatements,
  useTransactions,
  useImportBankStatement,
  useReconcileTransaction,
  useUnmatchBankEntry,
  useIgnoreBankEntry,
  CATEGORY_LABEL_MAP,
  type BankStatementEntry,
  type FinancialTransaction,
} from '@/hooks/useAccounting';

const fmt = (n: number) =>
  `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface MatchSuggestion {
  entry: BankStatementEntry;
  transaction: FinancialTransaction;
  score: number;
  reason: string;
}

function computeAutoMatches(
  entries: BankStatementEntry[],
  transactions: FinancialTransaction[],
): MatchSuggestion[] {
  const unmatched = entries.filter(e => e.status === 'unmatched');
  const unreconciledTxns = transactions.filter(t => !t.reconciled);
  const suggestions: MatchSuggestion[] = [];

  for (const entry of unmatched) {
    let bestMatch: { txn: FinancialTransaction; score: number; reason: string } | null = null;

    for (const txn of unreconciledTxns) {
      let score = 0;
      const reasons: string[] = [];

      // Amount match (exact)
      if (Math.abs(Number(entry.amount) - Number(txn.amount)) < 0.01) {
        score += 50;
        reasons.push('exact amount');
      } else if (Math.abs(Math.abs(Number(entry.amount)) - Math.abs(Number(txn.amount))) < 0.01) {
        score += 40;
        reasons.push('amount (abs)');
      }

      // Date proximity
      const daysDiff = Math.abs(differenceInDays(parseISO(entry.date), parseISO(txn.date)));
      if (daysDiff === 0) {
        score += 30;
        reasons.push('same date');
      } else if (daysDiff <= 3) {
        score += 20;
        reasons.push(`${daysDiff}d apart`);
      } else if (daysDiff <= 7) {
        score += 10;
        reasons.push(`${daysDiff}d apart`);
      }

      // Description keyword overlap
      const entryWords = new Set(entry.description.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const txnWords = new Set(txn.description.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const overlap = [...entryWords].filter(w => txnWords.has(w)).length;
      if (overlap > 0) {
        score += overlap * 10;
        reasons.push(`${overlap} keyword${overlap > 1 ? 's' : ''}`);
      }

      // Reference match
      if (txn.bank_statement_ref && entry.description.includes(txn.bank_statement_ref)) {
        score += 30;
        reasons.push('ref match');
      }

      if (score >= 50 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { txn, score, reason: reasons.join(', ') };
      }
    }

    if (bestMatch) {
      suggestions.push({
        entry,
        transaction: bestMatch.txn,
        score: bestMatch.score,
        reason: bestMatch.reason,
      });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score);
}

export function BankReconciliation() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: allEntries, isLoading: entriesLoading } = useBankStatements();
  const { data: allTransactions, isLoading: txnLoading } = useTransactions();
  const importStatement = useImportBankStatement();
  const reconcile = useReconcileTransaction();
  const unmatch = useUnmatchBankEntry();
  const ignore = useIgnoreBankEntry();

  const entries = allEntries || [];
  const transactions = allTransactions || [];

  const unmatchedEntries = useMemo(() => entries.filter(e => e.status === 'unmatched'), [entries]);
  const matchedEntries = useMemo(() => entries.filter(e => e.status === 'matched'), [entries]);
  const ignoredEntries = useMemo(() => entries.filter(e => e.status === 'ignored'), [entries]);
  const unreconciledTxns = useMemo(() => transactions.filter(t => !t.reconciled), [transactions]);

  const autoMatches = useMemo(
    () => computeAutoMatches(entries, transactions),
    [entries, transactions],
  );

  // ── Import CSV/OFX ──
  const [importPreview, setImportPreview] = useState<Array<{ date: string; description: string; amount: number; balance?: number }>>([]);
  const [bankName, setBankName] = useState('');

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('File must have a header row and data');
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const dateIdx = headers.findIndex(h => h.includes('date'));
      const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('narrative') || h.includes('detail'));
      const amountIdx = headers.findIndex(h => h === 'amount' || h.includes('amount'));
      const balIdx = headers.findIndex(h => h.includes('balance'));
      // Try debit/credit columns
      const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('money out'));
      const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('money in'));

      if (dateIdx < 0) {
        toast.error('Could not find Date column');
        return;
      }

      const rows: typeof importPreview = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
        let amount: number;
        if (amountIdx >= 0) {
          amount = parseFloat(cols[amountIdx]?.replace(/[£,]/g, '') || '0');
        } else if (debitIdx >= 0 && creditIdx >= 0) {
          const debit = parseFloat(cols[debitIdx]?.replace(/[£,]/g, '') || '0');
          const credit = parseFloat(cols[creditIdx]?.replace(/[£,]/g, '') || '0');
          amount = credit - debit;
        } else {
          continue;
        }
        if (isNaN(amount)) continue;

        // Try to parse date (support dd/mm/yyyy, yyyy-mm-dd)
        let dateStr = cols[dateIdx];
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
          const [d, m, y] = dateStr.split('/');
          dateStr = `${y}-${m}-${d}`;
        }

        rows.push({
          date: dateStr,
          description: descIdx >= 0 ? cols[descIdx] : `Line ${i}`,
          amount,
          balance: balIdx >= 0 ? parseFloat(cols[balIdx]?.replace(/[£,]/g, '') || '') || undefined : undefined,
        });
      }
      setImportPreview(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!bankName.trim()) {
      toast.error('Enter a bank account name');
      return;
    }
    await importStatement.mutateAsync({ bankAccountName: bankName, entries: importPreview });
    setImportPreview([]);
    setBankName('');
    setShowImportDialog(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Manual Match ──
  const handleManualMatch = async () => {
    if (!selectedEntry || !selectedTxn) return;
    await reconcile.mutateAsync({ bankEntryId: selectedEntry, transactionId: selectedTxn });
    setSelectedEntry(null);
    setSelectedTxn(null);
  };

  // ── Auto Match All ──
  const handleAutoMatchAll = async () => {
    if (autoMatches.length === 0) return;
    let count = 0;
    for (const match of autoMatches) {
      try {
        await reconcile.mutateAsync({
          bankEntryId: match.entry.id,
          transactionId: match.transaction.id,
        });
        count++;
      } catch {
        // skip failed matches
      }
    }
    toast.success(`${count} transactions auto-matched`);
  };

  const isLoading = entriesLoading || txnLoading;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-foreground">{entries.length}</p>
            <p className="text-xs text-muted-foreground">Total Entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{matchedEntries.length}</p>
            <p className="text-xs text-muted-foreground">Matched</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{unmatchedEntries.length}</p>
            <p className="text-xs text-muted-foreground">Unmatched</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{ignoredEntries.length}</p>
            <p className="text-xs text-muted-foreground">Ignored</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button onClick={() => setShowImportDialog(true)}>
          <Upload className="h-4 w-4 mr-1" /> Import Statement
        </Button>
        {autoMatches.length > 0 && (
          <Button variant="outline" onClick={handleAutoMatchAll} disabled={reconcile.isPending}>
            <Zap className="h-4 w-4 mr-1" /> Auto-Match {autoMatches.length} Suggestions
          </Button>
        )}
      </div>

      {/* Auto-match suggestions */}
      {autoMatches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Suggested Matches ({autoMatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank Entry</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Transaction Match</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoMatches.slice(0, 20).map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        <span className="font-mono text-xs">{format(parseISO(m.entry.date), 'dd/MM')}</span>{' '}
                        {m.entry.description.slice(0, 40)}
                      </TableCell>
                      <TableCell className={cn("font-mono text-sm", m.entry.amount >= 0 ? "text-green-600" : "text-red-600")}>
                        {fmt(m.entry.amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono text-xs">{format(parseISO(m.transaction.date), 'dd/MM')}</span>{' '}
                        {m.transaction.description.slice(0, 40)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.score >= 80 ? 'default' : 'secondary'} className="text-xs">
                          {m.score}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.reason}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => reconcile.mutate({ bankEntryId: m.entry.id, transactionId: m.transaction.id })}
                          disabled={reconcile.isPending}
                        >
                          <Link2 className="h-3 w-3 mr-1" /> Match
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Bank Statement Entries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bank Statement Entries</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : unmatchedEntries.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No unmatched entries. Import a bank statement to get started.
              </div>
            ) : (
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-24">Amount</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedEntries.map(e => (
                      <TableRow
                        key={e.id}
                        className={cn("cursor-pointer", selectedEntry === e.id && "bg-accent")}
                        onClick={() => setSelectedEntry(selectedEntry === e.id ? null : e.id)}
                      >
                        <TableCell className="text-sm font-mono">{format(parseISO(e.date), 'dd/MM/yy')}</TableCell>
                        <TableCell className="text-sm truncate max-w-[200px]">{e.description}</TableCell>
                        <TableCell className={cn("text-right font-mono text-sm", e.amount >= 0 ? "text-green-600" : "text-red-600")}>
                          {fmt(e.amount)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(ev) => { ev.stopPropagation(); ignore.mutate(e.id); }}
                          >
                            <EyeOff className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Unreconciled Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Unreconciled Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : unreconciledTxns.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                All transactions are reconciled.
              </div>
            ) : (
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right w-24">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unreconciledTxns.map(t => (
                      <TableRow
                        key={t.id}
                        className={cn("cursor-pointer", selectedTxn === t.id && "bg-accent")}
                        onClick={() => setSelectedTxn(selectedTxn === t.id ? null : t.id)}
                      >
                        <TableCell className="text-sm font-mono">{format(parseISO(t.date), 'dd/MM/yy')}</TableCell>
                        <TableCell className="text-sm truncate max-w-[150px]">{t.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{CATEGORY_LABEL_MAP[t.category]}</Badge>
                        </TableCell>
                        <TableCell className={cn("text-right font-mono text-sm", Number(t.amount) >= 0 ? "text-green-600" : "text-red-600")}>
                          {fmt(Number(t.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Match button */}
      {selectedEntry && selectedTxn && (
        <div className="flex justify-center">
          <Button onClick={handleManualMatch} disabled={reconcile.isPending}>
            <Link2 className="h-4 w-4 mr-2" />
            {reconcile.isPending ? 'Matching...' : 'Match Selected Entries'}
          </Button>
        </div>
      )}

      {/* Matched entries */}
      {matchedEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Matched ({matchedEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[200px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Bank Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedEntries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm font-mono">{format(parseISO(e.date), 'dd/MM/yy')}</TableCell>
                      <TableCell className="text-sm truncate max-w-[250px]">{e.description}</TableCell>
                      <TableCell className={cn("text-right font-mono text-sm", e.amount >= 0 ? "text-green-600" : "text-red-600")}>
                        {fmt(e.amount)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => unmatch.mutate(e.id)}
                        >
                          <Unlink className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={v => { setShowImportDialog(v); if (!v) setImportPreview([]); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Bank Statement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bank Account Name</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Barclays Business Current"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
              />
            </div>
            <div>
              <Label>Statement File (CSV)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Supports most UK bank CSV formats. Needs Date and Amount (or Debit/Credit) columns.
              </p>
              <Input ref={fileRef} type="file" accept=".csv,.ofx" className="mt-1" onChange={handleFileImport} />
            </div>
            {importPreview.length > 0 && (
              <>
                <p className="text-sm font-medium">{importPreview.length} entries found:</p>
                <div className="max-h-[250px] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.slice(0, 30).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{r.date}</TableCell>
                          <TableCell className="text-sm truncate max-w-[200px]">{r.description}</TableCell>
                          <TableCell className={cn("text-right font-mono text-sm", r.amount >= 0 ? "text-green-600" : "text-red-600")}>
                            {fmt(r.amount)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {r.balance != null ? fmt(r.balance) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setImportPreview([]); }}>Cancel</Button>
            <Button onClick={handleImport} disabled={importPreview.length === 0 || !bankName.trim() || importStatement.isPending}>
              {importStatement.isPending ? 'Importing...' : `Import ${importPreview.length} Entries`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
