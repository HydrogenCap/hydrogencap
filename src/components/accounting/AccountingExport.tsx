import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, FileSpreadsheet, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useTransactions,
  useExportAccounting,
  CATEGORY_LABEL_MAP,
  type AccountingExportFormat,
} from '@/hooks/useAccounting';
import { useOrganization } from '@/hooks/useOrganization';

const FORMATS: { value: AccountingExportFormat; label: string; desc: string }[] = [
  { value: 'xero', label: 'Xero CSV', desc: 'Xero manual journal import format with AccountCode and TaxType columns' },
  { value: 'sage', label: 'Sage CSV', desc: 'Sage 50 import format with Nominal codes and VAT' },
  { value: 'freeagent', label: 'FreeAgent CSV', desc: 'FreeAgent bank transaction import format' },
  { value: 'generic', label: 'Generic CSV', desc: 'Universal format with all fields for any system' },
];

const fmtGBP = (n: number) =>
  `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function downloadCsv(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function AccountingExport() {
  const [selectedFormat, setSelectedFormat] = useState<AccountingExportFormat>('generic');
  const [dateFrom, setDateFrom] = useState(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [preview, setPreview] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(0);

  const { data: org } = useOrganization();
  const exportMutation = useExportAccounting();

  // Get transactions for preview stats
  const { data: txns } = useTransactions({ dateFrom, dateTo });

  const stats = useMemo(() => {
    if (!txns) return { count: 0, income: 0, expenses: 0, vat: 0 };
    let income = 0;
    let expenses = 0;
    let vat = 0;
    for (const t of txns) {
      const amt = Number(t.amount);
      if (amt >= 0) income += amt;
      else expenses += Math.abs(amt);
      vat += Number(t.vat_amount) || 0;
    }
    return { count: txns.length, income, expenses, vat };
  }, [txns]);

  const handlePreview = async () => {
    if (!org?.id) return;
    try {
      const result = await exportMutation.mutateAsync({
        fmt: selectedFormat,
        dateFrom,
        dateTo,
        orgId: org.id,
      });
      setPreview(result.csv);
      setPreviewCount(result.count);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleDownload = () => {
    if (!preview) return;
    const fileName = `tenureiq-${selectedFormat}-${dateFrom}-to-${dateTo}.csv`;
    downloadCsv(preview, fileName);
    toast.success('Export downloaded');
  };

  const previewLines = useMemo(() => {
    if (!preview) return [];
    return preview.split('\n').slice(0, 51); // header + 50 rows
  }, [preview]);

  return (
    <div className="space-y-4">
      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Export Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Format selection */}
          <div>
            <Label>Export Format</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              {FORMATS.map(f => (
                <div
                  key={f.value}
                  className={cn(
                    "rounded-lg border p-3 cursor-pointer transition-colors",
                    selectedFormat === f.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50",
                  )}
                  onClick={() => { setSelectedFormat(f.value); setPreview(null); }}
                >
                  <p className="font-medium text-sm">{f.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Date range */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Date From</Label>
              <Input
                type="date"
                className="mt-1"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPreview(null); }}
              />
            </div>
            <div>
              <Label className="text-xs">Date To</Label>
              <Input
                type="date"
                className="mt-1"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPreview(null); }}
              />
            </div>
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{stats.count}</p>
              <p className="text-xs text-muted-foreground">Transactions</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{fmtGBP(stats.income)}</p>
              <p className="text-xs text-muted-foreground">Total Income</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{fmtGBP(stats.expenses)}</p>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{fmtGBP(stats.vat)}</p>
              <p className="text-xs text-muted-foreground">VAT Total</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handlePreview} disabled={exportMutation.isPending || stats.count === 0}>
              <Eye className="h-4 w-4 mr-1" />
              {exportMutation.isPending ? 'Generating...' : 'Preview Export'}
            </Button>
            {preview && (
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" /> Download CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Preview — {previewCount} transactions
                <Badge variant="outline" className="text-xs ml-2">{selectedFormat.toUpperCase()}</Badge>
              </CardTitle>
              <Button size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" /> Download
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <table className="w-full text-xs font-mono">
                <tbody>
                  {previewLines.map((line, i) => (
                    <tr key={i} className={cn("border-b", i === 0 && "bg-muted font-semibold")}>
                      {line.split(',').map((cell, j) => (
                        <td key={j} className="px-3 py-1.5 whitespace-nowrap">
                          {cell.replace(/^"(.*)"$/, '$1')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewCount > 50 && (
                <p className="text-center text-xs text-muted-foreground py-2">
                  Showing 50 of {previewCount} rows
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category mapping info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category Mapping Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            TenureIQ categories are mapped to the selected accounting system's chart of accounts.
            Use the Mappings tab to customize account codes.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(CATEGORY_LABEL_MAP).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <Badge
                  variant={['rental_income', 'service_charge_income', 'other_income', 'deposit_in'].includes(key) ? 'default' : 'destructive'}
                  className="text-xs w-2 h-2 p-0 rounded-full"
                />
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
