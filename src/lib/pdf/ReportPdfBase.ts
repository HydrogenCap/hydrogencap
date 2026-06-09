import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { Color } from '@/types/pdf';
import { BRAND_PRIMARY, BRAND_WARNING } from './colors';

/**
 * Base class for all Tenure IQ branded PDF reports.
 * Provides shared layout primitives: header bar, footers, section titles,
 * key/value rows, paragraph wrapping, banners, and pagination helpers.
 */
export class ReportPdfBase {
  protected doc: jsPDF;
  protected pageWidth: number;
  protected pageHeight: number;
  protected margin = 20;
  protected currentY = 20;
  protected logoBase64: string | null = null;

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  protected addHeader(title: string) {
    this.doc.setFillColor(26, 58, 118);
    this.doc.rect(0, 0, this.pageWidth, 25, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Tenure IQ', this.margin, 12);

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(title, this.margin, 20);

    this.doc.text(format(new Date(), 'dd MMM yyyy HH:mm'), this.pageWidth - this.margin, 12, { align: 'right' });

    this.currentY = 35;
  }

  protected addFooter() {
    const pageCount = this.doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);

      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15);

      this.doc.setTextColor(128, 128, 128);
      this.doc.setFontSize(8);
      this.doc.text(`Tenure IQ | Confidential`, this.margin, this.pageHeight - 8);
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - this.margin, this.pageHeight - 8, { align: 'right' });
    }
  }

  protected addSectionTitle(title: string, color: Color = BRAND_PRIMARY) {
    this.checkNewPage(15);
    this.doc.setTextColor(color[0], color[1], color[2]);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 8;
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('helvetica', 'normal');
  }

  protected addParagraph(text: string, fontSize = 10) {
    this.doc.setFontSize(fontSize);
    const lines = this.doc.splitTextToSize(text, this.pageWidth - (this.margin * 2));
    this.checkNewPage(lines.length * 5);
    this.doc.text(lines, this.margin, this.currentY);
    this.currentY += lines.length * 5 + 3;
  }

  protected checkNewPage(spaceNeeded: number) {
    if (this.currentY + spaceNeeded > this.pageHeight - 25) {
      this.doc.addPage();
      this.currentY = 25;
    }
  }

  protected addKeyValue(key: string, value: string | null | undefined, inline = true) {
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(key + ':', this.margin, this.currentY);

    this.doc.setFont('helvetica', 'normal');
    const valueText = value || '—';

    if (inline) {
      this.doc.text(valueText, this.margin + 50, this.currentY);
      this.currentY += 5;
    } else {
      this.currentY += 5;
      this.doc.text(valueText, this.margin, this.currentY);
      this.currentY += 5;
    }
  }

  protected addBanner(text: string, bgColor: Color = BRAND_WARNING) {
    this.checkNewPage(15);
    this.doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    this.doc.roundedRect(this.margin, this.currentY - 5, this.pageWidth - (this.margin * 2), 12, 2, 2, 'F');

    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(text, this.margin + 5, this.currentY + 2);
    this.currentY += 15;
    this.doc.setFont('helvetica', 'normal');
  }

  public getBlob(): Blob {
    this.addFooter();
    return this.doc.output('blob');
  }

  public download(filename: string) {
    this.addFooter();
    this.doc.save(filename);
  }
}
