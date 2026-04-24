import { useState, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus,
  Upload,
  Filter,
  CheckCircle2,
  Circle,
  Trash2,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useTransactions,
  useCreateTransaction,
  useDeleteTransaction,
  useBulkImportTransactions,
  TRANSACTION_CATEGORIES,
  CATEGORY_LABEL_MAP,
  type TransactionCategory,
  type TransactionFilters,
  type CreateTransactionInput,
} from '@/hooks/useAccounting';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';

const fmt = (n: number) =>
  `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function TransactionLedger() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({});

  const { data: transactions, isLoading } = useTransactions(filters);
  const { data: properties } = usePropertiesV2();
  const createTxn = useCreateTransaction();
  const deleteTxn = useDeleteTransaction();
  const bulkImport = useBulkImportTransactions();
  const fileRef = useRef<HTMLInputElement>(null);

  // Property lookup
  const propertyMap = useMemo(
    () => new Map((properties || []).map(p => [p.id, `${p.address_line_1}, ${p.postcode}`])),
    [properties],
  );

  // Running balance
  const txnsWithBalance = useMemo(() => {
    if (!transactions) return [];
    // Transactions are desc by date; reverse for running balance then reverse back
    const sorted = [...transactions].reverse();
    let balance = 0;
    const result = sorted.map(t => {
      balance += Number(t.amount);
      return { ...t, runningBalance: balance };
    });
    return result.reverse();
  }, [transactions]);

  // ── Add Transaction Form ──
  const [form, setForm] = useState<CreateTransactionInput>({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    category: 'rental_income',
    amount: 0,
    property_id: null,
    notes: null,
  });

  const handleCreateSubmit = async () => {
    if (!form.description || !form.amount) {
      toast.error('Description and amount are required');
      return;
    }
    await createTxn.mutateAsync(form);
    setShowAddDialog(false);
    setForm({
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      category: 'rental_income',
      amount: 0,
      property_id: null,
      notes: null,
    });
  };

  // ── CSV Import ──
  const [csvPreview, setCsvPreview] = useState<CreateTransactionInput[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('CSV must have a header row and at least one data row');
        return;
      }
      const header = lines[0].toLowerCase();
      const hasDate = header.includes('date');
      const _hasDesc = header.includes('description') || header.includes('desc');
      const hasAmount = header.includes('amount');
      const _hasCategory = header.includes('category') || header.includes('cat');

      if (!hasDate || !hasAmount) {
        toast.error('CSV must contain at least Date and Amount columns');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const dateIdx = headers.findIndex(h => h.includes('date'));
      const descIdx = headers.findIndex(h => h.includes('desc'));
      const amountIdx = headers.findIndex(h => h.includes('amount'));
      const catIdx = headers.findIndex(h => h.includes('cat'));

      const rows: CreateTransactionInput[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
        const amount = parseFloat(cols[amountIdx]);
        if (isNaN(amount)) continue;
        rows.push({
          date: cols[dateIdx] || format(new Date(), 'yyyy-MM-dd'),
          description: descIdx >= 0 ? cols[descIdx] : `Imported line ${i}`,
          category: (catIdx >= 0 && TRANSACTION_CATEGORIES.includes(cols[catIdx] as TransactionCategory))
            ? (cols[catIdx] as TransactionCategory)
            : (amount >= 0 ? 'other_income' : 'other_expense'),
          amount,
        });
      }
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (csvPreview.length === 0) return;
    await bulkImport.mutateAsync(csvPreview);
    setCsvPreview([]);
    setShowImportDialog(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Transaction
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-1" /> Filters
          {Object.values(filters).some(Boolean) && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
              {Object.values(filters).filter(Boolean).length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Property</Label>
                <Select
                  value={filters.propertyId || 'all'}
                  onValueChange={v => setFilters(f => ({ ...f, propertyId: v === 'all' ? undefined : v }))}
                >
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.address_line_1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select
                  value={filters.category || 'all'}
                  onValueChange={v => setFilters(f => ({ ...f, category: v === 'all' ? undefined : (v as TransactionCategory) }))}
                >
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {TRANSACTION_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABEL_MAP[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  className="h-8 text-xs mt-1"
                  value={filters.dateFrom || ''}
                  onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))}
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  className="h-8 text-xs mt-1"
                  value={filters.dateTo || ''}
                  onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined }))}
                />
              </div>
              <div>
                <Label className="text-xs">Reconciled</Label>
                <Select
                  value={filters.reconciled === undefined ? 'all' : String(filters.reconciled)}
                  onValueChange={v => setFilters(f => ({ ...f, reconciled: v === 'all' ? undefined : v === 'true' }))}
                >
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Reconciled</SelectItem>
                    <SelectItem value="false">Unreconciled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {Object.values(filters).some(Boolean) && (
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setFilters({})}>
                <X className="h-3 w-3 mr-1" /> Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transaction Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading transactions...</div>
          ) : txnsWithBalance.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No transactions found.</p>
              <p className="text-sm mt-1">Add your first transaction or import from CSV.</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right w-24">Income</TableHead>
                    <TableHead className="text-right w-24">Expense</TableHead>
                    <TableHead className="text-right w-28">Balance</TableHead>
                    <TableHead className="w-16 text-center">Rec.</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txnsWithBalance.map(t => {
                    const isIncome = Number(t.amount) >= 0;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm font-mono">{format(parseISO(t.date), 'dd/MM/yy')}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{t.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                          {t.property_id ? propertyMap.get(t.property_id) || '—' : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isIncome ? 'default' : 'destructive'} className="text-xs">
                            {CATEGORY_LABEL_MAP[t.category]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-600">
                          {isIncome ? fmt(Number(t.amount)) : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-600">
                          {!isIncome ? fmt(Number(t.amount)) : ''}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono text-sm font-medium",
                          t.runningBalance >= 0 ? "text-foreground" : "text-red-600",
                        )}>
                          {fmt(t.runningBalance)}
                        </TableCell>
                        <TableCell className="text-center">
                          {t.reconciled ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => deleteTxn.mutate(t.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Manually record a new accounting transaction in the ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as TransactionCategory }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABEL_MAP[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                className="mt-1"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. March rent payment"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="mt-1"
                  value={form.amount || ''}
                  onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                  placeholder="Positive = income, negative = expense"
                />
              </div>
              <div>
                <Label>Property</Label>
                <Select
                  value={form.property_id || 'none'}
                  onValueChange={v => setForm(f => ({ ...f, property_id: v === 'none' ? null : v }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No property</SelectItem>
                    {properties?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.address_line_1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                className="mt-1"
                value={form.notes || ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSubmit} disabled={createTxn.isPending}>
              {createTxn.isPending ? 'Saving...' : 'Save Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={v => { setShowImportDialog(v); if (!v) setCsvPreview([]); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Transactions from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV export from your bank or accountant to bulk-import transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CSV File</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Required columns: Date, Amount. Optional: Description, Category.
              </p>
              <Input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="mt-1"
                onChange={handleFileSelect}
              />
            </div>
            {csvPreview.length > 0 && (
              <>
                <p className="text-sm font-medium">{csvPreview.length} transactions to import:</p>
                <div className="max-h-[300px] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.slice(0, 50).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{r.date}</TableCell>
                          <TableCell className="text-sm truncate max-w-[200px]">{r.description}</TableCell>
                          <TableCell className="text-sm">{CATEGORY_LABEL_MAP[r.category]}</TableCell>
                          <TableCell className={cn("text-right font-mono text-sm", r.amount >= 0 ? "text-green-600" : "text-red-600")}>
                            {fmt(r.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {csvPreview.length > 50 && (
                    <p className="text-center text-xs text-muted-foreground py-2">
                      Showing 50 of {csvPreview.length} rows
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setCsvPreview([]); }}>Cancel</Button>
            <Button onClick={handleBulkImport} disabled={csvPreview.length === 0 || bulkImport.isPending}>
              {bulkImport.isPending ? 'Importing...' : `Import ${csvPreview.length} Transactions`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
