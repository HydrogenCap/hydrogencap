import { format } from 'date-fns';

// ─── Existing doc_type codes (used by inbox review flow — keep as-is) ───

const DOC_TYPE_CODES: Record<string, string> = {
  epc_certificate: 'EPC',
  gas_safety_certificate: 'GasSafety',
  electrical_certificate: 'EICR',
  insurance_policy: 'Insurance',
  tenancy_agreement: 'Tenancy',
  mortgage_offer: 'Mortgage',
  valuation_report: 'Valuation',
  inventory: 'Inventory',
  rent_statement: 'RentStatement',
  service_charge: 'ServiceCharge',
  ground_rent: 'GroundRent',
  council_tax: 'CouncilTax',
  utility_bill: 'Utility',
  asbestos_management_survey: 'AsbestosManagement',
  asbestos_rd_survey: 'AsbestosRD',
  other: 'Doc',
};

// ─── New category slug codes (used by document upload flow) ──────────

const CATEGORY_CODES: Record<string, string> = {
  'legal-pack': 'LEGAL',
  'title-deeds': 'TITLE',
  'mortgage': 'MORTGAGE',
  'insurance': 'INSURANCE',
  'valuation': 'VALUATION',
  'survey': 'SURVEY',
  'planning': 'PLANNING',
  'building-control': 'BLDGCTRL',
  'epc': 'EPC',
  'gas-safety': 'GAS',
  'eicr': 'EICR',
  'hmo-licence': 'HMO',
  'fire-safety': 'FIRE',
  'tenancy-agreement': 'TENANCY',
  'inventory': 'INVENTORY',
  'reference': 'REF',
  'id-document': 'ID',
  'company-accounts': 'ACCOUNTS',
  'shareholder-agreement': 'SHAREHOLDER',
  'board-minutes': 'MINUTES',
  'invoice': 'INVOICE',
  'quote': 'QUOTE',
  'photo': 'PHOTO',
  'other': 'DOC',
};

// ─── Shared helpers ──────────────────────────────────────────────────

/** Sanitise a string for use in a filename: alphanumeric only, no spaces */
function sanitise(value: string, maxLength: number = 30): string {
  return value
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .substring(0, maxLength);
}

/** Extract file extension from a filename, lowercased, with leading dot */
function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : '.pdf';
}

/**
 * Resolve the entity label for a filename.
 * Priority: property address > company name > tenant name > "General"
 */
export function resolveEntityLabel(context: {
  propertyAddress?: string | null;
  companyName?: string | null;
  tenantName?: string | null;
}): string {
  const { propertyAddress, companyName, tenantName } = context;

  if (propertyAddress) {
    const firstLine = propertyAddress.split(',')[0].trim();
    return sanitise(firstLine, 30);
  }

  if (companyName) {
    return sanitise(companyName, 30);
  }

  if (tenantName) {
    return sanitise(tenantName, 30);
  }

  return 'General';
}

/**
 * Get the category code from a category slug.
 * Falls back to uppercased slug if not mapped, or 'DOC'.
 */
export function getCategoryCode(categorySlug: string | null | undefined): string {
  if (!categorySlug) return 'DOC';
  return CATEGORY_CODES[categorySlug]
    || categorySlug.replace(/-/g, '').toUpperCase().substring(0, 12)
    || 'DOC';
}

// ─── Main filename generator (for uploads) ──────────────────────────

export interface StructuredFilenameParams {
  category: string | null | undefined;
  displayName: string | null | undefined;
  originalFilename: string;
  documentDate?: string | null;
  createdAt?: string | null;
  propertyAddress?: string | null;
  companyName?: string | null;
  tenantName?: string | null;
}

/**
 * Generate a structured filename for a document.
 * Pattern: {CategoryCode}_{Entity}_{DisplayName}_{Date}.{ext}
 * Example: LEGAL_12HighSt_SearchReport_2024-03-15.pdf
 */
export function generateStructuredFilename(params: StructuredFilenameParams): string {
  const {
    category,
    displayName,
    originalFilename,
    documentDate,
    createdAt,
    propertyAddress,
    companyName,
    tenantName,
  } = params;

  const categoryCode = getCategoryCode(category);
  const entityLabel = resolveEntityLabel({ propertyAddress, companyName, tenantName });

  const rawName = displayName || originalFilename.replace(/\.[^.]+$/, '');
  const namePart = sanitise(rawName, 40);

  let dateStr: string;
  try {
    const dateSource = documentDate || createdAt || new Date().toISOString();
    dateStr = format(new Date(dateSource), 'yyyy-MM-dd');
  } catch {
    dateStr = format(new Date(), 'yyyy-MM-dd');
  }

  const ext = getExtension(originalFilename);

  return `${categoryCode}_${entityLabel}_${namePart}_${dateStr}${ext}`;
}

// ─── Existing functions (preserved for inbox review flow) ────────────

/**
 * Generates a standardized filename for a document (used by inbox review).
 * Format: DocType_PropertyAddress_YYYY-MM-DD.ext
 */
export function generateDocumentFilename(params: {
  docType: string;
  propertyAddress?: string | null;
  date?: string | null;
  originalFilename: string;
}): string {
  const { docType, propertyAddress, date, originalFilename } = params;

  const typeCode = DOC_TYPE_CODES[docType] || 'Doc';

  let addressPart = '';
  if (propertyAddress) {
    const firstLine = propertyAddress.split(',')[0].trim();
    addressPart = sanitise(firstLine, 30);
  }

  const dateStr = date
    ? format(new Date(date), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');

  const extension = getExtension(originalFilename);

  const parts = [typeCode];
  if (addressPart) parts.push(addressPart);
  parts.push(dateStr);

  return parts.join('_') + extension;
}

/**
 * Generates the final filename from inbox review context.
 */
export function createFinalFilename(params: {
  docType: string;
  propertyAddress?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  originalFilename: string;
}): string {
  const { docType, propertyAddress, issueDate, expiryDate, originalFilename } = params;
  const date = issueDate || expiryDate;
  return generateDocumentFilename({ docType, propertyAddress, date, originalFilename });
}
