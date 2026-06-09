import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ReportPdfBase } from './ReportPdfBase';
import { BRAND_PRIMARY, BRAND_SECONDARY, BRAND_SUCCESS, BRAND_WARNING, BRAND_DANGER } from './colors';
import { getComplianceStatus } from './status';
import type { PropertyReportData, ReportFilters } from './types';

export class PortfolioComplianceReport extends ReportPdfBase {
  private properties: PropertyReportData[];
  private filters: ReportFilters;

  constructor(properties: PropertyReportData[], filters: ReportFilters) {
    super();
    this.properties = properties;
    this.filters = filters;
  }

  generate() {
    this.addCoverPage();
    this.doc.addPage();
    this.addExecutiveSummary();
    this.doc.addPage();
    this.addPropertySummaryTable();
    this.addDetailedSections();
    return this;
  }

  private addCoverPage() {
    this.doc.setFillColor(26, 58, 118);
    this.doc.rect(0, 0, this.pageWidth, 120, 'F');

    const logoX = this.margin;
    const logoY = 25;
    const logoSize = 20;

    this.doc.setFillColor(255, 255, 255);
    this.doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 'F');
    this.doc.setTextColor(26, 58, 118);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('T', logoX + logoSize / 2, logoY + logoSize / 2 + 2, { align: 'center' });

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(12);
    this.doc.text('Tenure IQ', logoX + logoSize + 8, logoY + logoSize / 2 + 2);

    this.doc.setFontSize(32);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Portfolio Compliance', this.margin, 70);
    this.doc.text('Report', this.margin, 85);

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Property Portfolio Overview', this.margin, 105);

    this.doc.setTextColor(0, 0, 0);
    this.currentY = 145;

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Report Details', this.margin, this.currentY);
    this.currentY += 12;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);

    const filterText = this.filters.lifecycleType === 'all' ? 'All Properties' :
      this.filters.lifecycleType === 'core_rental' ? 'Core Rental Only' : 'Development Only';

    this.addKeyValue('Generated', format(new Date(), 'dd MMMM yyyy \'at\' HH:mm'));
    this.addKeyValue('As of Date', format(this.filters.asOfDate, 'dd MMMM yyyy'));
    this.addKeyValue('Portfolio Filter', filterText);
    this.addKeyValue('Properties Included', String(this.properties.length));
  }

  private addExecutiveSummary() {
    this.addHeader('Executive Summary');

    let compliant = 0;
    let missing = 0;
    let expiringSoon = 0;
    let expired = 0;

    this.properties.forEach(prop => {
      let propCompliant = true;
      prop.complianceItems.forEach(item => {
        const status = getComplianceStatus(item);
        if (status === 'missing') { missing++; propCompliant = false; }
        if (status === 'expiring_soon') { expiringSoon++; propCompliant = false; }
        if (status === 'expired') { expired++; propCompliant = false; }
      });
      if (propCompliant) compliant++;
    });

    const boxWidth = (this.pageWidth - (this.margin * 2) - 30) / 4;
    const boxHeight = 25;
    const boxes = [
      { label: 'Total Properties', value: String(this.properties.length), color: BRAND_PRIMARY },
      { label: 'Fully Compliant', value: String(compliant), color: BRAND_SUCCESS },
      { label: 'Expiring Soon', value: String(expiringSoon), color: BRAND_WARNING },
      { label: 'Expired/Missing', value: String(missing + expired), color: BRAND_DANGER },
    ];

    boxes.forEach((box, i) => {
      const x = this.margin + (i * (boxWidth + 10));
      this.doc.setFillColor(box.color[0], box.color[1], box.color[2]);
      this.doc.roundedRect(x, this.currentY, boxWidth, boxHeight, 3, 3, 'F');

      this.doc.setTextColor(255, 255, 255);
      this.doc.setFontSize(18);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(box.value, x + boxWidth / 2, this.currentY + 12, { align: 'center' });

      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(box.label, x + boxWidth / 2, this.currentY + 20, { align: 'center' });
    });

    this.currentY += boxHeight + 15;
    this.doc.setTextColor(0, 0, 0);

    this.addParagraph(
      `This report provides a comprehensive overview of compliance status across the Tenure IQ property portfolio. ` +
      `As of ${format(this.filters.asOfDate, 'dd MMMM yyyy')}, ${compliant} of ${this.properties.length} properties are fully compliant ` +
      `with all required certifications current and valid.`
    );

    if (expired > 0 || missing > 0) {
      this.addParagraph(
        `Immediate attention is required for ${expired + missing} compliance items that are either expired or missing documentation. ` +
        `Additionally, ${expiringSoon} items are due to expire within the next 60 days and should be scheduled for renewal.`
      );
    }
  }

  private addPropertySummaryTable() {
    this.addHeader('Property Compliance Summary');

    const tableData = this.properties.map(prop => {
      let missingCount = 0;
      let expiringCount = 0;
      let expiredCount = 0;

      prop.complianceItems.forEach(item => {
        const status = getComplianceStatus(item);
        if (status === 'missing') missingCount++;
        if (status === 'expiring_soon') expiringCount++;
        if (status === 'expired') expiredCount++;
      });

      const overallStatus = expiredCount > 0 || missingCount > 0 ? 'Critical' :
        expiringCount > 0 ? 'Warning' : 'Compliant';

      return [
        prop.address_line,
        prop.property_type || '—',
        prop.lifecycle_type === 'core_rental' ? 'Core' : 'Dev',
        overallStatus,
        String(missingCount),
        String(expiringCount),
        String(expiredCount),
      ];
    });

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Property', 'Type', 'Lifecycle', 'Status', 'Missing', 'Expiring', 'Expired']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [26, 58, 118], fontSize: 9, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 35 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          const value = data.cell.raw as string;
          if (value === 'Critical') data.cell.styles.textColor = BRAND_DANGER;
          if (value === 'Warning') data.cell.styles.textColor = BRAND_WARNING;
          if (value === 'Compliant') data.cell.styles.textColor = BRAND_SUCCESS;
        }
      },
    });

    this.currentY = this.doc.lastAutoTable.finalY + 10;

    this.doc.setFontSize(9);
    this.doc.setTextColor(107, 114, 128);
    this.doc.text('Detailed compliance breakdown for each property follows on subsequent pages.', this.margin, this.currentY);
    this.doc.setTextColor(0, 0, 0);
  }

  private addDetailedSections() {
    this.properties.forEach((prop) => {
      this.doc.addPage();
      this.addHeader(`Property Detail: ${prop.address_line.substring(0, 40)}${prop.address_line.length > 40 ? '...' : ''}`);

      this.doc.setFontSize(16);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(26, 58, 118);
      this.doc.text(prop.address_line, this.margin, this.currentY);
      this.currentY += 10;
      this.doc.setTextColor(0, 0, 0);

      if (prop.lifecycle_type === 'development') {
        this.addBanner('⚠ Development mode: compliance is informational unless Go Live is completed.');
      }

      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');

      const infoItems = [
        { label: 'Full Address', value: `${prop.address_line}${prop.postcode ? ', ' + prop.postcode : ''}` },
        { label: 'Lifecycle Status', value: prop.lifecycle_type === 'core_rental' ? 'Core Rental' : 'Development' },
        { label: 'Property Type', value: prop.property_type || '—' },
        { label: 'Bedrooms', value: prop.beds?.toString() || '—' },
      ];

      infoItems.forEach(item => {
        this.addKeyValue(item.label, item.value);
      });

      this.currentY += 8;

      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(26, 58, 118);
      this.doc.text('Compliance Certificates', this.margin, this.currentY);
      this.currentY += 6;
      this.doc.setTextColor(0, 0, 0);

      const complianceData = prop.complianceItems.map(item => {
        const status = getComplianceStatus(item);
        return [
          item.compliance_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          item.issue_date ? format(new Date(item.issue_date), 'dd/MM/yyyy') : '—',
          item.expiry_date ? format(new Date(item.expiry_date), 'dd/MM/yyyy') : 'N/A',
          item.documents?.[0]?.original_file_name || '—',
        ];
      });

      if (complianceData.length > 0) {
        autoTable(this.doc, {
          startY: this.currentY,
          head: [['Certificate', 'Status', 'Issue Date', 'Expiry Date', 'Document']],
          body: complianceData,
          theme: 'striped',
          headStyles: { fillColor: [26, 58, 118], fontSize: 9, cellPadding: 4 },
          bodyStyles: { fontSize: 8, cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 55 },
            1: { cellWidth: 25 },
            2: { cellWidth: 25 },
            3: { cellWidth: 25 },
            4: { cellWidth: 45 },
          },
          didParseCell: (data) => {
            if (data.column.index === 1 && data.section === 'body') {
              const value = (data.cell.raw as string).toLowerCase();
              if (value.includes('expired')) data.cell.styles.textColor = BRAND_DANGER;
              if (value.includes('expiring')) data.cell.styles.textColor = BRAND_WARNING;
              if (value.includes('valid')) data.cell.styles.textColor = BRAND_SUCCESS;
            }
          },
        });

        this.currentY = this.doc.lastAutoTable.finalY + 10;
      } else {
        this.doc.setFontSize(9);
        this.doc.setTextColor(107, 114, 128);
        this.doc.text('No compliance items recorded for this property.', this.margin, this.currentY);
        this.currentY += 10;
        this.doc.setTextColor(0, 0, 0);
      }
    });
  }
}
