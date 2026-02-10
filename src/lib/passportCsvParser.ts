// CSV parsing utilities for property passport import
import { parseCSV as baseParseCsv, type ParsedCSVRow, type ParsedCSV } from './csvParser';

export { type ParsedCSVRow, type ParsedCSV };
export const parseCSV = baseParseCsv;

// Passport field definitions for mapping - keys MUST match actual DB columns in property_passport
export const PASSPORT_FIELDS = [
  // Match fields (not DB columns - used for property matching only)
  { key: 'address_match', label: 'Address (for matching)', required: true, category: 'match' },
  { key: 'postcode_match', label: 'Postcode (for matching)', required: false, category: 'match' },
  
  // Classification & Identity (actual DB columns)
  { key: 'asset_agreement_category', label: 'Asset Agreement Category', required: false, category: 'classification' },
  { key: 'asset_performance_rating', label: 'Asset Performance Rating', required: false, category: 'classification' },
  { key: 'occupation_status', label: 'Occupation Status', required: false, category: 'classification' },
  { key: 'owned_by', label: 'Owner / SPV', required: false, category: 'classification' },
  { key: 'council_tax_band', label: 'Council Tax Band', required: false, category: 'classification' },
  
  // Construction & Details
  { key: 'construction_type', label: 'Construction Type', required: false, category: 'details' },
  { key: 'construction_date_band', label: 'Construction Period', required: false, category: 'details' },
  { key: 'built_in_year', label: 'Built In Year', required: false, category: 'details' },
  { key: 'number_of_storeys', label: 'Storeys', required: false, category: 'details' },
  { key: 'base_clarification', label: 'Base Clarification', required: false, category: 'details' },

  // Location (actual DB columns)
  { key: 'town_city', label: 'Town / City', required: false, category: 'location' },
  { key: 'county', label: 'County / Area', required: false, category: 'location' },
  { key: 'postcode', label: 'Passport Postcode', required: false, category: 'location' },
  { key: 'maintenance_area', label: 'Maintenance Area', required: false, category: 'location' },
  { key: 'local_authority', label: 'Local Authority', required: false, category: 'location' },
  { key: 'local_authority_text', label: 'Local Authority (text)', required: false, category: 'location' },

  // Accommodation
  { key: 'kitchens', label: 'Kitchens', required: false, category: 'accommodation' },
  { key: 'ensuites', label: 'Ensuites', required: false, category: 'accommodation' },
  { key: 'living_rooms_communal', label: 'Communal Living Rooms', required: false, category: 'accommodation' },
  { key: 'wc_cloakroom', label: 'WC / Cloakroom', required: false, category: 'accommodation' },

  // Amenities & Access
  { key: 'parking', label: 'Parking', required: false, category: 'amenities' },
  { key: 'basement', label: 'Basement', required: false, category: 'amenities' },
  { key: 'carport', label: 'Carport', required: false, category: 'amenities' },
  { key: 'has_loft_access', label: 'Has Loft Access', required: false, category: 'amenities' },
  { key: 'loft_access', label: 'Loft Access Detail', required: false, category: 'amenities' },
  { key: 'access_ramp', label: 'Access Ramp', required: false, category: 'amenities' },
  { key: 'has_bin_store', label: 'Bin Store', required: false, category: 'amenities' },
  { key: 'has_cycle_store', label: 'Cycle Store', required: false, category: 'amenities' },
  { key: 'has_guest_room', label: 'Guest Room', required: false, category: 'amenities' },
  { key: 'block_communal_entrance', label: 'Block Communal Entrance', required: false, category: 'amenities' },
  { key: 'communal_tv_supply', label: 'Communal TV Supply', required: false, category: 'amenities' },

  // Utilities & Meters
  { key: 'has_gas_supply', label: 'Has Gas Supply', required: false, category: 'utilities' },
  { key: 'electric_meter_location', label: 'Electric Meter Location', required: false, category: 'utilities' },
  { key: 'electric_meter_number', label: 'Electric Meter Number', required: false, category: 'utilities' },
  { key: 'gas_meter_location', label: 'Gas Meter Location', required: false, category: 'utilities' },
  { key: 'gas_meter_number', label: 'Gas Meter Number', required: false, category: 'utilities' },
  { key: 'water_meter_location', label: 'Water Meter Location', required: false, category: 'utilities' },
  { key: 'water_meter_number', label: 'Water Meter Number', required: false, category: 'utilities' },
  { key: 'water_stop_tap_location', label: 'Water Stop Tap Location', required: false, category: 'utilities' },

  // Oil
  { key: 'oil_supplier', label: 'Oil Supplier', required: false, category: 'utilities' },
  { key: 'oil_tank_location', label: 'Oil Tank Location', required: false, category: 'utilities' },
  { key: 'oil_tank_capacity_litres', label: 'Oil Tank Capacity (L)', required: false, category: 'utilities' },

  // Security & Access
  { key: 'keysafe_code', label: 'Keysafe Code', required: false, category: 'access' },

  // HMO / Licensing
  { key: 'hmo_licence_required', label: 'HMO Licence Required', required: false, category: 'licensing' },
  { key: 'hmo_licence', label: 'HMO Licence', required: false, category: 'licensing' },
  { key: 'hmo_licence_number', label: 'HMO Licence Number', required: false, category: 'licensing' },
  { key: 'hmo_licence_expiry', label: 'HMO Licence Expiry', required: false, category: 'licensing' },
  { key: 'hmo_bed_spaces', label: 'HMO Bed Spaces', required: false, category: 'licensing' },

  // Management
  { key: 'management_company_text', label: 'Management Company', required: false, category: 'management' },
  { key: 'property_management_company', label: 'Property Management Company', required: false, category: 'management' },
  { key: 'property_management_fee_percent', label: 'Management Fee (%)', required: false, category: 'management' },

  // Links
  { key: 'dropbox_link', label: 'Dropbox Link', required: false, category: 'links' },
  { key: 'photographs_link', label: 'Photographs Link', required: false, category: 'links' },
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

const INTEGER_FIELDS = new Set<string>([
  'kitchens', 'ensuites', 'living_rooms_communal',
  'wc_cloakroom', 'number_of_storeys', 'hmo_bed_spaces', 'built_in_year',
]);

const FLOAT_FIELDS = new Set<string>([
  'property_management_fee_percent', 'oil_tank_capacity_litres',
]);

const BOOLEAN_FIELDS = new Set<string>([
  'basement', 'carport', 'has_loft_access', 'access_ramp',
  'has_bin_store', 'has_cycle_store', 'has_guest_room', 'has_gas_supply',
  'hmo_licence_required', 'hmo_licence', 'communal_tv_supply',
]);

const DATE_FIELDS = new Set<string>(['hmo_licence_expiry']);

function parseBoolean(value: string): boolean {
  const lower = value.toLowerCase();
  return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'y';
}

function parseDateValue(value: string): string | null {
  if (!value) return null;
  const ukMatch = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const isoDate = new Date(value);
  return !isNaN(isoDate.getTime()) ? isoDate.toISOString().split('T')[0] : null;
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

    Object.entries(mapping).forEach(([csvColumn, fieldKey]) => {
      if (!fieldKey) return;
      const value = row[csvColumn]?.trim() || '';

      if (fieldKey === 'address_match') { matchAddress = value || null; return; }
      if (fieldKey === 'postcode_match') { matchPostcode = value || null; return; }

      if (INTEGER_FIELDS.has(fieldKey)) {
        const num = parseInt(value, 10);
        data[fieldKey] = isNaN(num) ? null : num;
      } else if (FLOAT_FIELDS.has(fieldKey)) {
        const cleaned = value.replace(/[%\s]/g, '');
        const num = parseFloat(cleaned);
        data[fieldKey] = isNaN(num) ? null : num;
      } else if (BOOLEAN_FIELDS.has(fieldKey)) {
        data[fieldKey] = value ? parseBoolean(value) : null;
      } else if (DATE_FIELDS.has(fieldKey)) {
        data[fieldKey] = parseDateValue(value);
      } else {
        data[fieldKey] = value || null;
      }
    });

    if (!matchAddress && !matchPostcode) {
      errors.push({ row: index, field: 'address_match', message: 'Address or postcode required for matching' });
    }

    return { matchAddress, matchPostcode, matchedPropertyId: null, data, errors, isValid: errors.length === 0 };
  });
}

// Auto-detect column mappings based on header names
export function autoDetectPassportMapping(headers: string[]): PassportColumnMapping {
  const mapping: PassportColumnMapping = {};
  
  const headerPatterns: { pattern: RegExp; field: PassportFieldKey }[] = [
    // Match fields
    { pattern: /^address/i, field: 'address_match' },
    { pattern: /^postcode|post\s*code|zip/i, field: 'postcode_match' },
    
    // Classification
    { pattern: /^asset.*agreement.*category/i, field: 'asset_agreement_category' },
    { pattern: /^asset.*performance/i, field: 'asset_performance_rating' },
    { pattern: /^occupation\s*status/i, field: 'occupation_status' },
    { pattern: /^owned\s*by|owner/i, field: 'owned_by' },
    { pattern: /^council\s*tax/i, field: 'council_tax_band' },

    // Details
    { pattern: /^construction\s*type/i, field: 'construction_type' },
    { pattern: /^construction.*date.*band|age\s*band/i, field: 'construction_date_band' },
    { pattern: /^built\s*in\s*year/i, field: 'built_in_year' },
    { pattern: /^storeys|number.*storeys/i, field: 'number_of_storeys' },

    // Location
    { pattern: /^town|city/i, field: 'town_city' },
    { pattern: /^county|^area$/i, field: 'county' },
    { pattern: /^maintenance\s*area/i, field: 'maintenance_area' },
    { pattern: /^local\s*authority/i, field: 'local_authority' },

    // Accommodation
    { pattern: /^kitchen/i, field: 'kitchens' },
    { pattern: /^ensuite/i, field: 'ensuites' },
    { pattern: /^communal\s*living/i, field: 'living_rooms_communal' },
    { pattern: /^wc|cloakroom/i, field: 'wc_cloakroom' },

    // Amenities
    { pattern: /^parking/i, field: 'parking' },
    { pattern: /^basement/i, field: 'basement' },
    { pattern: /^carport/i, field: 'carport' },
    { pattern: /^loft\s*access\s*detail/i, field: 'loft_access' },
    { pattern: /^loft\s*access$/i, field: 'has_loft_access' },
    { pattern: /^access\s*ramp/i, field: 'access_ramp' },
    { pattern: /^bin\s*store/i, field: 'has_bin_store' },
    { pattern: /^cycle\s*store/i, field: 'has_cycle_store' },
    { pattern: /^guest\s*room/i, field: 'has_guest_room' },
    { pattern: /^block\s*communal/i, field: 'block_communal_entrance' },
    { pattern: /^communal\s*tv/i, field: 'communal_tv_supply' },

    // Utilities
    { pattern: /^gas\s*supply/i, field: 'has_gas_supply' },
    { pattern: /^electric\s*meter\s*location/i, field: 'electric_meter_location' },
    { pattern: /^electric\s*meter\s*number/i, field: 'electric_meter_number' },
    { pattern: /^gas\s*meter\s*location/i, field: 'gas_meter_location' },
    { pattern: /^gas\s*meter\s*number/i, field: 'gas_meter_number' },
    { pattern: /^water\s*meter\s*location/i, field: 'water_meter_location' },
    { pattern: /^water\s*meter\s*number/i, field: 'water_meter_number' },
    { pattern: /^water\s*stop\s*tap/i, field: 'water_stop_tap_location' },
    { pattern: /^oil\s*supplier/i, field: 'oil_supplier' },
    { pattern: /^oil\s*tank\s*location/i, field: 'oil_tank_location' },
    { pattern: /^oil\s*tank\s*capacity/i, field: 'oil_tank_capacity_litres' },

    // Access
    { pattern: /^keysafe|key\s*safe/i, field: 'keysafe_code' },

    // HMO
    { pattern: /^hmo\s*licence\s*required/i, field: 'hmo_licence_required' },
    { pattern: /^hmo\s*licence\s*number/i, field: 'hmo_licence_number' },
    { pattern: /^hmo\s*licence\s*expiry/i, field: 'hmo_licence_expiry' },
    { pattern: /^hmo\s*bed\s*spaces/i, field: 'hmo_bed_spaces' },
    { pattern: /^hmo\s*licence$/i, field: 'hmo_licence' },

    // Management
    { pattern: /^management\s*company$/i, field: 'management_company_text' },
    { pattern: /^property\s*management\s*company/i, field: 'property_management_company' },
    { pattern: /^management\s*fee/i, field: 'property_management_fee_percent' },

    // Links
    { pattern: /^dropbox/i, field: 'dropbox_link' },
    { pattern: /^photograph/i, field: 'photographs_link' },
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
