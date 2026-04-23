import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download, ChevronRight, ChevronLeft, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useAccountingMappings } from '@/hooks/useAccountingMappings';
import { useCreateExportRecord } from '@/hooks/useAccountingExports';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import {
  generateTransactionLines,
  formatCsvForSystem,
  transactionsToQif,
  downloadFile,
  computeExportTotals,
} from '@/lib/accountingExportUtils';
import {
  getCurrentTaxYear,
  parseTaxYear,
  CATEGORY_LABELS,
  type ExportType,
  type AccountingSystem,
  type FileFormat,
  type TransactionLine,
} from '@/lib/accountingTypes';
import type { FinancialSnapshot } from '@/lib/financialSnapshotTypes';

interface PropertyLookupRow {
  id: string;
  address_line_1: string | null;
  postcode: string | null;
}

const EXPORT_TYPES: { value: ExportType; label: string; desc: string }[] = [
  { value: 'income_transactions', label: 'Income & Expense Transactions', desc: 'Monthly breakdown of all financial line items' },
  { value: 'combined_journal', label: 'Combined Journal', desc: 'All transactions as double-entry journal entries' },
  { value: 'bank_reconciliation', label: 'Bank Reconciliation', desc: 'Rent receipts and payments for bank import (QIF)' },
  { value: 'tax_summary', label: 'Tax Year Summary', desc: 'HMRC-ready summary for self-assessment' },
];

const SYSTEMS: { value: AccountingSystem; label: string }[] = [
  { value: 'xero', label: 'Xero' },
  { value: 'quickbooks', label: 'QuickBooks' },
  { value: 'freeagent', label: 'FreeAgent' },
  { value: 'sage', label: 'Sage' },
  { value: 'generic', label: 'Generic CSV' },
];

const PERIOD_PRESETS = [
  { label: 'This Tax Year', key: 'this_tax' },
  { label: 'Last Tax Year', key: 'last_tax' },
  { label: 'This Calendar Year', key: 'this_cal' },
  { label: 'Last Quarter', key: 'last_q' },
  { label: 'Custom', key: 'custom' },
] as const;

function getPresetDates(key: string) {
  const now = new Date();
  const currentTY = getCurrentTaxYear();
  const { start, end } = parseTaxYear(currentTY);

  switch (key) {
    case 'this_tax':
      return { from: start, to: end };
    case 'last_tax': {
      const lastStart = new Date(start.getFullYear() - 1, 3, 6);
      const lastEnd = new Date(start.getFullYear(), 3, 5);
      return { from: lastStart, to: lastEnd };
    }
    case 'this_cal':
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31) };
    case 'last_q': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const from = new Date(now.getFullYear(), qMonth - 3, 1);
      const to = new Date(now.getFullYear(), qMonth, 0);
      return { from, to };
    }
    default:
      return { from: start, to: end };
  }
}

export function ExportWizard() {
  const [step, setStep] = useState(1);
  const [exportType, setExportType] = useState<ExportType>('income_transactions');
  const [entityId, setEntityId] = useState<string>('all');
  const [periodPreset, setPeriodPreset] = useState('this_tax');
  const [dateFrom, setDateFrom] = useState<Date>(getPresetDates('this_tax').from);
  const [dateTo, setDateTo] = useState<Date>(getPresetDates('this_tax').to);
  const [system, setSystem] = useState<AccountingSystem>('generic');
  const [previewLines, setPreviewLines] = useState<TransactionLine[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: entities } = useLegalEntities();
  const { data: mappings } = useAccountingMappings(system);
  const { data: org } = useOrganization();
  const createExport = useCreateExportRecord();

  const handlePresetChange = (key: string) => {
    setPeriodPreset(key);
    if (key !== 'custom') {
      const { from, to } = getPresetDates(key);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  const generatePreview = async () => {
    setIsGenerating(true);
    try {
      const fromStr = format(dateFrom, 'yyyy-MM-dd');
      const toStr = format(dateTo, 'yyyy-MM-dd');

      let query = (supabase as any)
        .from('financial_snapshots')
        .select('*')
        .gte('snapshot_month', fromStr)
        .lte('snapshot_month', toStr)
        .order('snapshot_month');

      if (entityId !== 'all') {
        query = query.eq('entity_id', entityId);
      }

      const { data: snapshots, error } = await query;
      if (error) throw error;

      // Get property addresses
      const typedSnapshots = (snapshots || []) as FinancialSnapshot[];
      const propertyIds = [...new Set(typedSnapshots.map((snapshot) => snapshot.property_id))];
      const { data: properties } = await (supabase as any)
        .from('properties_v2')
        .select('id, address_line_1, postcode')
        .in('id', propertyIds);

      const propMap = new Map(
        ((properties || []) as PropertyLookupRow[]).map((property) => [
          property.id,
          `${property.address_line_1 || ''} ${property.postcode || ''}`.trim(),
        ]),
      );
      const entityMap = new Map((entities || []).map(e => [e.id, e]));

      const allLines: TransactionLine[] = [];
      for (const snap of typedSnapshots) {
        const entity = entityMap.get(snap.entity_id);
        if (!entity) continue;
        const lines = generateTransactionLines(
          snap,
          { id: snap.property_id, address: propMap.get(snap.property_id) || 'Unknown' },
          { id: entity.id, name: entity.entity_name, entity_type: entity.entity_type },
          mappings || [],
          system,
        );
        allLines.push(...lines);
      }

      setPreviewLines(allLines);
      setStep(4);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to generate preview: ' + message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    const totals = computeExportTotals(previewLines);
    let content: string;
    let fileName: string;
    let fileFormat: FileFormat;

    if (exportType === 'bank_reconciliation') {
      content = transactionsToQif(previewLines);
      fileName = `hydrogencap-bank-${format(dateFrom, 'yyyyMMdd')}-${format(dateTo, 'yyyyMMdd')}.qif`;
      fileFormat = 'qif';
    } else {
      content = formatCsvForSystem(previewLines, system);
      fileName = `hydrogencap-${exportType}-${system}-${format(dateFrom, 'yyyyMMdd')}-${format(dateTo, 'yyyyMMdd')}.csv`;
      fileFormat = 'csv';
    }

    downloadFile(content, fileName);

    try {
      await createExport.mutateAsync({
        org_id: org?.id || null,
        entity_id: entityId === 'all' ? null : entityId,
        export_type: exportType,
        accounting_system: system,
        period_from: format(dateFrom, 'yyyy-MM-dd'),
        period_to: format(dateTo, 'yyyy-MM-dd'),
        file_name: fileName,
        file_format: fileFormat,
        row_count: totals.rowCount,
        total_income: totals.totalIncome,
        total_expenses: totals.totalExpenses,
        file_url: null,
        generated_by: null,
        notes: null,
      });
      toast.success('Export downloaded and logged');
    } catch (error) {
      console.error('Failed to log export record:', error);
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  const totals = useMemo(() => computeExportTotals(previewLines), [previewLines]);
  const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border",
              step >= s ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"
            )}>
              {s}
            </div>
            {s < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
        <span className="ml-3 text-sm text-muted-foreground">
          {step === 1 && 'What to export'}
          {step === 2 && 'Scope & period'}
          {step === 3 && 'Format'}
          {step === 4 && 'Preview & download'}
        </span>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>What would you like to export?</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup value={exportType} onValueChange={v => setExportType(v as ExportType)} className="space-y-3">
              {EXPORT_TYPES.map(t => (
                <div key={t.value} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer" onClick={() => setExportType(t.value)}>
                  <RadioGroupItem value={t.value} id={t.value} className="mt-0.5" />
                  <div>
                    <Label htmlFor={t.value} className="font-medium cursor-pointer">{t.label}</Label>
                    <p className="text-sm text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setStep(2)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Select entity & period</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Entity</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {entities?.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Period</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PERIOD_PRESETS.map(p => (
                  <Button key={p.key} variant={periodPreset === p.key ? 'default' : 'outline'} size="sm" onClick={() => handlePresetChange(p.key)}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={d => d && (setDateFrom(d), setPeriodPreset('custom'))} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, 'dd MMM yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={d => d && (setDateTo(d), setPeriodPreset('custom'))} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={() => setStep(3)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Choose format</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Accounting System</Label>
              <Select value={system} onValueChange={v => setSystem(v as AccountingSystem)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYSTEMS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground">
                {system === 'xero' && 'Xero CSV manual journal format with AccountCode, TaxType columns'}
                {system === 'quickbooks' && 'QuickBooks Online CSV format with Account, Name columns'}
                {system === 'generic' && 'Universal CSV format with Income/Expense/Net columns'}
                {system === 'freeagent' && 'Generic CSV format (compatible with FreeAgent import)'}
                {system === 'sage' && 'Generic CSV format (compatible with Sage import)'}
                {exportType === 'bank_reconciliation' && ' — Output: QIF file for bank import'}
              </p>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={generatePreview} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate Preview'}
                <FileSpreadsheet className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview & Download</CardTitle>
              <Button onClick={handleDownload} disabled={previewLines.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{totals.rowCount}</p>
                <p className="text-xs text-muted-foreground">Transactions</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{fmt(totals.totalIncome)}</p>
                <p className="text-xs text-muted-foreground">Total Income</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{fmt(totals.totalExpenses)}</p>
                <p className="text-xs text-muted-foreground">Total Expenses</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className={cn("text-2xl font-bold", totals.net >= 0 ? "text-green-600" : "text-red-600")}>{fmt(totals.net)}</p>
                <p className="text-xs text-muted-foreground">Net</p>
              </div>
            </div>

            {previewLines.length > 0 ? (
              <div className="max-h-[400px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Code</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewLines.slice(0, 50).map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{l.date}</TableCell>
                        <TableCell className="text-sm">{l.entityName}</TableCell>
                        <TableCell>
                          <Badge variant={l.isExpense ? 'destructive' : 'default'} className="text-xs">
                            {CATEGORY_LABELS[l.category] || l.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{l.description}</TableCell>
                        <TableCell className={cn("text-right font-mono text-sm", l.isExpense ? "text-red-600" : "text-green-600")}>
                          {l.isExpense ? '-' : ''}{fmt(Math.abs(l.amount))}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.accountCode || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {previewLines.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground py-2">Showing 50 of {previewLines.length} rows</p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No transactions found for the selected period</p>
              </div>
            )}

            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(3)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
