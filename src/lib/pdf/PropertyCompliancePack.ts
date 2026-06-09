import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ReportPdfBase } from './ReportPdfBase';
import { BRAND_SUCCESS, BRAND_WARNING, BRAND_DANGER } from './colors';
import { getComplianceStatus } from './status';
import type { PropertyReportData, ReportFilters } from './types';

export class PropertyCompliancePack extends ReportPdfBase {
  private property: PropertyReportData;
  private filters: ReportFilters;
  private attachmentUrls: { name: string; url: string }[] = [];

  constructor(property: PropertyReportData, filters: ReportFilters) {
    super();
    this.property = property;
    this.filters = filters;

    if (filters.includeAttachments) {
      this.property.complianceItems.forEach(item => {
        if (item.documents && item.documents.length > 0) {
          const doc = item.documents[0];
          if (doc.file_url) {
            this.attachmentUrls.push({
              name: doc.original_file_name,
              url: doc.file_url,
            });
          }
        }
      });
    }
  }

  generate() {
    this.addCoverPage();
    this.doc.addPage();
    this.addPropertyOverview();
    this.addComplianceStatement();
    this.addCertificateIndex();
    this.addComplianceNarrative();

    if (this.filters.includeAttachments && this.attachmentUrls.length > 0) {
      this.addAttachmentsAppendix();
    }

    return this;
  }

  private addCoverPage() {
    this.doc.setFillColor(26, 58, 118);
    this.doc.rect(0, 0, this.pageWidth, 90, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Property Compliance Pack', this.margin, 40);

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Statutory Compliance Documentation', this.margin, 55);

    this.doc.setFontSize(12);
    this.doc.text(this.property.address_line, this.margin, 75);

    this.currentY = 110;
    this.doc.setTextColor(0, 0, 0);

    this.addKeyValue('Property Address', `${this.property.address_line}, ${this.property.postcode || ''}`);
    this.addKeyValue('Local Authority', this.property.passport?.local_authority_text || this.property.area_name);
    this.addKeyValue('Report Generated', format(new Date(), 'dd MMMM yyyy \'at\' HH:mm'));

    this.currentY += 20;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Prepared by:', this.margin, this.currentY);
    this.currentY += 6;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Tenure IQ', this.margin, this.currentY);
    this.currentY += 5;
    this.doc.text('Managed by Tenure IQ', this.margin, this.currentY);
  }

  private addPropertyOverview() {
    this.addHeader('Property Overview');

    if (this.property.lifecycle_type === 'development') {
      this.addBanner('⚠ Development mode: certificates shown are those currently held; compliance enforcement activates on Go Live.');
    }

    this.addKeyValue('Full Address', `${this.property.address_line}, ${this.property.postcode || ''}`);
    this.addKeyValue('Local Authority', this.property.passport?.local_authority_text || this.property.area_name || '—');
    this.addKeyValue('Asset Category', this.property.asset_category || this.property.property_type);
    this.addKeyValue('Occupancy Type', this.property.is_hmo_licensed ? 'Licensed HMO' : 'Standard Let');
    this.addKeyValue('Bedrooms', this.property.beds?.toString());
    this.addKeyValue('Bathrooms', this.property.bathrooms?.toString());
    this.addKeyValue('Tenure', this.property.tenure);
    this.addKeyValue('Owner/SPV', this.property.ownerName || '—');
  }

  private addComplianceStatement() {
    this.currentY += 10;
    this.addSectionTitle('Compliance Statement');

    this.doc.setFillColor(240, 249, 255);
    this.doc.roundedRect(this.margin, this.currentY - 3, this.pageWidth - (this.margin * 2), 25, 3, 3, 'F');

    this.doc.setFontSize(10);
    this.doc.setTextColor(26, 58, 118);
    const statement = 'This pack summarises statutory compliance documents held for the above property. ' +
      'All certificates are maintained in accordance with relevant legislation and industry best practice.';
    const lines = this.doc.splitTextToSize(statement, this.pageWidth - (this.margin * 2) - 10);
    this.doc.text(lines, this.margin + 5, this.currentY + 5);
    this.currentY += 30;
    this.doc.setTextColor(0, 0, 0);
  }

  private addCertificateIndex() {
    this.addSectionTitle('Certificate Index');

    const tableData = this.property.complianceItems.map(item => {
      const status = getComplianceStatus(item);
      return [
        item.compliance_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        item.issue_date ? format(new Date(item.issue_date), 'dd/MM/yyyy') : '—',
        item.expiry_date ? format(new Date(item.expiry_date), 'dd/MM/yyyy') : 'N/A',
        item.documents?.[0]?.original_file_name || 'Not uploaded',
      ];
    });

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Certificate Type', 'Status', 'Issue Date', 'Expiry Date', 'Reference/File']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [26, 58, 118], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          const value = (data.cell.raw as string).toLowerCase();
          if (value.includes('expired')) data.cell.styles.textColor = BRAND_DANGER;
          if (value.includes('expiring')) data.cell.styles.textColor = BRAND_WARNING;
          if (value.includes('valid')) data.cell.styles.textColor = BRAND_SUCCESS;
        }
      },
    });

    this.currentY = this.doc.lastAutoTable.finalY + 15;
  }

  private addComplianceNarrative() {
    this.checkNewPage(50);
    this.addSectionTitle('Compliance Management');

    const validCount = this.property.complianceItems.filter(i => getComplianceStatus(i) === 'valid').length;
    const totalCount = this.property.complianceItems.length;

    const narrative = `This property is managed under a proactive compliance management regime. ` +
      `Scheduled inspections are conducted in accordance with regulatory requirements, with expiry dates tracked and renewals initiated in advance. ` +
      `Currently, ${validCount} of ${totalCount} tracked compliance items are fully valid. ` +
      `All documentation is retained digitally and available for inspection upon request.`;

    this.addParagraph(narrative);

    this.currentY += 10;
    this.doc.setFontSize(9);
    this.doc.setTextColor(107, 114, 128);
    this.doc.text('For queries regarding this property or compliance documentation, please contact:', this.margin, this.currentY);
    this.currentY += 6;
    this.doc.text('Tenure IQ | office@tenureiq.com', this.margin, this.currentY);
  }

  private addAttachmentsAppendix() {
    this.doc.addPage();
    this.addHeader('Certificate Attachments Appendix');

    this.doc.setFontSize(10);
    this.doc.setTextColor(0, 0, 0);
    this.addParagraph(
      `The following ${this.attachmentUrls.length} certificate document(s) are referenced in this compliance pack. ` +
      `Original digital copies are available upon request or via the property management portal.`
    );

    this.currentY += 5;

    const tableData = this.attachmentUrls.map((att, idx) => [
      String(idx + 1),
      att.name,
      'Digital file available',
    ]);

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['#', 'Document Name', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [26, 58, 118], fontSize: 9, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 100 },
        2: { cellWidth: 50 },
      },
    });

    this.currentY = this.doc.lastAutoTable.finalY + 15;

    this.doc.setFillColor(240, 249, 255);
    this.doc.roundedRect(this.margin, this.currentY, this.pageWidth - (this.margin * 2), 20, 3, 3, 'F');

    this.doc.setFontSize(9);
    this.doc.setTextColor(26, 58, 118);
    const note = 'Note: For security and data protection, original certificate files are stored securely and can be ' +
      'accessed via the Tenure IQ property portal or provided as separate attachments upon verification.';
    const lines = this.doc.splitTextToSize(note, this.pageWidth - (this.margin * 2) - 10);
    this.doc.text(lines, this.margin + 5, this.currentY + 7);
  }
}
