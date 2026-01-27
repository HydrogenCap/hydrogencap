import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { PropertyWithFinancials } from '@/hooks/useProperties';

type Color = [number, number, number];

// Branding colors (HSL to RGB)
const BRAND_PRIMARY: Color = [26, 58, 118]; // Deep blue
const BRAND_SECONDARY: Color = [107, 114, 128]; // Gray
const BRAND_SUCCESS: Color = [34, 197, 94]; // Green
const BRAND_WARNING: Color = [234, 179, 8]; // Amber
const BRAND_DANGER: Color = [239, 68, 68]; // Red

export interface ReportFilters {
  lifecycleType: 'core_rental' | 'development' | 'all';
  propertyIds: string[] | 'all';
  asOfDate: Date;
  includeAttachments: boolean;
}

export interface ComplianceItemData {
  id: string;
  compliance_type: string;
  issue_date: string | null;
  expiry_date: string | null;
  is_required: boolean | null;
  is_manually_excluded: boolean | null;
  documents?: { file_url: string; original_file_name: string }[];
}

export interface PropertyReportData {
  id: string;
  address_line: string;
  postcode: string | null;
  lifecycle_type: string;
  tenure: string | null;
  beds: number | null;
  bathrooms: number | null;
  property_type: string | null;
  area_name: string | null;
  current_value_gbp: number | null;
  purchase_price_gbp: number | null;
  original_purchase_date: string | null;
  epc_rating: string | null;
  is_hmo_licensed: boolean | null;
  asset_category: string | null;
  legal_owner_company_id: string | null;
  complianceItems: ComplianceItemData[];
  loans?: { lender: string | null; current_mortgage_balance_gbp: number | null; interest_rate_percent: number | null; fixed_rate_expires: string | null; capital_or_interest: string | null }[];
  income?: { annual_rent_gbp: number; year: number }[];
  passport?: {
    construction_date_band: string | null;
    council_tax_band: string | null;
    local_authority_text: string | null;
  } | null;
  insurancePolicy?: {
    insurer_name: string | null;
    policy_number: string | null;
    renewal_date: string | null;
    premium_gbp: number | null;
  } | null;
  ownerName?: string;
}

// Status calculation helpers
export function getComplianceStatus(item: ComplianceItemData): 'valid' | 'expiring_soon' | 'expired' | 'missing' {
  if (!item.issue_date && !item.expiry_date) return 'missing';
  if (!item.expiry_date) return 'valid'; // No expiry = perpetual
  
  const expiry = new Date(item.expiry_date);
  const now = new Date();
  const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil <= 0) return 'expired';
  if (daysUntil <= 60) return 'expiring_soon';
  return 'valid';
}

export function getStatusColor(status: string): Color {
  switch (status) {
    case 'valid': return BRAND_SUCCESS;
    case 'expiring_soon': return BRAND_WARNING;
    case 'expired': return BRAND_DANGER;
    case 'missing': return BRAND_SECONDARY;
    default: return BRAND_SECONDARY;
  }
}

// Base PDF class with common utilities
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
    // Header bar
    this.doc.setFillColor(26, 58, 118);
    this.doc.rect(0, 0, this.pageWidth, 25, 'F');
    
    // Title in header
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Hydrogen Capital', this.margin, 12);
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(title, this.margin, 20);
    
    // Date on right
    this.doc.text(format(new Date(), 'dd MMM yyyy HH:mm'), this.pageWidth - this.margin, 12, { align: 'right' });
    
    this.currentY = 35;
  }

  protected addFooter() {
    const pageCount = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Footer line
      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15);
      
      // Footer text
      this.doc.setTextColor(128, 128, 128);
      this.doc.setFontSize(8);
      this.doc.text(`Hydrogen Capital | Confidential`, this.margin, this.pageHeight - 8);
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

// ══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO COMPLIANCE REPORT
// ══════════════════════════════════════════════════════════════════════════════
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
    // Each property detail starts on its own page
    this.addDetailedSections();
    return this;
  }

  private addCoverPage() {
    // Large header block
    this.doc.setFillColor(26, 58, 118);
    this.doc.rect(0, 0, this.pageWidth, 120, 'F');
    
    // Add logo placeholder (white circle with "H" as fallback)
    const logoX = this.margin;
    const logoY = 25;
    const logoSize = 20;
    
    this.doc.setFillColor(255, 255, 255);
    this.doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 'F');
    this.doc.setTextColor(26, 58, 118);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('H', logoX + logoSize / 2, logoY + logoSize / 2 + 2, { align: 'center' });
    
    // Company name next to logo
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(12);
    this.doc.text('Hydrogen Capital', logoX + logoSize + 8, logoY + logoSize / 2 + 2);
    
    // Title
    this.doc.setFontSize(32);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Portfolio Compliance', this.margin, 70);
    this.doc.text('Report', this.margin, 85);
    
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Property Portfolio Overview', this.margin, 105);
    
    // Report info section
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
    
    // Calculate stats
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
    
    // Summary boxes
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
    
    // Narrative
    this.addParagraph(
      `This report provides a comprehensive overview of compliance status across the Hydrogen Capital property portfolio. ` +
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
    
    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    
    // Add note about detailed sections
    this.doc.setFontSize(9);
    this.doc.setTextColor(107, 114, 128);
    this.doc.text('Detailed compliance breakdown for each property follows on subsequent pages.', this.margin, this.currentY);
    this.doc.setTextColor(0, 0, 0);
  }

  private addDetailedSections() {
    this.properties.forEach((prop) => {
      // Always start each property on a new page
      this.doc.addPage();
      this.addHeader(`Property Detail: ${prop.address_line.substring(0, 40)}${prop.address_line.length > 40 ? '...' : ''}`);
      
      // Property title
      this.doc.setFontSize(16);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(26, 58, 118);
      this.doc.text(prop.address_line, this.margin, this.currentY);
      this.currentY += 10;
      this.doc.setTextColor(0, 0, 0);
      
      if (prop.lifecycle_type === 'development') {
        this.addBanner('⚠ Development mode: compliance is informational unless Go Live is completed.');
      }
      
      // Property info in a clean grid
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
      
      // Section header for certificates
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(26, 58, 118);
      this.doc.text('Compliance Certificates', this.margin, this.currentY);
      this.currentY += 6;
      this.doc.setTextColor(0, 0, 0);
      
      // Compliance table
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
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
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

// ══════════════════════════════════════════════════════════════════════════════
// PROPERTY COMPLIANCE PACK (Council / Licensing Pack)
// ══════════════════════════════════════════════════════════════════════════════
export class PropertyCompliancePack extends ReportPdfBase {
  private property: PropertyReportData;
  private filters: ReportFilters;
  private attachmentUrls: { name: string; url: string }[] = [];

  constructor(property: PropertyReportData, filters: ReportFilters) {
    super();
    this.property = property;
    this.filters = filters;
    
    // Collect attachment URLs if enabled
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
    
    // Add attachments appendix if enabled
    if (this.filters.includeAttachments && this.attachmentUrls.length > 0) {
      this.addAttachmentsAppendix();
    }
    
    return this;
  }

  private addCoverPage() {
    // Header block
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
    
    // Property details
    this.currentY = 110;
    this.doc.setTextColor(0, 0, 0);
    
    this.addKeyValue('Property Address', `${this.property.address_line}, ${this.property.postcode || ''}`);
    this.addKeyValue('Local Authority', this.property.passport?.local_authority_text || this.property.area_name);
    this.addKeyValue('Report Generated', format(new Date(), 'dd MMMM yyyy \'at\' HH:mm'));
    
    // Prepared by
    this.currentY += 20;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Prepared by:', this.margin, this.currentY);
    this.currentY += 6;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Hydrogen Capital', this.margin, this.currentY);
    this.currentY += 5;
    this.doc.text('Managed by Oxygen Management Ltd', this.margin, this.currentY);
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
    
    this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
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
    this.doc.text('Oxygen Management Ltd | office@oxygen.rocks', this.margin, this.currentY);
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
    
    // List all attachments with document reference
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
    
    this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
    
    // Note about digital access
    this.doc.setFillColor(240, 249, 255);
    this.doc.roundedRect(this.margin, this.currentY, this.pageWidth - (this.margin * 2), 20, 3, 3, 'F');
    
    this.doc.setFontSize(9);
    this.doc.setTextColor(26, 58, 118);
    const note = 'Note: For security and data protection, original certificate files are stored securely and can be ' +
      'accessed via the Hydrogen Capital property portal or provided as separate attachments upon verification.';
    const lines = this.doc.splitTextToSize(note, this.pageWidth - (this.margin * 2) - 10);
    this.doc.text(lines, this.margin + 5, this.currentY + 7);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MORTGAGE BROKER PACK
// ══════════════════════════════════════════════════════════════════════════════
export class MortgageBrokerPack extends ReportPdfBase {
  private property: PropertyReportData;
  private brokerNotes: string;

  constructor(property: PropertyReportData, brokerNotes = '') {
    super();
    this.property = property;
    this.brokerNotes = brokerNotes;
  }

  generate() {
    this.addHeader('Mortgage Broker Pack');
    this.addPropertySummary();
    this.addValuationFinance();
    this.addIncomeSnapshot();
    this.addDocumentChecklist();
    if (this.brokerNotes) this.addBrokerNotes();
    return this;
  }

  private addPropertySummary() {
    this.addSectionTitle('Property Summary');
    
    this.addKeyValue('Address', `${this.property.address_line}, ${this.property.postcode || ''}`);
    this.addKeyValue('Property Type', this.property.property_type);
    this.addKeyValue('Bedrooms', this.property.beds?.toString());
    this.addKeyValue('Bathrooms', this.property.bathrooms?.toString());
    this.addKeyValue('Local Authority', this.property.passport?.local_authority_text || this.property.area_name);
    this.addKeyValue('Construction Period', this.property.passport?.construction_date_band);
    this.addKeyValue('Council Tax Band', this.property.passport?.council_tax_band);
    this.addKeyValue('EPC Rating', this.property.epc_rating);
    this.addKeyValue('Tenure', this.property.tenure);
    
    this.currentY += 10;
  }

  private addValuationFinance() {
    this.addSectionTitle('Valuation & Finance Snapshot');
    
    const formatGBP = (val: number | null) => val ? `£${val.toLocaleString()}` : '—';
    
    this.addKeyValue('Current Value', formatGBP(this.property.current_value_gbp));
    this.addKeyValue('Purchase Price', formatGBP(this.property.purchase_price_gbp));
    this.addKeyValue('Purchase Date', this.property.original_purchase_date ? format(new Date(this.property.original_purchase_date), 'dd/MM/yyyy') : '—');
    
    const loan = this.property.loans?.[0];
    if (loan) {
      this.currentY += 5;
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Current Mortgage:', this.margin, this.currentY);
      this.currentY += 5;
      this.doc.setFont('helvetica', 'normal');
      
      this.addKeyValue('Lender', loan.lender);
      this.addKeyValue('Balance', formatGBP(loan.current_mortgage_balance_gbp));
      this.addKeyValue('Interest Rate', loan.interest_rate_percent ? `${loan.interest_rate_percent}%` : '—');
      this.addKeyValue('Repayment Type', loan.capital_or_interest === 'interest' ? 'Interest Only' : 'Repayment');
      this.addKeyValue('Fixed Rate Expires', loan.fixed_rate_expires ? format(new Date(loan.fixed_rate_expires), 'dd/MM/yyyy') : '—');
      
      // Calculate LTV
      if (loan.current_mortgage_balance_gbp && this.property.current_value_gbp) {
        const ltv = (loan.current_mortgage_balance_gbp / this.property.current_value_gbp) * 100;
        this.addKeyValue('Current LTV', `${ltv.toFixed(1)}%`);
      }
    } else {
      this.addKeyValue('Mortgage Status', 'Unencumbered / Cash Purchase');
    }
    
    this.currentY += 10;
  }

  private addIncomeSnapshot() {
    if (this.property.lifecycle_type !== 'core_rental') return;
    
    this.addSectionTitle('Income Snapshot');
    
    const currentYear = new Date().getFullYear();
    const income = this.property.income?.find(i => i.year === currentYear);
    
    if (income) {
      this.addKeyValue('Annual Rent', `£${income.annual_rent_gbp.toLocaleString()}`);
      this.addKeyValue('Monthly Rent', `£${Math.round(income.annual_rent_gbp / 12).toLocaleString()}`);
      this.addKeyValue('Rental Strategy', this.property.is_hmo_licensed ? 'HMO - Per Room' : 'Single Let AST');
    } else {
      this.addParagraph('No rental income data recorded for current year.');
    }
    
    this.currentY += 10;
  }

  private addDocumentChecklist() {
    this.checkNewPage(60);
    this.addSectionTitle('Document Checklist for Broker');
    
    const hasEpc = this.property.complianceItems.some(i => i.compliance_type === 'epc' && getComplianceStatus(i) === 'valid');
    const hasEicr = this.property.complianceItems.some(i => i.compliance_type === 'eicr' && getComplianceStatus(i) === 'valid');
    const hasGas = this.property.complianceItems.some(i => i.compliance_type === 'gas_safety' && getComplianceStatus(i) === 'valid');
    
    const checklist = [
      ['EPC Certificate', hasEpc ? 'Present' : 'Missing'],
      ['EICR', hasEicr ? 'Present' : 'Missing'],
      ['Gas Safety Certificate', hasGas ? 'Present' : 'Missing'],
      ['Proof of Ownership (Title)', '—'],
      ['ID Documents', '—'],
      ['AST/Lease Agreement', '—'],
      ['Buildings Insurance Schedule', this.property.insurancePolicy ? 'Present' : 'Missing'],
    ];
    
    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Document', 'Status']],
      body: checklist,
      theme: 'striped',
      headStyles: { fillColor: [26, 58, 118], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          const value = data.cell.raw as string;
          if (value === 'Present') data.cell.styles.textColor = BRAND_SUCCESS;
          if (value === 'Missing') data.cell.styles.textColor = BRAND_DANGER;
        }
      },
    });
    
    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addBrokerNotes() {
    this.checkNewPage(40);
    this.addSectionTitle('Additional Notes');
    this.addParagraph(this.brokerNotes);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INSURANCE BROKER PACK
// ══════════════════════════════════════════════════════════════════════════════
export class InsuranceBrokerPack extends ReportPdfBase {
  private property: PropertyReportData;

  constructor(property: PropertyReportData) {
    super();
    this.property = property;
  }

  generate() {
    this.addHeader('Insurance Broker Pack');
    this.addRiskBuildingSummary();
    this.addComplianceDocsIndex();
    this.addPolicyDetails();
    return this;
  }

  private addRiskBuildingSummary() {
    this.addSectionTitle('Risk & Building Summary');
    
    this.addKeyValue('Address', `${this.property.address_line}, ${this.property.postcode || ''}`);
    this.addKeyValue('Property Type', this.property.property_type);
    this.addKeyValue('Construction Period', this.property.passport?.construction_date_band || '—');
    this.addKeyValue('Bedrooms', this.property.beds?.toString());
    this.addKeyValue('Tenure', this.property.tenure);
    
    this.currentY += 5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Occupancy & Risk:', this.margin, this.currentY);
    this.currentY += 5;
    this.doc.setFont('helvetica', 'normal');
    
    this.addKeyValue('HMO Status', this.property.is_hmo_licensed ? 'Licensed HMO' : 'Standard Residential');
    this.addKeyValue('Occupancy Type', this.property.lifecycle_type === 'core_rental' ? 'Tenanted' : 'Development (Vacant)');
    
    // Fire safety
    const hasFireAlarm = this.property.complianceItems.some(i => i.compliance_type === 'fire_alarm');
    const hasEmergencyLighting = this.property.complianceItems.some(i => i.compliance_type === 'emergency_lighting');
    
    this.addKeyValue('Fire Alarm System', hasFireAlarm ? 'Installed & Certified' : 'Not recorded');
    this.addKeyValue('Emergency Lighting', hasEmergencyLighting ? 'Installed & Certified' : 'Not recorded');
    
    this.currentY += 10;
  }

  private addComplianceDocsIndex() {
    this.addSectionTitle('Compliance Documents (Insurance Relevant)');
    
    const relevantTypes = ['fire_alarm', 'emergency_lighting', 'gas_safety', 'eicr', 'legionella'];
    const relevantItems = this.property.complianceItems.filter(i => 
      relevantTypes.includes(i.compliance_type)
    );
    
    if (relevantItems.length === 0) {
      this.addParagraph('No insurance-relevant compliance documents recorded.');
      return;
    }
    
    const tableData = relevantItems.map(item => {
      const status = getComplianceStatus(item);
      return [
        item.compliance_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        item.expiry_date ? format(new Date(item.expiry_date), 'dd/MM/yyyy') : 'N/A',
        item.documents?.[0]?.original_file_name || '—',
      ];
    });
    
    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Certificate', 'Status', 'Expiry', 'Document']],
      body: tableData,
      theme: 'striped',
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
    
    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addPolicyDetails() {
    this.checkNewPage(40);
    this.addSectionTitle('Current Policy Details');
    
    const policy = this.property.insurancePolicy;
    
    if (policy) {
      this.addKeyValue('Insurer', policy.insurer_name);
      this.addKeyValue('Policy Number', policy.policy_number);
      this.addKeyValue('Renewal Date', policy.renewal_date ? format(new Date(policy.renewal_date), 'dd/MM/yyyy') : '—');
      this.addKeyValue('Annual Premium', policy.premium_gbp ? `£${policy.premium_gbp.toLocaleString()}` : '—');
    } else {
      this.addParagraph('No current insurance policy details recorded in system.');
    }
  }
}
