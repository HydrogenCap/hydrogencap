import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Printer, Download } from 'lucide-react';
import { format, startOfYear, endOfYear, startOfQuarter, endOfQuarter, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useProfitAndLoss,
  type ProfitAndLossPeriod,
} from '@/hooks/useAccounting';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { useLegalEntities } from '@/hooks/useLegalEntities';

const fmtGBP = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'tax_year', label: 'Current Tax Year' },
];

function getDateRange(preset: string): { from: string; to: string; period: ProfitAndLossPeriod } {
  const now = new Date();
  switch (preset) {
    case 'this_month':
      return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd'), period: 'monthly' };
    case 'last_month': {
      const lm = subMonths(now, 1);
      return { from: format(startOfMonth(lm), 'yyyy-MM-dd'), to: format(endOfMonth(lm), 'yyyy-MM-dd'), period: 'monthly' };
    }
    case 'this_quarter':
      return { from: format(startOfQuarter(now), 'yyyy-MM-dd'), to: format(endOfQuarter(now), 'yyyy-MM-dd'), period: 'quarterly' };
    case 'last_quarter': {
      const lq = subMonths(now, 3);
      return { from: format(startOfQuarter(lq), 'yyyy-MM-dd'), to: format(endOfQuarter(lq), 'yyyy-MM-dd'), period: 'quarterly' };
    }
    case 'this_year':
      return { from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd'), period: 'annual' };
    case 'last_year': {
      const ly = new Date(now.getFullYear() - 1, 0, 1);
      return { from: format(startOfYear(ly), 'yyyy-MM-dd'), to: format(endOfYear(ly), 'yyyy-MM-dd'), period: 'annual' };
    }
    case 'tax_year': {
      const tyStart = now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 6)
        ? new Date(now.getFullYear() - 1, 3, 6)
        : new Date(now.getFullYear(), 3, 6);
      const tyEnd = new Date(tyStart.getFullYear() + 1, 3, 5);
      return { from: format(tyStart, 'yyyy-MM-dd'), to: format(tyEnd, 'yyyy-MM-dd'), period: 'annual' };
    }
    default:
      return { from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd'), period: 'annual' };
  }
}

function PLSection({ title, rows, total, totalLabel, isExpense }: {
  title: string;
  rows: { label: string; amount: number }[];
  total: number;
  totalLabel: string;
  isExpense?: boolean;
}) {
  return (
    <div>
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">{title}</h4>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between text-sm px-2">
            <span>{r.label}</span>
            <span className={cn("font-mono", isExpense ? "text-red-600" : "text-green-600")}>
              {isExpense ? `(${fmtGBP(Math.abs(r.amount))})` : fmtGBP(r.amount)}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground px-2">No items for this period</p>
        )}
        <Separator className="my-1" />
        <div className="flex justify-between font-semibold text-sm px-2">
          <span>{totalLabel}</span>
          <span className={cn("font-mono", isExpense ? "text-red-600" : "text-green-600")}>
            {isExpense ? `(${fmtGBP(total)})` : fmtGBP(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProfitAndLoss() {
  const [periodPreset, setPeriodPreset] = useState('this_year');
  const [propertyId, setPropertyId] = useState<string | undefined>();
  const [entityId, setEntityId] = useState<string | undefined>();
  const printRef = useRef<HTMLDivElement>(null);

  const { from, to, period } = useMemo(() => getDateRange(periodPreset), [periodPreset]);
  const { data: plData, isLoading } = useProfitAndLoss(period, from, to, propertyId, entityId);
  const { data: properties } = usePropertiesV2();
  const { data: entities } = useLegalEntities();

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !printRef.current) return;
    // Sanitize React-rendered innerHTML (defence-in-depth against any
    // dangerouslySetInnerHTML/DOM-mutation injection) and escape the
    // DB-sourced period label before interpolation.
    const safeBody = sanitizeHtml(printRef.current.innerHTML);
    const safePeriod = escapeHtml(plData?.periodLabel || '');
    printWindow.document.write(`
      <html>
        <head>
          <title>Profit & Loss Statement</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 4px; }
            h2 { font-size: 14px; color: #666; margin-bottom: 24px; }
            h4 { font-size: 12px; text-transform: uppercase; color: #666; margin: 16px 0 8px; letter-spacing: 0.05em; }
            .row { display: flex; justify-content: space-between; padding: 2px 8px; font-size: 14px; }
            .total { font-weight: 600; border-top: 1px solid #ddd; padding-top: 4px; margin-top: 4px; }
            .highlight { font-size: 18px; padding: 8px; border-top: 2px solid #333; margin-top: 8px; }
            .green { color: #16a34a; }
            .red { color: #dc2626; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>Profit & Loss Statement</h1>
          <h2>${safePeriod}</h2>
          ${safeBody}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportPdf = () => {
    // Use print dialog for PDF export
    handlePrint();
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-xs">Period</Label>
          <Select value={periodPreset} onValueChange={setPeriodPreset}>
            <SelectTrigger className="w-44 h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Property</Label>
          <Select value={propertyId || 'all'} onValueChange={v => setPropertyId(v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-52 h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties?.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.address_line_1}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Entity</Label>
          <Select value={entityId || 'all'} onValueChange={v => setEntityId(v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-44 h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {entities?.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="h-4 w-4 mr-1" /> Export PDF
          </Button>
        </div>
      </div>

      {/* P&L Statement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Profit & Loss Statement
            {plData && <span className="text-sm font-normal text-muted-foreground ml-2">{plData.periodLabel}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Calculating...</div>
          ) : !plData ? (
            <div className="py-12 text-center text-muted-foreground">Select a period to view P&L</div>
          ) : (
            <div ref={printRef} className="space-y-6">
              {/* Income */}
              <PLSection
                title="Income"
                rows={plData.income}
                total={plData.totalIncome}
                totalLabel="Total Income"
              />

              {/* Operating Expenses */}
              <PLSection
                title="Operating Expenses"
                rows={plData.operatingExpenses.map(r => ({ ...r, amount: Math.abs(r.amount) }))}
                total={plData.totalOperatingExpenses}
                totalLabel="Total Operating Expenses"
                isExpense
              />

              {/* Net Operating Income */}
              <div className="flex justify-between text-lg font-bold px-2 pt-2 border-t-2">
                <span>Net Operating Income</span>
                <span className={cn("font-mono", plData.netOperatingIncome >= 0 ? "text-green-600" : "text-red-600")}>
                  {fmtGBP(plData.netOperatingIncome)}
                </span>
              </div>

              {/* Finance Costs */}
              <PLSection
                title="Finance Costs"
                rows={plData.financeCosts.map(r => ({ ...r, amount: Math.abs(r.amount) }))}
                total={plData.totalFinanceCosts}
                totalLabel="Total Finance Costs"
                isExpense
              />

              {/* Net Profit */}
              <div className="flex justify-between text-xl font-bold px-2 pt-3 border-t-2 border-foreground">
                <span>Net Profit / (Loss)</span>
                <span className={cn("font-mono", plData.netProfit >= 0 ? "text-green-600" : "text-red-600")}>
                  {plData.netProfit >= 0 ? fmtGBP(plData.netProfit) : `(${fmtGBP(Math.abs(plData.netProfit))})`}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
