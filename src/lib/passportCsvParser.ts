// CSV parsing utilities for property passport import - SIMPLIFIED
import { parseCSV as baseParseCsv, type ParsedCSVRow, type ParsedCSV } from './csvParser';

export { type ParsedCSVRow, type ParsedCSV };
export const parseCSV = baseParseCsv;

// Passport field definitions for mapping - SIMPLIFIED
export const PASSPORT_FIELDS = [
  // Match fields
  { key: 'address_match', label: 'Address (for matching)', required: true, category: 'match' },
  { key: 'postcode_match', label: 'Postcode (for matching)', required: false, category: 'match' },
  
  // TIER 1 - CORE DATA
  // Ownership & Classification
  { key: 'asset_agreement_category', label: 'Property Type', required: false, category: 'classification' },
  { key: 'owned_by', label: 'Owner / SPV', required: false, category: 'classification' },
  { key: 'owner_tenure', label: 'Tenure', required: false, category: 'classification' },
  { key: 'land_registry_title_number', label: 'Title Number', required: false, category: 'classification' },
  
  // Accommodation
  { key: 'bedrooms', label: 'Bedrooms', required: false, category: 'accommodation' },
  { key: 'bathrooms', label: 'Bathrooms', required: false, category: 'accommodation' },
  { key: 'ensuites', label: 'Ensuites', required: false, category: 'accommodation' },
  { key: 'kitchens', label: 'Kitchens', required: false, category: 'accommodation' },
  { key: 'living_rooms_communal', label: 'Living Rooms', required: false, category: 'accommodation' },
  
  // Licensing
  { key: 'hmo_licence_required', label: 'HMO Licence Required', required: false, category: 'licensing' },
  { key: 'hmo_licence_expiry', label: 'HMO Licence Expiry', required: false, category: 'licensing' },
  
  // Management
  { key: 'property_management_company', label: 'Management Company', required: false, category: 'management' },
  { key: 'property_management_fee_percent', label: 'Management Fee (%)', required: false, category: 'management' },
  
  // TIER 2 - ADVANCED
  { key: 'construction_date_band', label: 'Construction Period', required: false, category: 'construction' },
  { key: 'keysafe_code', label: 'Keysafe Code', required: false, category: 'access' },
  { key: 'loft_access', label: 'Loft Access Notes', required: false, category: 'access' },
  { key: 'has_gas_supply', label: 'Has Mains Gas', required: false, category: 'utilities' },
  { key: 'has_bin_store', label: 'Bin Store', required: false, category: 'amenities' },
  { key: 'has_cycle_store', label: 'Cycle Store', required: false, category: 'amenities' },
] as const;

export type PassportFieldKey = typeof PASSPORT_FIELDS[number]['key'];

export interface PassportColumnMapping {
  [csvColumn: string]: PassportFieldKey | '';
}

export interface PassportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface PassportValidatedRow {
  matchAddress: string | null;
  matchPostcode: string | null;
  matchedPropertyId: string | null;
  data: Record<string, string | number | boolean | null>;
  errors: PassportValidationError[];
  isValid: boolean;
}

export function validateAndTransformPassportRows(
  rows: ParsedCSVRow[],
  mapping: PassportColumnMapping
): PassportValidatedRow[] {
  return rows.map((row, index) => {
    const data: Record<string, string | number | boolean | null> = {};
    const errors: PassportValidationError[] = [];
    let matchAddress: string | null = null;
    let matchPostcode: string | null = null;

    // Apply mapping
    Object.entries(mapping).forEach(([csvColumn, fieldKey]) => {
      if (!fieldKey) return;
      
      const value = row[csvColumn]?.trim() || '';
      
      // Handle match fields
      if (fieldKey === 'address_match') {
        matchAddress = value || null;
        return;
      }
      if (fieldKey === 'postcode_match') {
        matchPostcode = value || null;
        return;
      }
      
      // Transform based on field type
      // Number fields
      if (fieldKey === 'bedrooms' || fieldKey === 'bathrooms' || 
          fieldKey === 'ensuites' || fieldKey === 'kitchens' || 
          fieldKey === 'living_rooms_communal') {
        const num = parseInt(value, 10);
        data[fieldKey] = isNaN(num) ? null : num;
      } 
      // Percentage field
      else if (fieldKey === 'property_management_fee_percent') {
        const cleaned = value.replace(/[%\s]/g, '');
        const num = parseFloat(cleaned);
        data[fieldKey] = isNaN(num) ? null : num;
      } 
      // Boolean fields
      else if (fieldKey === 'hmo_licence_required' || fieldKey === 'has_gas_supply' ||
               fieldKey === 'has_bin_store' || fieldKey === 'has_cycle_store') {
        const lower = value.toLowerCase();
        data[fieldKey] = lower === 'true' || lower === 'yes' || lower === '1' || lower === 'y';
      } 
      // Date fields
      else if (fieldKey === 'hmo_licence_expiry') {
        if (value) {
          // Try UK format first (DD/MM/YYYY)
          const ukMatch = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (ukMatch) {
            const [, day, month, year] = ukMatch;
            data[fieldKey] = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else {
            // Try ISO format
            const isoDate = new Date(value);
            if (!isNaN(isoDate.getTime())) {
              data[fieldKey] = isoDate.toISOString().split('T')[0];
            } else {
              data[fieldKey] = null;
            }
          }
        } else {
          data[fieldKey] = null;
        }
      } 
      // String fields
      else {
        data[fieldKey] = value || null;
      }
    });

    // Check required match field
    if (!matchAddress && !matchPostcode) {
      errors.push({ row: index, field: 'address_match', message: 'Address or postcode required for matching' });
    }

    return {
      matchAddress,
      matchPostcode,
      matchedPropertyId: null, // Will be set during import
      data,
      errors,
      isValid: errors.length === 0,
    };
  });
}

// Auto-detect column mappings based on header names - SIMPLIFIED
export function autoDetectPassportMapping(headers: string[]): PassportColumnMapping {
  const mapping: PassportColumnMapping = {};
  
  const headerPatterns: { pattern: RegExp; field: PassportFieldKey }[] = [
    // Match fields
    { pattern: /^address|street|property\s*address/i, field: 'address_match' },
    { pattern: /^postcode|post\s*code|zip/i, field: 'postcode_match' },
    
    // Classification
    { pattern: /^asset.*category|property\s*type|agreement.*category/i, field: 'asset_agreement_category' },
    { pattern: /^owned\s*by|owner|spv/i, field: 'owned_by' },
    { pattern: /^tenure|owner\s*tenure|freehold|leasehold/i, field: 'owner_tenure' },
    { pattern: /^title\s*number|land\s*registry/i, field: 'land_registry_title_number' },
    
    // Accommodation
    { pattern: /^bedroom|beds$/i, field: 'bedrooms' },
    { pattern: /^bathroom|baths$/i, field: 'bathrooms' },
    { pattern: /^ensuite/i, field: 'ensuites' },
    { pattern: /^kitchen/i, field: 'kitchens' },
    { pattern: /^living.*room|communal.*living/i, field: 'living_rooms_communal' },
    
    // Licensing
    { pattern: /^hmo.*required/i, field: 'hmo_licence_required' },
    { pattern: /^hmo.*expiry|licence.*expiry/i, field: 'hmo_licence_expiry' },
    
    // Management
    { pattern: /^management.*company|property.*management/i, field: 'property_management_company' },
    { pattern: /^management.*fee|fee.*percent/i, field: 'property_management_fee_percent' },
    
    // Advanced
    { pattern: /^construction.*date|date\s*band|age\s*band/i, field: 'construction_date_band' },
    { pattern: /^keysafe|key\s*safe|key\s*code/i, field: 'keysafe_code' },
    { pattern: /^loft\s*access|attic\s*access/i, field: 'loft_access' },
    { pattern: /^gas\s*supply|has\s*gas|mains\s*gas/i, field: 'has_gas_supply' },
    { pattern: /^bin\s*store/i, field: 'has_bin_store' },
    { pattern: /^cycle\s*store|bike\s*store/i, field: 'has_cycle_store' },
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
