import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

type AutoTableDocument = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

// ── Shared helpers ──────────────────────────────────────────

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 105, 20, { align: 'center' });
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 105, 28, { align: 'center' });
  }
}

function addLegalWarning(doc: jsPDF, y: number, text: string): number {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  const lines = doc.splitTextToSize(text, 170);
  doc.text(lines, 20, y);
  return y + lines.length * 4 + 4;
}

function addField(doc: jsPDF, label: string, value: string, x: number, y: number): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(label + ':', x, y);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(value || '_______________', 130);
  doc.text(lines, x + 40, y);
  return y + Math.max(lines.length * 5, 7);
}

function addSignatureBlock(doc: jsPDF, y: number): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y += 5;
  doc.text('Signed: ______________________________', 20, y);
  y += 10;
  doc.text('Name:  ______________________________', 20, y);
  y += 10;
  doc.text('Date:    ______________________________', 20, y);
  return y + 15;
}

// ── Section 21 Notice (Form 6A) ─────────────────────────────

export interface Section21Data {
  tenantName: string;
  propertyAddress: string;
  landlordName: string;
  noticeDate: string;
  earliestEndDate: string;
  gasCertValid: boolean;
  epcValid: boolean;
  howToRentServed: boolean;
  depositProtected: boolean;
  tenancyStartDate: string;
}

export function generateSection21PDF(data: Section21Data): jsPDF {
  const doc = new jsPDF();

  addHeader(doc, 'HOUSING ACT 1988 — SECTION 21(1) / 21(4)(a)', 'NOTICE REQUIRING POSSESSION OF A PROPERTY LET ON AN ASSURED SHORTHOLD TENANCY (Form 6A)');

  let y = 40;
  y = addField(doc, 'To', data.tenantName, 20, y);
  y = addField(doc, 'Of', data.propertyAddress, 20, y);
  y = addField(doc, 'From', data.landlordName, 20, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const noticeText = `I/We give you notice that I/we require possession of the dwelling-house known as:\n\n${data.propertyAddress}\n\nafter ${format(new Date(data.earliestEndDate), 'dd MMMM yyyy')}.`;
  const noticeLines = doc.splitTextToSize(noticeText, 170);
  doc.text(noticeLines, 20, y);
  y += noticeLines.length * 5 + 8;

  y = addField(doc, 'Notice Date', format(new Date(data.noticeDate), 'dd MMMM yyyy'), 20, y);
  y += 5;

  // Pre-flight checks
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Pre-flight Compliance Checks:', 20, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  const checks = [
    { label: 'Valid Gas Safety Certificate served', ok: data.gasCertValid },
    { label: 'Valid EPC served', ok: data.epcValid },
    { label: 'How to Rent guide served', ok: data.howToRentServed },
    { label: 'Deposit registered with approved scheme', ok: data.depositProtected },
  ];
  for (const c of checks) {
    doc.text(`${c.ok ? '☑' : '☒'} ${c.label}`, 25, y);
    y += 6;
  }

  if (!checks.every(c => c.ok)) {
    y += 3;
    doc.setTextColor(200, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠ WARNING: This Section 21 notice may not be valid.', 20, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  y += 5;
  y = addSignatureBlock(doc, y);

  y = addLegalWarning(doc, y,
    'IMPORTANT: This is a template only and does not constitute legal advice. You should seek professional legal advice before serving any notice. ' +
    'A Section 21 notice may be invalid if certain prescribed requirements have not been met.');

  return doc;
}

// ── Section 8 Notice (Form 3) ───────────────────────────────

export interface Section8Data {
  tenantName: string;
  propertyAddress: string;
  landlordName: string;
  noticeDate: string;
  grounds: string[];
  groundDetails: string;
  earliestCourtDate: string;
}

export function generateSection8PDF(data: Section8Data): jsPDF {
  const doc = new jsPDF();

  addHeader(doc, 'HOUSING ACT 1988 — SECTION 8', 'NOTICE SEEKING POSSESSION OF A PROPERTY LET ON AN ASSURED TENANCY (Form 3)');

  let y = 40;
  y = addField(doc, 'To', data.tenantName, 20, y);
  y = addField(doc, 'Of', data.propertyAddress, 20, y);
  y = addField(doc, 'From', data.landlordName, 20, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const intro = 'I/We give you notice that I/we intend to begin proceedings in the county court to recover possession of the above property on the following ground(s):';
  const introLines = doc.splitTextToSize(intro, 170);
  doc.text(introLines, 20, y);
  y += introLines.length * 5 + 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Grounds relied upon:', 20, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  for (const g of data.grounds) {
    doc.text(`• Ground ${g}`, 25, y);
    y += 6;
  }

  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('Particulars of each ground:', 20, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  const detailLines = doc.splitTextToSize(data.groundDetails || '(Enter particulars here)', 170);
  doc.text(detailLines, 20, y);
  y += detailLines.length * 5 + 5;

  y = addField(doc, 'Notice Date', format(new Date(data.noticeDate), 'dd MMMM yyyy'), 20, y);
  y = addField(doc, 'Earliest Court Date', format(new Date(data.earliestCourtDate), 'dd MMMM yyyy'), 20, y);
  y += 5;
  y = addSignatureBlock(doc, y);

  y = addLegalWarning(doc, y,
    'IMPORTANT: This is a template only and does not constitute legal advice. Seek professional legal advice before serving any notice.');

  return doc;
}

// ── Section 13 Rent Increase ────────────────────────────────

export interface Section13Data {
  tenantName: string;
  propertyAddress: string;
  landlordName: string;
  currentRent: number;
  newRent: number;
  increaseDate: string;
  noticeDate: string;
}

export function generateSection13PDF(data: Section13Data): jsPDF {
  const doc = new jsPDF();

  addHeader(doc, 'HOUSING ACT 1988 — SECTION 13(2)', 'LANDLORD\'S NOTICE PROPOSING A NEW RENT UNDER AN ASSURED PERIODIC TENANCY');

  let y = 40;
  y = addField(doc, 'To', data.tenantName, 20, y);
  y = addField(doc, 'Of', data.propertyAddress, 20, y);
  y = addField(doc, 'From', data.landlordName, 20, y);
  y += 5;

  const pctIncrease = data.currentRent > 0 ? ((data.newRent - data.currentRent) / data.currentRent * 100).toFixed(1) : '0';

  y = addField(doc, 'Current Rent', `£${data.currentRent.toFixed(2)} per month`, 20, y);
  y = addField(doc, 'New Rent', `£${data.newRent.toFixed(2)} per month`, 20, y);
  y = addField(doc, 'Increase', `${pctIncrease}%`, 20, y);
  y = addField(doc, 'Effective From', format(new Date(data.increaseDate), 'dd MMMM yyyy'), 20, y);
  y = addField(doc, 'Notice Date', format(new Date(data.noticeDate), 'dd MMMM yyyy'), 20, y);

  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const note = 'The new rent will take effect from the beginning of the new period of the tenancy starting on or after the date specified above, provided that that date is not earlier than the minimum period after the service of this notice.';
  const noteLines = doc.splitTextToSize(note, 170);
  doc.text(noteLines, 20, y);
  y += noteLines.length * 5 + 8;

  y = addSignatureBlock(doc, y);

  y = addLegalWarning(doc, y,
    'The tenant has the right to refer this notice to a First-tier Tribunal (Property Chamber) before the new rent takes effect.');

  return doc;
}

// ── Guarantor Agreement ─────────────────────────────────────

export interface GuarantorData {
  tenantName: string;
  propertyAddress: string;
  landlordName: string;
  guarantorName: string;
  guarantorAddress: string;
  guaranteedAmount: number;
  tenancyStartDate: string;
}

export function generateGuarantorPDF(data: GuarantorData): jsPDF {
  const doc = new jsPDF();

  addHeader(doc, 'GUARANTOR AGREEMENT');

  let y = 35;
  y = addField(doc, 'Landlord', data.landlordName, 20, y);
  y = addField(doc, 'Tenant', data.tenantName, 20, y);
  y = addField(doc, 'Property', data.propertyAddress, 20, y);
  y = addField(doc, 'Guarantor', data.guarantorName, 20, y);
  y = addField(doc, 'Guarantor Address', data.guarantorAddress, 20, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const clauses = [
    `1. The Guarantor unconditionally and irrevocably guarantees to the Landlord the performance by the Tenant of the Tenant's obligations under the tenancy agreement dated ${format(new Date(data.tenancyStartDate), 'dd MMMM yyyy')}.`,
    `2. The maximum liability of the Guarantor under this agreement shall not exceed £${data.guaranteedAmount.toFixed(2)}.`,
    `3. The Guarantor shall indemnify the Landlord against all losses, damages, costs and expenses arising from any breach of the tenancy agreement by the Tenant.`,
    `4. This guarantee shall remain in force for the duration of the tenancy, including any statutory periodic tenancy.`,
    `5. The Guarantor acknowledges having read and understood the tenancy agreement.`,
  ];

  for (const clause of clauses) {
    const lines = doc.splitTextToSize(clause, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 3;
  }

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Guarantor Signature:', 20, y);
  y += 3;
  y = addSignatureBlock(doc, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Landlord Signature:', 20, y);
  y += 3;
  y = addSignatureBlock(doc, y);

  return doc;
}

// ── Inventory Template ──────────────────────────────────────

export interface InventoryData {
  propertyAddress: string;
  rooms: { name: string }[];
  date: string;
}

export function generateInventoryPDF(data: InventoryData): jsPDF {
  const doc = new jsPDF();

  addHeader(doc, 'INVENTORY & SCHEDULE OF CONDITION');

  let y = 35;
  y = addField(doc, 'Property', data.propertyAddress, 20, y);
  y = addField(doc, 'Date', format(new Date(data.date), 'dd MMMM yyyy'), 20, y);
  y += 5;

  const sections = ['Walls', 'Ceiling', 'Floor', 'Doors', 'Windows', 'Fixtures', 'Furniture', 'General Condition'];

  for (const room of data.rooms) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(room.name, 20, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Condition', 'Notes']],
      body: sections.map(s => [s, '', '']),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [60, 60, 60] },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 50 }, 2: { cellWidth: 80 } },
    });

    y = ((doc as AutoTableDocument).lastAutoTable?.finalY || y) + 10;
  }

  // Signature block at the end
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Landlord/Agent:', 20, y);
  y += 3;
  y = addSignatureBlock(doc, y);
  doc.text('Tenant:', 20, y);
  y += 3;
  y = addSignatureBlock(doc, y);

  return doc;
}

// ── How to Rent Cover Letter ────────────────────────────────

export interface HowToRentCoverData {
  tenantName: string;
  propertyAddress: string;
  landlordName: string;
  servedDate: string;
}

export function generateHowToRentCoverPDF(data: HowToRentCoverData): jsPDF {
  const doc = new jsPDF();

  addHeader(doc, 'HOW TO RENT — PROOF OF SERVICE');

  let y = 35;
  y = addField(doc, 'Date', format(new Date(data.servedDate), 'dd MMMM yyyy'), 20, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const body = [
    `Dear ${data.tenantName},`,
    '',
    `This letter confirms that on ${format(new Date(data.servedDate), 'dd MMMM yyyy')}, you were provided with a copy of the Government's "How to Rent: the checklist for renting in England" guide in relation to your tenancy at:`,
    '',
    data.propertyAddress,
    '',
    'This guide contains important information about your rights and responsibilities as a tenant.',
    '',
    'Please sign and date one copy of this letter and return it to confirm receipt.',
    '',
    `Yours sincerely,`,
    '',
    data.landlordName,
  ];

  for (const line of body) {
    doc.text(line, 20, y);
    y += 6;
  }

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Tenant acknowledgement:', 20, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('I confirm I have received a copy of the How to Rent guide.', 20, y);
  y += 10;
  y = addSignatureBlock(doc, y);

  return doc;
}

// ── Tenant Reference Request ────────────────────────────────

export interface ReferenceRequestData {
  propertyAddress: string;
  landlordName: string;
  prospectName: string;
  previousAddress: string;
  date: string;
}

export function generateReferenceRequestPDF(data: ReferenceRequestData): jsPDF {
  const doc = new jsPDF();

  addHeader(doc, 'LANDLORD REFERENCE REQUEST');

  let y = 35;
  y = addField(doc, 'Date', format(new Date(data.date), 'dd MMMM yyyy'), 20, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const lines = [
    'Dear Sir/Madam,',
    '',
    `I am writing to request a landlord reference for the following prospective tenant:`,
    '',
    `Name: ${data.prospectName}`,
    `Previous address: ${data.previousAddress}`,
    '',
    `They have applied to rent a property at: ${data.propertyAddress}`,
    '',
    'I would be grateful if you could confirm the following:',
  ];

  for (const l of lines) {
    doc.text(l, 20, y);
    y += 6;
  }

  y += 3;
  const questions = [
    '1. How long was the tenant at the property?  _______________',
    '2. Was rent always paid on time?  Yes / No',
    '3. Was the property left in good condition?  Yes / No',
    '4. Were there any complaints or issues?  _______________',
    '5. Would you rent to this tenant again?  Yes / No',
  ];

  for (const q of questions) {
    doc.text(q, 25, y);
    y += 8;
  }

  y += 5;
  doc.text(`Yours faithfully,`, 20, y);
  y += 10;
  doc.text(data.landlordName, 20, y);

  return doc;
}
