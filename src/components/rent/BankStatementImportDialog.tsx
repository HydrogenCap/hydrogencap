import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileSpreadsheet, ArrowRight, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useImportBankTransactions } from '@/hooks/useBankTransactions';
import {
  parseCSVContent, detectBankFormat, autoDetectMapping, transformRows,
  BANK_PRESETS, type CSVColumnMapping, type ParsedTransaction,
} from '@/lib/bankCsvParser';
import { useDropzone } from 'react-dropzone';

interface BankStatementImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (batchId: string) => void;
}

type Step = 'account' | 'upload' | 'mapping' | 'review';

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (UK)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
];

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

export function BankStatementImportDialog({ open, onOpenChange, onSuccess }: BankStatementImportDialogProps) {
  const { data: bankAccounts } = useBankAccounts();
  const importMutation = useImportBankTransactions();

  const [step, setStep] = useState<Step>('account');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [detectedBank, setDetectedBank] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CSVColumnMapping>({
    date: null, description: null, reference: null, amount: null, credit: null, debit: null, balance: null,
  });
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

  const reset = () => {
    setStep('account');
    setSelectedAccountId('');
    setFileName('');
    setHeaders([]);
    setRawRows([]);
    setDetectedBank(null);
    setMapping({ date: null, description: null, reference: null, amount: null, credit: null, debit: null, balance: null });
    setDateFormat('DD/MM/YYYY');
    setTransactions([]);
    setExcludedIndices(new Set());
  };

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const { headers: h, rows } = parseCSVContent(content);
      setHeaders(h);
      setRawRows(rows);

      const preset = detectBankFormat(h);
      if (preset) {
        setDetectedBank(preset.name);
        setMapping({
          date: preset.columns.date || null,
          description: preset.columns.description || null,
          reference: preset.columns.reference || null,
          amount: preset.columns.amount || null,
          credit: preset.columns.credit || null,
          debit: preset.columns.debit || null,
          balance: preset.columns.balance || null,
        });
      } else {
        setDetectedBank(null);
        setMapping(autoDetectMapping(h));
      }

      setStep('mapping');
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const handleApplyMapping = () => {
    const parsed = transformRows(rawRows, mapping, dateFormat);
    setTransactions(parsed);
    setExcludedIndices(new Set());
    setStep('review');
  };

  const toggleExclude = (idx: number) => {
    setExcludedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const includedTransactions = useMemo(() =>
    transactions.filter((_, i) => !excludedIndices.has(i)),
    [transactions, excludedIndices]
  );

  const duplicateCount = includedTransactions.filter(t => t.is_duplicate).length;
  const creditCount = includedTransactions.filter(t => t.transaction_type === 'credit').length;
  const debitCount = includedTransactions.filter(t => t.transaction_type === 'debit').length;

  const handleImport = async () => {
    if (!selectedAccountId || includedTransactions.length === 0) return;

    importMutation.mutate(
      {
        bankAccountId: selectedAccountId,
        fileName,
        transactions: includedTransactions,
      },
      {
        onSuccess: (data) => {
          onSuccess?.(data.batch.id);
          onOpenChange(false);
          reset();
        },
      }
    );
  };

  const mappingOptions = [{ value: '', label: 'Skip' }, ...headers.map(h => ({ value: h, label: h }))];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Bank Statement
          </DialogTitle>
          <DialogDescription>
            Step {step === 'account' ? '1' : step === 'upload' ? '2' : step === 'mapping' ? '3' : '4'} of 4
            {detectedBank && ` · Detected: ${detectedBank}`}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Account */}
        {step === 'account' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Bank Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts?.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name} — {a.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!bankAccounts || bankAccounts.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No bank accounts configured. Add one in Settings → Bank Accounts first.
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep('upload')} disabled={!selectedAccountId}>
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Upload CSV */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Drop a CSV file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports standard CSV exports from Barclays, Lloyds, NatWest, Monzo, Starling and others
              </p>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('account')}>Back</Button>
            </div>
          </div>
        )}

        {/* Step 3: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            {detectedBank && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Auto-detected: {detectedBank} format
              </Badge>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date Column *</Label>
                <Select value={mapping.date || ''} onValueChange={v => setMapping(prev => ({ ...prev, date: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {mappingOptions.map(o => <SelectItem key={o.value} value={o.value || 'skip'}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description Column *</Label>
                <Select value={mapping.description || ''} onValueChange={v => setMapping(prev => ({ ...prev, description: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {mappingOptions.map(o => <SelectItem key={o.value} value={o.value || 'skip'}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference Column</Label>
                <Select value={mapping.reference || ''} onValueChange={v => setMapping(prev => ({ ...prev, reference: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Skip" /></SelectTrigger>
                  <SelectContent>
                    {mappingOptions.map(o => <SelectItem key={o.value} value={o.value || 'skip'}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount Column</Label>
                <Select value={mapping.amount || ''} onValueChange={v => setMapping(prev => ({ ...prev, amount: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Select (or use Credit/Debit)" /></SelectTrigger>
                  <SelectContent>
                    {mappingOptions.map(o => <SelectItem key={o.value} value={o.value || 'skip'}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Balance Column</Label>
                <Select value={mapping.balance || ''} onValueChange={v => setMapping(prev => ({ ...prev, balance: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Skip" /></SelectTrigger>
                  <SelectContent>
                    {mappingOptions.map(o => <SelectItem key={o.value} value={o.value || 'skip'}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Credit Column</Label>
                <Select value={mapping.credit || ''} onValueChange={v => setMapping(prev => ({ ...prev, credit: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Skip" /></SelectTrigger>
                  <SelectContent>
                    {mappingOptions.map(o => <SelectItem key={o.value} value={o.value || 'skip'}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Debit Column</Label>
                <Select value={mapping.debit || ''} onValueChange={v => setMapping(prev => ({ ...prev, debit: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Skip" /></SelectTrigger>
                  <SelectContent>
                    {mappingOptions.map(o => <SelectItem key={o.value} value={o.value || 'skip'}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            {rawRows.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Preview: {rawRows.length} rows loaded from "{fileName}"
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button
                onClick={handleApplyMapping}
                disabled={!mapping.date || !mapping.description || (!mapping.amount && !mapping.credit)}
              >
                Parse & Review
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Import */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="secondary">{includedTransactions.length} transactions</Badge>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">{creditCount} credits</Badge>
              <Badge variant="outline">{debitCount} debits</Badge>
              {duplicateCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {duplicateCount} potential duplicates
                </Badge>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn, idx) => (
                    <TableRow key={idx} className={excludedIndices.has(idx) ? 'opacity-40' : txn.is_duplicate ? 'bg-amber-50 dark:bg-amber-950/10' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={!excludedIndices.has(idx)}
                          onCheckedChange={() => toggleExclude(idx)}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">{txn.transaction_date}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{txn.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{txn.reference}</TableCell>
                      <TableCell className={`text-right tabular-nums text-sm font-medium ${txn.transaction_type === 'credit' ? 'text-green-600' : ''}`}>
                        {txn.transaction_type === 'credit' ? '+' : '−'}{fmt(txn.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={txn.transaction_type === 'credit' ? 'default' : 'outline'} className="text-xs">
                          {txn.transaction_type}
                        </Badge>
                        {txn.is_duplicate && (
                          <Badge className="ml-1 bg-amber-100 text-amber-800 text-xs">Dup?</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
              <Button onClick={handleImport} disabled={importMutation.isPending || includedTransactions.length === 0}>
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import {includedTransactions.length} Transactions</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
