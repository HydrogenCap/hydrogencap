/**
 * Property Passport PDF generator.
 *
 * Builds a multi-page jsPDF document summarising an individual property:
 * cover page, compliance summary, tenancy summary, financial summary, and
 * a recent document index. Colour palette mirrors the print tokens defined
 * in src/index.css (navy primary, success green, warning amber, destructive
 * red). Returns the jsPDF instance so the caller can `.save()` or convert
 * to a Blob for upload.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { Color } from '@/types/pdf';

// Brand palette — matches semantic tokens in src/index.css (RGB form for jsPDF)
const NAVY: Color = [30, 58, 95];        // --primary navy #1e3a5f
const NAVY_LIGHT: Color = [55, 90, 130];
const SUCCESS: Color = [34, 197, 94];    // success green
const WARNING: Color = [234, 179, 8];    // warning amber
const DANGER: Color = [239, 68, 68];     // destructive red
const TEXT_MUTED: Color = [107, 114, 128];
const BORDER: Color = [226, 232, 240];

export type ComplianceStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing' | string;

export interface PassportComplianceItem {
  type: string;
  status: ComplianceStatus;
  expiry_date?: string | null;
}

export interface PassportTenancyItem {
  tenant_name: string;
  start_date?: string | null;
  end_date?: string | null;
  rent_pcm?: number | null;
}

export interface PassportFinancials {
  gross_rent_annual?: number | null;
  total_costs_annual?: number | null;
  noi_annual?: number | null;
  mortgage_balance?: number | null;
  equity?: number | null;
}

export interface PassportDocumentRef {
  name: string;
  doc_type?: string | null;
  date?: string | null;
}

export interface PassportPropertyData {
  address_line_1: string;
  address_line_2?: string | null;
  city?: string | null;
  postcode?: string | null;
  property_type?: string | null;
  bedrooms?: number | null;
  monthly_rent?: number | null;
  current_valuation?: number | null;
  owner_entity_name?: string | null;
  cover_photo_data_url?: string | null; // base64 data URL (optional)
  compliance: PassportComplianceItem[];
  tenancies: PassportTenancyItem[];
  financials: PassportFinancials;
  documents: PassportDocumentRef[];
}

export interface GeneratePassportOptions {
  generatedAt?: Date;
}

function fmtGBP(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(v);
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  try {
    return format(new Date(v), 'dd/MM/yyyy');
  } catch {
    return v;
  }
}

function statusColor(status: ComplianceStatus): Color {
  switch (status) {
    case 'valid':
      return SUCCESS;
    case 'expiring_soon':
      return WARNING;
    case 'expired':
    case 'missing':
      return DANGER;
    default:
      return TEXT_MUTED;
  }
}

function statusLabel(status: ComplianceStatus): string {
  switch (status) {
    case 'valid': return 'Valid';
    case 'expiring_soon': return 'Expiring Soon';
    case 'expired': return 'Expired';
    case 'missing': return 'Missing';
    default: return status;
  }
}

function drawSectionHeading(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1.5, 196, y + 1.5);
  return y + 8;
}

export function generatePassportPDF(
  propertyData: PassportPropertyData,
  options: GeneratePassportOptions = {},
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const generatedAt = options.generatedAt ?? new Date();
  const pageWidth = doc.internal.pageSize.getWidth();

  // ===== Cover page =====
  // Navy header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 50, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('PROPERTY PASSPORT', 14, 18);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const titleAddr = [propertyData.address_line_1, propertyData.address_line_2]
    .filter(Boolean)
    .join(', ');
  doc.text(titleAddr || 'Property', 14, 30);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const sub = [propertyData.city, propertyData.postcode].filter(Boolean).join(', ');
  if (sub) doc.text(sub, 14, 40);

  // Hero photo (optional)
  let cursorY = 60;
  if (propertyData.cover_photo_data_url) {
    try {
      doc.addImage(propertyData.cover_photo_data_url, 'JPEG', 14, cursorY, 182, 80, undefined, 'FAST');
      cursorY += 88;
    } catch {
      // ignore image errors
    }
  }

  // Owner entity
  doc.setTextColor(...TEXT_MUTED);
  doc.setFontSize(10);
  doc.text('Owner Entity', 14, cursorY);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(propertyData.owner_entity_name || '—', 14, cursorY + 6);
  cursorY += 16;

  // Key facts table
  autoTable(doc, {
    startY: cursorY,
    head: [['Key Facts', 'Value']],
    body: [
      ['Property Type', propertyData.property_type ?? '—'],
      ['Bedrooms', propertyData.bedrooms != null ? String(propertyData.bedrooms) : '—'],
      ['Monthly Rent', fmtGBP(propertyData.monthly_rent)],
      ['Current Valuation', fmtGBP(propertyData.current_valuation)],
    ],
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  // Footer (cover)
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated ${format(generatedAt, 'dd MMM yyyy HH:mm')}`,
    14,
    doc.internal.pageSize.getHeight() - 10,
  );

  // ===== Page 2: Compliance =====
  doc.addPage();
  let y = drawSectionHeading(doc, 'Compliance Summary', 20);
  if (propertyData.compliance.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No compliance records.', 14, y);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Certificate', 'Status', 'Expiry']],
      body: propertyData.compliance.map((c) => [
        c.type,
        statusLabel(c.status),
        fmtDate(c.expiry_date),
      ]),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const item = propertyData.compliance[data.row.index];
          const c = statusColor(item.status);
          data.cell.styles.textColor = c;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 10;
  }

  // ===== Tenancy Summary =====
  y = drawSectionHeading(doc, 'Tenancy Summary', y + 4);
  if (propertyData.tenancies.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No active tenancies.', 14, y);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Tenant', 'Start', 'End', 'Rent (pcm)']],
      body: propertyData.tenancies.map((t) => [
        t.tenant_name,
        fmtDate(t.start_date),
        fmtDate(t.end_date),
        fmtGBP(t.rent_pcm),
      ]),
      theme: 'striped',
      headStyles: { fillColor: NAVY_LIGHT, textColor: [255, 255, 255], fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      margin: { left: 14, right: 14 },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 10;
  }

  // ===== Financial Summary =====
  if (y > 240) { doc.addPage(); y = 20; }
  y = drawSectionHeading(doc, 'Financial Summary', y + 4);
  const f = propertyData.financials;
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Amount']],
    body: [
      ['Gross Rent (annual)', fmtGBP(f.gross_rent_annual)],
      ['Total Costs (annual)', fmtGBP(f.total_costs_annual)],
      ['Net Operating Income', fmtGBP(f.noi_annual)],
      ['Mortgage Balance', fmtGBP(f.mortgage_balance)],
      ['Equity', fmtGBP(f.equity)],
    ],
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 0: { cellWidth: 80, fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 10;

  // ===== Document Index =====
  if (y > 240) { doc.addPage(); y = 20; }
  y = drawSectionHeading(doc, 'Recent Documents', y + 4);
  if (propertyData.documents.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('No documents in vault.', 14, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Document', 'Type', 'Date']],
      body: propertyData.documents.slice(0, 25).map((d) => [
        d.name,
        d.doc_type ?? '—',
        fmtDate(d.date),
      ]),
      theme: 'striped',
      headStyles: { fillColor: NAVY_LIGHT, textColor: [255, 255, 255], fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
  }

  // Page footers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - 14,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' },
    );
  }

  return doc;
}

export function slugifyAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'property';
}
