/**
 * Combined Mortgage Broker Pack covering N properties in a single PDF.
 *
 * Reuses the section builders from `./sections.ts` by swapping
 * `ctx.data` between property contexts. Falls back to single-property
 * generation when only one property is provided.
 */
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { LenderPackContext, type MortgageBrokerPackData } from './context';
import { LenderGradeMortgageBrokerPack } from './LenderGradeMortgageBrokerPack';
import {
  buildPropertySummary,
  buildValuationFinanceSnapshot,
  buildRentalIncomeAffordability,
  buildHmoComplianceLicensing,
  buildBorrowerEntityProfile,
  buildInsuranceSummary,
  buildDocumentChecklist,
  buildExitStrategyRiskNote,
  buildBrokerNotes,
} from './sections';
import { BRAND_PRIMARY, BRAND_SECONDARY } from '../colors';

export class PortfolioLenderPack {
  private ctx: LenderPackContext;
  private packs: MortgageBrokerPackData[];

  constructor(packs: MortgageBrokerPackData[]) {
    if (packs.length === 0) throw new Error('At least one property required');
    this.packs = packs;
    this.ctx = new LenderPackContext(packs[0]);
  }

  generate(): this {
    this.buildPortfolioCover();
    this.ctx.doc.addPage();
    this.buildPortfolioSummaryPage();

    this.packs.forEach((pack, idx) => {
      this.ctx.doc.addPage();
      this.ctx.currentY = 20;
      this.ctx.data = pack;
      this.ctx.addPageHeader(`Property ${idx + 1} of ${this.packs.length} — ${pack.property.address_line}`);
      buildPropertySummary(this.ctx);
      buildValuationFinanceSnapshot(this.ctx);
      this.ctx.doc.addPage();
      buildRentalIncomeAffordability(this.ctx);
      buildHmoComplianceLicensing(this.ctx);
      this.ctx.doc.addPage();
      buildBorrowerEntityProfile(this.ctx);
      buildInsuranceSummary(this.ctx);
      this.ctx.doc.addPage();
      buildExitStrategyRiskNote(this.ctx);
      buildDocumentChecklist(this.ctx);
    });

    if (this.packs[0].brokerNotes) {
      this.ctx.doc.addPage();
      this.ctx.currentY = 20;
      this.ctx.data = this.packs[0];
      this.ctx.addPageHeader('Additional Notes');
      buildBrokerNotes(this.ctx);
    }

    return this;
  }

  private buildPortfolioCover() {
    const { doc, pageWidth, pageHeight, margin } = this.ctx;
    doc.setFillColor(26, 58, 118);
    doc.rect(0, 0, pageWidth, 110, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TENURE IQ', margin, 30);

    doc.setFontSize(28);
    doc.text('Portfolio Lender Pack', margin, 60);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`${this.packs.length} properties`, margin, 78);

    this.ctx.currentY = 130;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('Prepared For', margin, this.ctx.currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(this.packs[0].preparedFor || 'Mortgage Broker / Lender', margin, this.ctx.currentY + 6);
    this.ctx.currentY += 18;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text('Date Generated', margin, this.ctx.currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(format(new Date(), 'dd MMMM yyyy'), margin, this.ctx.currentY + 6);

    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('CONFIDENTIAL — For Addressee Only', margin, pageHeight - 20);
    doc.text('Tenure IQ', pageWidth - margin, pageHeight - 20, { align: 'right' });
  }

  private buildPortfolioSummaryPage() {
    const ctx = this.ctx;
    ctx.currentY = 20;
    ctx.addPageHeader('Portfolio Summary');

    const summary = this.packs[0].portfolioSummary;
    const summaryRows = [
      ['Properties in pack', this.packs.length.toString()],
      ['Total portfolio properties', summary.totalProperties.toString()],
      ['Total bedrooms', summary.totalBedrooms.toString()],
      ['Total portfolio value', ctx.formatGBP(summary.totalValue)],
      ['Total mortgage balance', ctx.formatGBP(summary.totalMortgageBalance)],
      ['Average portfolio LTV', summary.averageLTV ? `${summary.averageLTV.toFixed(1)}%` : '—'],
      ['HMO experience', `${summary.hmoExperienceYears}+ years`],
    ];

    autoTable(ctx.doc, {
      startY: ctx.currentY,
      body: summaryRows,
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70, textColor: BRAND_SECONDARY },
        1: { cellWidth: 80 },
      },
    });
    ctx.currentY = ctx.doc.lastAutoTable.finalY + 12;

    ctx.addSectionTitle('Properties Included');
    const rows = this.packs.map((p, i) => [
      (i + 1).toString(),
      p.property.address_line,
      p.property.postcode ?? '—',
      p.property.beds?.toString() ?? '—',
      ctx.formatGBP(p.property.current_value_gbp),
    ]);
    autoTable(ctx.doc, {
      startY: ctx.currentY,
      head: [['#', 'Address', 'Postcode', 'Beds', 'Value']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: BRAND_PRIMARY, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10 },
        4: { halign: 'right' },
      },
    });
    ctx.currentY = ctx.doc.lastAutoTable.finalY + 10;
  }

  getBlob(): Blob {
    this.ctx.addFooters();
    return this.ctx.doc.output('blob');
  }
}

/**
 * Build a single-PDF lender pack covering one or many properties.
 */
export function buildLenderPackPdf(packs: MortgageBrokerPackData[]): Blob {
  if (packs.length === 1) {
    const single = new LenderGradeMortgageBrokerPack(packs[0]);
    single.generate();
    return single.getBlob();
  }
  return new PortfolioLenderPack(packs).generate().getBlob();
}
