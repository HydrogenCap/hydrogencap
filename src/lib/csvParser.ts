// CSV parsing utilities for property import

export interface ParsedCSVRow {
  [key: string]: string;
}

export interface ParsedCSV {
  headers: string[];
  rows: ParsedCSVRow[];
}

export function parseCSV(text: string): ParsedCSV {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows: ParsedCSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v.trim())) continue;
    
    const row: ParsedCSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  result.push(current.trim());
  return result;
}

// Property field definitions for mapping
export const PROPERTY_FIELDS = [
  { key: 'id', label: 'Property ID', required: false, category: 'system' },
  { key: 'address_line', label: 'Address', required: true },
  { key: 'address_line2', label: 'Address Line 2', required: false },
  { key: 'area_name', label: 'Area/Location', required: false },
  { key: 'postcode', label: 'Postcode', required: false },
  { key: 'property_type', label: 'Property Type', required: false },
  { key: 'beds', label: 'Bedrooms', required: false },
  { key: 'bathrooms', label: 'Bathrooms', required: false },
  { key: 'current_value_gbp', label: 'Current Value (£)', required: false },
  { key: 'purchase_price_gbp', label: 'Purchase Price (£)', required: false },
  { key: 'ownership_entity', label: 'Ownership Entity', required: false },
  { key: 'ownership_percent', label: 'Ownership %', required: false },
  { key: 'epc_rating', label: 'EPC Rating', required: false },
  { key: 'notes', label: 'Notes', required: false },
  // Loan fields
  { key: 'mortgage_balance_gbp', label: 'Mortgage Balance (£)', required: false, category: 'loan' },
  { key: 'lender', label: 'Lender', required: false, category: 'loan' },
  { key: 'interest_rate_percent', label: 'Interest Rate (%)', required: false, category: 'loan' },
  { key: 'mortgage_payment_gbp', label: 'Monthly Mortgage (£)', required: false, category: 'loan' },
  { key: 'fixed_rate_expires', label: 'Fixed Rate Expires', required: false, category: 'loan' },
  // Income fields
  { key: 'annual_rent_gbp', label: 'Annual Rent (£)', required: false, category: 'income' },
] as const;

export type PropertyFieldKey = typeof PROPERTY_FIELDS[number]['key'];

export interface ColumnMapping {
  [csvColumn: string]: PropertyFieldKey | '';
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidatedRow {
  data: Record<string, string | number | null>;
  errors: ValidationError[];
  isValid: boolean;
}

export function validateAndTransformRows(
  rows: ParsedCSVRow[],
  mapping: ColumnMapping
): ValidatedRow[] {
  return rows.map((row, index) => {
    const data: Record<string, string | number | null> = {};
    const errors: ValidationError[] = [];

    // Apply mapping
    Object.entries(mapping).forEach(([csvColumn, fieldKey]) => {
      if (!fieldKey) return;
      
      const value = row[csvColumn]?.trim() || '';
      
      // Transform based on field type
      if (fieldKey === 'id') {
        // Property ID for updates - keep as string, validate UUID format
        if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          data[fieldKey] = value;
        } else {
          data[fieldKey] = null;
        }
      } else if (fieldKey === 'address_line') {
        if (!value) {
          errors.push({ row: index, field: fieldKey, message: 'Address is required' });
        }
        data[fieldKey] = value || null;
      } else if (fieldKey === 'beds' || fieldKey === 'bathrooms') {
        const num = parseInt(value, 10);
        data[fieldKey] = isNaN(num) ? null : num;
      } else if (fieldKey.includes('_gbp') || fieldKey.includes('_percent')) {
        // Parse numeric fields - remove currency symbols and commas
        const cleaned = value.replace(/[£$,\s]/g, '');
        const num = parseFloat(cleaned);
        data[fieldKey] = isNaN(num) ? null : num;
      } else if (fieldKey === 'ownership_percent') {
        const cleaned = value.replace(/[%\s]/g, '');
        const num = parseFloat(cleaned);
        data[fieldKey] = isNaN(num) ? 100 : num;
      } else {
        data[fieldKey] = value || null;
      }
    });

    // Check required fields
    const hasAddress = data['address_line'] && String(data['address_line']).trim();
    if (!hasAddress) {
      if (!errors.some(e => e.field === 'address_line')) {
        errors.push({ row: index, field: 'address_line', message: 'Address is required' });
      }
    }

    return {
      data,
      errors,
      isValid: errors.length === 0,
    };
  });
}

// Auto-detect column mappings based on header names
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  
  const headerPatterns: { pattern: RegExp; field: PropertyFieldKey }[] = [
    { pattern: /^property\s*id|^id$/i, field: 'id' },
    { pattern: /^address($|\s|_)|street|property\s*address/i, field: 'address_line' },
    { pattern: /^address\s*line\s*2|address_line2|address2/i, field: 'address_line2' },
    { pattern: /^area|location|region|town|city/i, field: 'area_name' },
    { pattern: /^postcode|post\s*code|zip/i, field: 'postcode' },
    { pattern: /^type|property\s*type|prop\s*type/i, field: 'property_type' },
    { pattern: /^beds|bedrooms|bed\s*count/i, field: 'beds' },
    { pattern: /^baths|bathrooms|bath\s*count/i, field: 'bathrooms' },
    { pattern: /^(current\s*)?value|market\s*value|valuation/i, field: 'current_value_gbp' },
    { pattern: /^purchase\s*price|bought\s*for|acquisition/i, field: 'purchase_price_gbp' },
    { pattern: /^mortgage\s*balance|loan\s*balance|outstanding/i, field: 'mortgage_balance_gbp' },
    { pattern: /^lender|bank|mortgage\s*provider/i, field: 'lender' },
    { pattern: /^interest\s*rate|rate\s*%|mortgage\s*rate/i, field: 'interest_rate_percent' },
    { pattern: /^(monthly\s*)?mortgage\s*payment|monthly\s*payment/i, field: 'mortgage_payment_gbp' },
    { pattern: /^fixed\s*rate\s*expires|rate\s*expiry/i, field: 'fixed_rate_expires' },
    { pattern: /^(annual\s*)?rent|rental\s*income|yearly\s*rent/i, field: 'annual_rent_gbp' },
    { pattern: /^epc|energy\s*rating/i, field: 'epc_rating' },
    { pattern: /^owner|entity|ownership\s*entity|company/i, field: 'ownership_entity' },
    { pattern: /^ownership\s*%|share|percent/i, field: 'ownership_percent' },
    { pattern: /^notes|comments|description/i, field: 'notes' },
  ];

  headers.forEach(header => {
    for (const { pattern, field } of headerPatterns) {
      if (pattern.test(header)) {
        mapping[header] = field;
        break;
      }
    }
    if (!mapping[header]) {
      mapping[header] = '';
    }
  });

  return mapping;
}
