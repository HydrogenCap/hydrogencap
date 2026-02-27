// ============================================
// INVESTOR STATEMENT PDF GENERATOR
// Professional investor reporting with portfolio summary,
// commitments, distributions, and return metrics
// ============================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

type Color = [number, number, number];

// Branding colors
const BRAND_PRIMARY: Color = [26, 58, 118];
const BRAND_SECONDARY: Color = [107, 114, 128];
const BRAND_SUCCESS: Color = [34, 197, 94];
const BRAND_WARNING: Color = [234, 179, 8];
const BRAND_ACCENT: Color = [79, 70, 229]; // Indigo

export interface InvestorReportData {
  investor: {
    investor_name: string;
    investor_type: string;
    email?: string | null;
    phone?: string | null;
    accredited_investor?: boolean;
    kyc_completed?: boolean;
  };
  commitments: Array<{
    entity_name?: string | null;
    commitment_type?: string | null;
    committed_amount?: number | null;
    drawn_amount?: number | null;
    undrawn_amount?: number | null;
    equity_percentage?: number | null;
    investors_share_valuation?: number | null;
    property_count?: number | null;
    status?: string | null;
    commitment_date?: string | null;
    maturity_date?: string | null;
    coupon_rate?: number | null;
  }>;
  distributions: Array<{
    distribution_date: string;
    distribution_type: string;
    amount: number;
    tax_deducted?: number | null;
    net_amount?: number | null;
    period_from?: string | null;
    period_to?: string | null;
    payment_reference?: string | null;
    status: string;
  }>;
  returnMetrics: Array<{
    entity_name?: string | null;
    capital_invested?: number | null;
    total_distributions?: number | null;
    current_equity_value?: number | null;
    cash_on_cash_pct?: number | null;
    equity_multiple?: number | null;
    unrealised_gain_loss?: number | null;
  }>;
  reportPeriod: { from: Date; to: Date };
  preparedBy?: string;
}

function fmt(amount: number | null | undefined): string {
  return `£${(amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const COMMITMENT_TYPE_LABEL: Record<string, string> = {
  equity: 'Equity',
  loan: 'Loan',
  convertible_loan: 'Convertible Loan',
  preference_shares: 'Preference Shares',
  mezzanine: 'Mezzanine',
};

const DIST_TYPE_LABEL: Record<string, string> = {
  dividend: 'Dividend',
  interest: 'Interest',
  loan_repayment: 'Loan Repayment',
  profit_share: 'Profit Share',
  capital_return: 'Capital Return',
  other: 'Other',
};

export class InvestorStatementReport {
  private doc: jsPDF;
  private data: InvestorReportData;
  private pageWidth: number;
  private margin = 20;
  private currentY = 0;

  constructor(data: InvestorReportData) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.data = data;
    this.pageWidth = this.doc.internal.pageSize.getWidth();
  }

  generate(): void {
    this.addCoverPage();
    this.addPortfolioSummaryPage();
    if (this.data.commitments.length > 0) this.addCommitmentsPage();
    if (this.data.distributions.length > 0) this.addDistributionsPage();
    if (this.data.returnMetrics.length > 0) this.addReturnMetricsPage();
    this.addDisclaimer();
  }

  getBlob(): Blob {
    return this.doc.output('blob');
  }

  // ─── COVER PAGE ───────────────────────────────────

  private addCoverPage(): void {
    const pw = this.pageWidth;
    const ph = this.doc.internal.pageSize.getHeight();

    // Header bar
    this.doc.setFillColor(...BRAND_PRIMARY);
    this.doc.rect(0, 0, pw, 60, 'F');

    // Company name
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('HYDROGEN CAPITAL', this.margin, 30);
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Investor Statement', this.margin, 42);

    // Report details
    this.doc.setTextColor(...BRAND_PRIMARY);
    this.doc.setFontSize(28);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(this.data.investor.investor_name, this.margin, 100);

    this.doc.setFontSize(14);
    this.doc.setTextColor(...BRAND_SECONDARY);
    this.doc.setFont('helvetica', 'normal');

    const periodStr = `${format(this.data.reportPeriod.from, 'dd MMMM yyyy')} – ${format(this.data.reportPeriod.to, 'dd MMMM yyyy')}`;
    this.doc.text(`Reporting Period: ${periodStr}`, this.margin, 115);

    const typeLabel = this.data.investor.investor_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    this.doc.text(`Investor Type: ${typeLabel}`, this.margin, 127);

    if (this.data.investor.accredited_investor) {
      this.doc.text('Status: Accredited Investor', this.margin, 139);
    }

    // Summary box
    const boxY = 160;
    this.doc.setFillColor(245, 247, 250);
    this.doc.roundedRect(this.margin, boxY, pw - this.margin * 2, 60, 3, 3, 'F');

    const totalCommitted = this.data.commitments.reduce((s, c) => s + (c.committed_amount || 0), 0);
    const totalDrawn = this.data.commitments.reduce((s, c) => s + (c.drawn_amount || 0), 0);
    const totalDistributed = this.data.distributions.filter(d => d.status === 'paid').reduce((s, d) => s + d.amount, 0);
    const totalEquityValue = this.data.returnMetrics.reduce((s, m) => s + (m.current_equity_value || 0), 0);

    const summaryItems = [
      { label: 'Total Committed', value: fmt(totalCommitted) },
      { label: 'Capital Deployed', value: fmt(totalDrawn) },
      { label: 'Equity Value', value: fmt(totalEquityValue) },
      { label: 'Distributions', value: fmt(totalDistributed) },
    ];

    const colWidth = (pw - this.margin * 2) / summaryItems.length;
    summaryItems.forEach((item, i) => {
      const x = this.margin + colWidth * i + colWidth / 2;
      this.doc.setFontSize(9);
      this.doc.setTextColor(...BRAND_SECONDARY);
      this.doc.text(item.label, x, boxY + 20, { align: 'center' });
      this.doc.setFontSize(18);
      this.doc.setTextColor(...BRAND_PRIMARY);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(item.value, x, boxY + 38, { align: 'center' });
      this.doc.setFont('helvetica', 'normal');
    });

    // Footer
    this.doc.setFontSize(9);
    this.doc.setTextColor(...BRAND_SECONDARY);
    this.doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, this.margin, ph - 20);
    if (this.data.preparedBy) {
      this.doc.text(`Prepared by: ${this.data.preparedBy}`, this.margin, ph - 14);
    }
    this.doc.text('CONFIDENTIAL', pw - this.margin, ph - 20, { align: 'right' });
  }

  // ─── PORTFOLIO SUMMARY ─────────────────────────────

  private addPortfolioSummaryPage(): void {
    this.doc.addPage();
    this.addPageHeader('Portfolio Summary');
    this.currentY = 50;

    const totalCommitted = this.data.commitments.reduce((s, c) => s + (c.committed_amount || 0), 0);
    const totalDrawn = this.data.commitments.reduce((s, c) => s + (c.drawn_amount || 0), 0);
    const totalEquityValue = this.data.returnMetrics.reduce((s, m) => s + (m.current_equity_value || 0), 0);
    const paidDists = this.data.distributions.filter(d => d.status === 'paid');
    const totalDistributed = paidDists.reduce((s, d) => s + d.amount, 0);
    const weightedMultiple = this.data.returnMetrics.length > 0
      ? this.data.returnMetrics.reduce((s, m) => s + (m.equity_multiple || 0) * (m.capital_invested || 0), 0) /
        Math.max(this.data.returnMetrics.reduce((s, m) => s + (m.capital_invested || 0), 0), 1)
      : 0;
    const deploymentRatio = totalCommitted > 0 ? (totalDrawn / totalCommitted * 100) : 0;

    // Key metrics table
    const metricsData = [
      ['Total Capital Committed', fmt(totalCommitted)],
      ['Capital Deployed', fmt(totalDrawn)],
      ['Deployment Ratio', `${deploymentRatio.toFixed(1)}%`],
      ['Current Equity Value', fmt(totalEquityValue)],
      ['Total Distributions', fmt(totalDistributed)],
      ['Weighted Equity Multiple', `${weightedMultiple.toFixed(2)}x`],
      ['Active Entities', `${this.data.commitments.length}`],
      ['Total Properties (via entities)', `${this.data.commitments.reduce((s, c) => s + (c.property_count || 0), 0)}`],
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Metric', 'Value']],
      body: metricsData,
      margin: { left: this.margin, right: this.margin },
      headStyles: { fillColor: BRAND_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80 },
        1: { halign: 'right' },
      },
    });

    this.addPageFooter();
  }

  // ─── COMMITMENTS ───────────────────────────────────

  private addCommitmentsPage(): void {
    this.doc.addPage();
    this.addPageHeader('Capital Commitments');
    this.currentY = 50;

    const tableBody = this.data.commitments.map(c => [
      c.entity_name || '—',
      COMMITMENT_TYPE_LABEL[c.commitment_type || ''] || c.commitment_type || '—',
      fmt(c.committed_amount),
      fmt(c.drawn_amount),
      fmt(c.undrawn_amount),
      c.equity_percentage ? `${c.equity_percentage}%` : '—',
      fmt(c.investors_share_valuation),
      (c.status || 'active').replace(/_/g, ' '),
      c.commitment_date ? format(new Date(c.commitment_date), 'dd/MM/yy') : '—',
      c.maturity_date ? format(new Date(c.maturity_date), 'dd/MM/yy') : '—',
    ]);

    // Totals row
    const totalCommitted = this.data.commitments.reduce((s, c) => s + (c.committed_amount || 0), 0);
    const totalDrawn = this.data.commitments.reduce((s, c) => s + (c.drawn_amount || 0), 0);
    const totalUndrawn = this.data.commitments.reduce((s, c) => s + (c.undrawn_amount || 0), 0);
    const totalValuation = this.data.commitments.reduce((s, c) => s + (c.investors_share_valuation || 0), 0);

    tableBody.push([
      'TOTAL', '', fmt(totalCommitted), fmt(totalDrawn), fmt(totalUndrawn), '', fmt(totalValuation), '', '', '',
    ]);

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Entity', 'Type', 'Committed', 'Drawn', 'Undrawn', 'Equity %', 'Value Share', 'Status', 'Date', 'Maturity']],
      body: tableBody,
      margin: { left: this.margin, right: this.margin },
      headStyles: { fillColor: BRAND_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      didParseCell: (data) => {
        // Bold totals row
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 235, 245];
        }
      },
    });

    this.addPageFooter();
  }

  // ─── DISTRIBUTIONS ─────────────────────────────────

  private addDistributionsPage(): void {
    this.doc.addPage();
    this.addPageHeader('Distribution History');
    this.currentY = 50;

    // Summary stats
    const paidDists = this.data.distributions.filter(d => d.status === 'paid');
    const totalGross = paidDists.reduce((s, d) => s + d.amount, 0);
    const totalTax = paidDists.reduce((s, d) => s + (d.tax_deducted || 0), 0);
    const totalNet = paidDists.reduce((s, d) => s + (d.net_amount || d.amount - (d.tax_deducted || 0)), 0);

    this.doc.setFontSize(9);
    this.doc.setTextColor(...BRAND_SECONDARY);
    this.doc.text(
      `Total Gross: ${fmt(totalGross)}  |  Total Tax: ${fmt(totalTax)}  |  Total Net: ${fmt(totalNet)}  |  Count: ${paidDists.length}`,
      this.margin, this.currentY
    );
    this.currentY += 8;

    // Filter to report period
    const periodDists = this.data.distributions.filter(d => {
      const date = new Date(d.distribution_date);
      return date >= this.data.reportPeriod.from && date <= this.data.reportPeriod.to;
    });

    const distsToShow = periodDists.length > 0 ? periodDists : this.data.distributions;
    const isFiltered = periodDists.length > 0 && periodDists.length < this.data.distributions.length;

    if (isFiltered) {
      this.doc.setFontSize(8);
      this.doc.setTextColor(...BRAND_ACCENT);
      this.doc.text(`Showing ${periodDists.length} distributions within reporting period. Full history: ${this.data.distributions.length} records.`, this.margin, this.currentY);
      this.currentY += 6;
    }

    const tableBody = distsToShow.map(d => [
      format(new Date(d.distribution_date), 'dd/MM/yyyy'),
      DIST_TYPE_LABEL[d.distribution_type] || d.distribution_type,
      fmt(d.amount),
      fmt(d.tax_deducted),
      fmt(d.net_amount || d.amount - (d.tax_deducted || 0)),
      d.period_from && d.period_to
        ? `${format(new Date(d.period_from), 'MMM yy')} – ${format(new Date(d.period_to), 'MMM yy')}`
        : '—',
      d.payment_reference || '—',
      d.status,
    ]);

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Date', 'Type', 'Gross', 'Tax', 'Net', 'Period', 'Reference', 'Status']],
      body: tableBody,
      margin: { left: this.margin, right: this.margin },
      headStyles: { fillColor: BRAND_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.column.index === 7 && data.section === 'body') {
          const val = String(data.cell.raw);
          if (val === 'paid') data.cell.styles.textColor = BRAND_SUCCESS;
          else if (val === 'pending') data.cell.styles.textColor = BRAND_WARNING;
        }
      },
    });

    this.addPageFooter();
  }

  // ─── RETURN METRICS ─────────────────────────────────

  private addReturnMetricsPage(): void {
    this.doc.addPage();
    this.addPageHeader('Return Metrics');
    this.currentY = 50;

    const tableBody = this.data.returnMetrics.map(m => [
      m.entity_name || '—',
      fmt(m.capital_invested),
      fmt(m.total_distributions),
      fmt(m.current_equity_value),
      `${(m.cash_on_cash_pct || 0).toFixed(1)}%`,
      `${(m.equity_multiple || 0).toFixed(2)}x`,
      fmt(m.unrealised_gain_loss),
    ]);

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Entity', 'Capital Invested', 'Distributions', 'Equity Value', 'Cash-on-Cash', 'Multiple', 'Unrealised G/L']],
      body: tableBody,
      margin: { left: this.margin, right: this.margin },
      headStyles: { fillColor: BRAND_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          // Color equity multiple
          if (data.column.index === 5) {
            const val = parseFloat(String(data.cell.raw));
            if (val >= 1.5) data.cell.styles.textColor = BRAND_SUCCESS;
            else if (val >= 1) data.cell.styles.textColor = BRAND_WARNING;
          }
          // Color unrealised gain/loss
          if (data.column.index === 6) {
            const val = parseFloat(String(data.cell.raw).replace(/[£,]/g, ''));
            if (val >= 0) data.cell.styles.textColor = BRAND_SUCCESS;
            else data.cell.styles.textColor = [239, 68, 68];
          }
        }
      },
    });

    this.addPageFooter();
  }

  // ─── DISCLAIMER ─────────────────────────────────────

  private addDisclaimer(): void {
    this.doc.addPage();
    this.addPageHeader('Important Information');
    this.currentY = 55;

    this.doc.setFontSize(9);
    this.doc.setTextColor(...BRAND_SECONDARY);

    const disclaimerText = [
      'This investor statement is prepared for information purposes only and should not be relied upon as financial, legal, or tax advice.',
      '',
      'Property valuations are based on management estimates and may differ from formal valuations. Past performance is not indicative of future results.',
      '',
      'Return metrics including equity multiples and cash-on-cash returns are calculated based on available data and may be subject to adjustment.',
      '',
      'Distribution amounts shown are gross of any applicable income tax unless otherwise stated. Investors should consult their own tax advisors.',
      '',
      'This document is confidential and intended solely for the named investor. It should not be distributed to third parties without prior written consent.',
    ];

    disclaimerText.forEach(line => {
      if (line === '') {
        this.currentY += 4;
      } else {
        const lines = this.doc.splitTextToSize(line, this.pageWidth - this.margin * 2);
        this.doc.text(lines, this.margin, this.currentY);
        this.currentY += lines.length * 5;
      }
    });

    this.addPageFooter();
  }

  // ─── HELPERS ────────────────────────────────────────

  private addPageHeader(title: string): void {
    this.doc.setFillColor(...BRAND_PRIMARY);
    this.doc.rect(0, 0, this.pageWidth, 35, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, 22);

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`${this.data.investor.investor_name}`, this.pageWidth - this.margin, 18, { align: 'right' });
    const periodStr = `${format(this.data.reportPeriod.from, 'MMM yyyy')} – ${format(this.data.reportPeriod.to, 'MMM yyyy')}`;
    this.doc.text(periodStr, this.pageWidth - this.margin, 26, { align: 'right' });
  }

  private addPageFooter(): void {
    const ph = this.doc.internal.pageSize.getHeight();
    const pageNum = (this.doc as any).internal.getNumberOfPages();
    this.doc.setFontSize(8);
    this.doc.setTextColor(...BRAND_SECONDARY);
    this.doc.text(`Page ${pageNum}`, this.pageWidth / 2, ph - 10, { align: 'center' });
    this.doc.text('CONFIDENTIAL', this.pageWidth - this.margin, ph - 10, { align: 'right' });
    this.doc.text('Hydrogen Capital', this.margin, ph - 10);
  }
}
