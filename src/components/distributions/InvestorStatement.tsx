import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Printer } from 'lucide-react';
import { formatGBPDecimal, formatDateShort } from '@/lib/calculations';
import type { DistributionRun, DistributionLineItem } from '@/hooks/useDistributionWorkflow';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

type AutoTableJsPdf = jsPDF & {
  lastAutoTable?: { finalY: number };
};

interface InvestorStatementProps {
  run: DistributionRun;
  lineItem: DistributionLineItem;
  allRunsForInvestor?: DistributionRun[];
  allLineItemsForInvestor?: DistributionLineItem[];
  entityName?: string;
  orgName?: string;
}

export function InvestorStatement({
  run,
  lineItem,
  allRunsForInvestor,
  allLineItemsForInvestor,
  entityName,
  orgName,
}: InvestorStatementProps) {
  const investorName = lineItem.investor?.investor_name || 'Investor';

  // Calculate YTD summary
  const ytdSummary = useMemo(() => {
    if (!allLineItemsForInvestor?.length) {
      return { grossTotal: lineItem.gross_amount, taxTotal: lineItem.withholding_tax, netTotal: lineItem.net_amount, periods: 1 };
    }

    const currentYear = new Date(run.period_start).getFullYear();
    const yearItems = allLineItemsForInvestor.filter(li => {
      const matchingRun = allRunsForInvestor?.find(r => r.id === li.distribution_run_id);
      if (!matchingRun) return false;
      return new Date(matchingRun.period_start).getFullYear() === currentYear;
    });

    return {
      grossTotal: yearItems.reduce((s, li) => s + li.gross_amount, 0),
      taxTotal: yearItems.reduce((s, li) => s + li.withholding_tax, 0),
      netTotal: yearItems.reduce((s, li) => s + li.net_amount, 0),
      periods: yearItems.length,
    };
  }, [allLineItemsForInvestor, allRunsForInvestor, run.period_start, lineItem]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text('Investor Distribution Statement', 14, 20);

    doc.setFontSize(10);
    if (orgName) doc.text(orgName, 14, 28);
    doc.text(`Date: ${format(new Date(), 'dd MMMM yyyy')}`, 14, 35);

    doc.setFontSize(12);
    doc.text('Investor Details', 14, 48);
    doc.setFontSize(10);
    doc.text(`Name: ${investorName}`, 14, 55);
    if (lineItem.investor?.email) doc.text(`Email: ${lineItem.investor.email}`, 14, 61);
    if (entityName) doc.text(`Entity: ${entityName}`, 14, 67);

    // Period details
    doc.setFontSize(12);
    doc.text('Distribution Details', 14, 80);

    autoTable(doc, {
      startY: 85,
      head: [['Item', 'Amount']],
      body: [
        ['Period', run.period],
        ['Period Start', formatDateShort(run.period_start)],
        ['Period End', formatDateShort(run.period_end)],
        ['Ownership', `${lineItem.ownership_pct.toFixed(2)}%`],
        ['Gross Amount', formatGBPDecimal(lineItem.gross_amount)],
        ['Withholding Tax', formatGBPDecimal(lineItem.withholding_tax)],
        ['Net Amount', formatGBPDecimal(lineItem.net_amount)],
        ['Payment Status', lineItem.payment_status === 'paid' ? 'Paid' : 'Pending'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95] },
    });

    const finalY = (doc as AutoTableJsPdf).lastAutoTable?.finalY || 160;

    // YTD Summary
    doc.setFontSize(12);
    doc.text('Year-to-Date Summary', 14, finalY + 15);

    autoTable(doc, {
      startY: finalY + 20,
      head: [['Metric', 'Amount']],
      body: [
        ['Periods', ytdSummary.periods.toString()],
        ['Gross Total (YTD)', formatGBPDecimal(ytdSummary.grossTotal)],
        ['Tax Total (YTD)', formatGBPDecimal(ytdSummary.taxTotal)],
        ['Net Total (YTD)', formatGBPDecimal(ytdSummary.netTotal)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95] },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text('This statement is for informational purposes only.', 14, pageHeight - 15);
    doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, pageHeight - 10);

    doc.save(`statement-${investorName.replace(/\s/g, '-')}-${run.period}.pdf`);
  };

  return (
    <Card className="print:shadow-none print:border-0">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Distribution Statement</CardTitle>
          <p className="text-sm text-muted-foreground">
            {investorName} - {run.period}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Header Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Investor</p>
            <p className="font-medium">{investorName}</p>
            {lineItem.investor?.email && (
              <p className="text-muted-foreground text-xs">{lineItem.investor.email}</p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">Entity</p>
            <p className="font-medium">{entityName || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Period</p>
            <p className="font-medium">{run.period}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateShort(run.period_start)} - {formatDateShort(run.period_end)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Ownership</p>
            <p className="font-medium">{lineItem.ownership_pct.toFixed(2)}%</p>
          </div>
        </div>

        <Separator />

        {/* Distribution Breakdown */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Distribution Breakdown</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gross Amount</span>
              <span className="font-mono">{formatGBPDecimal(lineItem.gross_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Withholding Tax</span>
              <span className="font-mono text-destructive">({formatGBPDecimal(lineItem.withholding_tax)})</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm font-bold">
              <span>Net Amount</span>
              <span className="font-mono text-success">{formatGBPDecimal(lineItem.net_amount)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Payment Status:</span>
          {lineItem.payment_status === 'paid' ? (
            <Badge className="bg-success text-success-foreground">Paid</Badge>
          ) : (
            <Badge variant="secondary">Pending</Badge>
          )}
          {lineItem.payment_reference && (
            <span className="text-xs text-muted-foreground">Ref: {lineItem.payment_reference}</span>
          )}
        </div>

        <Separator />

        {/* YTD Summary */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Year-to-Date Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Periods</p>
              <p className="text-lg font-bold">{ytdSummary.periods}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Gross (YTD)</p>
              <p className="text-lg font-bold">{formatGBPDecimal(ytdSummary.grossTotal)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Tax (YTD)</p>
              <p className="text-lg font-bold text-destructive">{formatGBPDecimal(ytdSummary.taxTotal)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Net (YTD)</p>
              <p className="text-lg font-bold text-success">{formatGBPDecimal(ytdSummary.netTotal)}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-muted-foreground pt-4 print:block">
          This statement is for informational purposes only. Generated on {format(new Date(), 'dd MMMM yyyy')}.
        </p>
      </CardContent>
    </Card>
  );
}
