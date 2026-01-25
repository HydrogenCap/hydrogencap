import { format } from 'date-fns';

// Document type short codes for filenames
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

/**
 * Generates a standardized filename for a document
 * Format: DocType_PropertyAddress_YYYY-MM-DD.ext
 * Example: EPC_123HighStreet_2024-01-15.pdf
 */
export function generateDocumentFilename(params: {
  docType: string;
  propertyAddress?: string | null;
  date?: string | null;
  originalFilename: string;
}): string {
  const { docType, propertyAddress, date, originalFilename } = params;

  // Get document type code
  const typeCode = DOC_TYPE_CODES[docType] || 'Doc';

  // Extract and clean property address (first line, alphanumeric only)
  let addressPart = '';
  if (propertyAddress) {
    // Take first part before comma, remove non-alphanumeric except spaces
    const firstLine = propertyAddress.split(',')[0].trim();
    // Remove special characters, keep letters/numbers, convert spaces to nothing
    addressPart = firstLine
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .substring(0, 30); // Limit length
  }

  // Format date (use provided date or today)
  const dateStr = date 
    ? format(new Date(date), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');

  // Get original file extension
  const extMatch = originalFilename.match(/\.[^.]+$/);
  const extension = extMatch ? extMatch[0].toLowerCase() : '.pdf';

  // Build filename
  const parts = [typeCode];
  if (addressPart) {
    parts.push(addressPart);
  }
  parts.push(dateStr);

  return parts.join('_') + extension;
}

/**
 * Generates the final filename and updates document record
 */
export function createFinalFilename(params: {
  docType: string;
  propertyAddress?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  originalFilename: string;
}): string {
  const { docType, propertyAddress, issueDate, expiryDate, originalFilename } = params;

  // Use issue date if available, otherwise expiry date, otherwise today
  const date = issueDate || expiryDate;

  return generateDocumentFilename({
    docType,
    propertyAddress,
    date,
    originalFilename,
  });
}
