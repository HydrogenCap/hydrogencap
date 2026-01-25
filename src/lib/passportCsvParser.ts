// CSV parsing utilities for property passport import
import { parseCSV as baseParseCsv, type ParsedCSVRow, type ParsedCSV } from './csvParser';

export { type ParsedCSVRow, type ParsedCSV };
export const parseCSV = baseParseCsv;

// Passport field definitions for mapping
export const PASSPORT_FIELDS = [
  // Match fields
  { key: 'address_match', label: 'Address (for matching)', required: true, category: 'match' },
  { key: 'postcode_match', label: 'Postcode (for matching)', required: false, category: 'match' },
  
  // Location & classification
  { key: 'town_city', label: 'Town/City', required: false, category: 'location' },
  { key: 'county', label: 'County', required: false, category: 'location' },
  { key: 'postcode', label: 'Postcode', required: false, category: 'location' },
  { key: 'local_authority', label: 'Local Authority', required: false, category: 'location' },
  { key: 'maintenance_area', label: 'Maintenance Area', required: false, category: 'location' },
  { key: 'asset_agreement_category', label: 'Asset Category', required: false, category: 'location' },
  { key: 'occupation_status', label: 'Occupation Status', required: false, category: 'location' },
  { key: 'owned_by', label: 'Owned By', required: false, category: 'location' },
  { key: 'owner_tenure', label: 'Owner Tenure', required: false, category: 'location' },
  { key: 'land_registry_title_number', label: 'Title Number', required: false, category: 'location' },
  { key: 'council_tax_band', label: 'Council Tax Band', required: false, category: 'location' },
  
  // Building basics
  { key: 'built_in_year', label: 'Built In Year', required: false, category: 'building' },
  { key: 'construction_date_band', label: 'Construction Date Band', required: false, category: 'building' },
  { key: 'construction_type', label: 'Construction Type', required: false, category: 'building' },
  { key: 'number_of_storeys', label: 'Number of Storeys', required: false, category: 'building' },
  { key: 'basement', label: 'Basement', required: false, category: 'building' },
  { key: 'parking', label: 'Parking', required: false, category: 'building' },
  
  // Access & safety
  { key: 'keysafe_code', label: 'Keysafe Code', required: false, category: 'access' },
  { key: 'loft_access', label: 'Loft Access Notes', required: false, category: 'access' },
  { key: 'has_loft_access', label: 'Has Loft Access', required: false, category: 'access' },
  { key: 'access_ramp', label: 'Access Ramp', required: false, category: 'access' },
  { key: 'block_communal_entrance', label: 'Block/Communal Entrance', required: false, category: 'access' },
  { key: 'communal_tv_supply', label: 'Communal TV Supply', required: false, category: 'access' },
  
  // Utilities & meters
  { key: 'water_stop_tap_location', label: 'Water Stop Tap Location', required: false, category: 'utilities' },
  { key: 'electric_meter_location', label: 'Electric Meter Location', required: false, category: 'utilities' },
  { key: 'gas_meter_location', label: 'Gas Meter Location', required: false, category: 'utilities' },
  { key: 'water_meter_location', label: 'Water Meter Location', required: false, category: 'utilities' },
  { key: 'electric_meter_number', label: 'Electric Meter Number', required: false, category: 'utilities' },
  { key: 'gas_meter_number', label: 'Gas Meter Number', required: false, category: 'utilities' },
  { key: 'water_meter_number', label: 'Water Meter Number', required: false, category: 'utilities' },
  
  // Accommodation schedule
  { key: 'kitchens', label: 'Kitchens', required: false, category: 'schedule' },
  { key: 'bedrooms', label: 'Bedrooms', required: false, category: 'schedule' },
  { key: 'hmo_bed_spaces', label: 'HMO Bed Spaces', required: false, category: 'schedule' },
  { key: 'bathrooms', label: 'Bathrooms', required: false, category: 'schedule' },
  { key: 'wc_cloakroom', label: 'WC/Cloakroom', required: false, category: 'schedule' },
  { key: 'ensuites', label: 'Ensuites', required: false, category: 'schedule' },
  { key: 'living_rooms_communal', label: 'Living Rooms (Communal)', required: false, category: 'schedule' },
  
  // Licensing & compliance
  { key: 'hmo_licence_required', label: 'HMO Licence Required', required: false, category: 'licensing' },
  { key: 'hmo_licence', label: 'HMO Licence Held', required: false, category: 'licensing' },
  { key: 'hmo_licence_number', label: 'HMO Licence Number', required: false, category: 'licensing' },
  { key: 'hmo_licence_expiry', label: 'HMO Licence Expiry', required: false, category: 'licensing' },
  { key: 'asset_performance_rating', label: 'Asset Performance Rating', required: false, category: 'licensing' },
  
  // Storage / amenities
  { key: 'has_bin_store', label: 'Bin Store', required: false, category: 'amenities' },
  { key: 'has_cycle_store', label: 'Cycle Store', required: false, category: 'amenities' },
  { key: 'has_guest_room', label: 'Guest Room', required: false, category: 'amenities' },
  { key: 'carport', label: 'Carport', required: false, category: 'amenities' },
  
  // Links
  { key: 'photographs_link', label: 'Photographs Link', required: false, category: 'links' },
  { key: 'dropbox_link', label: 'Dropbox Link', required: false, category: 'links' },
  
  // Management
  { key: 'property_management_company', label: 'Management Company', required: false, category: 'management' },
  { key: 'property_management_fee_percent', label: 'Management Fee (%)', required: false, category: 'management' },
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
      if (fieldKey === 'built_in_year' || fieldKey === 'number_of_storeys' ||
          fieldKey === 'kitchens' || fieldKey === 'bedrooms' || fieldKey === 'hmo_bed_spaces' ||
          fieldKey === 'bathrooms' || fieldKey === 'wc_cloakroom' || fieldKey === 'ensuites' ||
          fieldKey === 'living_rooms_communal') {
        const num = parseInt(value, 10);
        data[fieldKey] = isNaN(num) ? null : num;
      } else if (fieldKey === 'property_management_fee_percent') {
        const cleaned = value.replace(/[%\s]/g, '');
        const num = parseFloat(cleaned);
        data[fieldKey] = isNaN(num) ? null : num;
      } else if (fieldKey === 'basement' || fieldKey === 'has_loft_access' || 
                 fieldKey === 'access_ramp' || fieldKey === 'communal_tv_supply' ||
                 fieldKey === 'hmo_licence_required' || fieldKey === 'hmo_licence' ||
                 fieldKey === 'has_bin_store' || fieldKey === 'has_cycle_store' ||
                 fieldKey === 'has_guest_room' || fieldKey === 'carport') {
        // Boolean fields
        const lower = value.toLowerCase();
        data[fieldKey] = lower === 'true' || lower === 'yes' || lower === '1' || lower === 'y';
      } else if (fieldKey === 'hmo_licence_expiry') {
        // Date fields - try to parse
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
      } else {
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

// Auto-detect column mappings based on header names
export function autoDetectPassportMapping(headers: string[]): PassportColumnMapping {
  const mapping: PassportColumnMapping = {};
  
  const headerPatterns: { pattern: RegExp; field: PassportFieldKey }[] = [
    // Match fields
    { pattern: /^address|street|property\s*address/i, field: 'address_match' },
    { pattern: /^postcode|post\s*code|zip/i, field: 'postcode_match' },
    
    // Location
    { pattern: /^town|city/i, field: 'town_city' },
    { pattern: /^county/i, field: 'county' },
    { pattern: /^local\s*authority|council/i, field: 'local_authority' },
    { pattern: /^maintenance\s*area/i, field: 'maintenance_area' },
    { pattern: /^asset.*category|agreement.*category/i, field: 'asset_agreement_category' },
    { pattern: /^occupation|occupancy|status/i, field: 'occupation_status' },
    { pattern: /^owned\s*by|owner/i, field: 'owned_by' },
    { pattern: /^tenure|owner\s*tenure/i, field: 'owner_tenure' },
    { pattern: /^title\s*number|land\s*registry/i, field: 'land_registry_title_number' },
    { pattern: /^council\s*tax|tax\s*band/i, field: 'council_tax_band' },
    
    // Building
    { pattern: /^built.*year|year\s*built/i, field: 'built_in_year' },
    { pattern: /^construction.*date|date\s*band/i, field: 'construction_date_band' },
    { pattern: /^construction.*type|build\s*type/i, field: 'construction_type' },
    { pattern: /^storeys|floors|levels/i, field: 'number_of_storeys' },
    { pattern: /^basement/i, field: 'basement' },
    { pattern: /^parking/i, field: 'parking' },
    
    // Access
    { pattern: /^keysafe|key\s*safe|key\s*code/i, field: 'keysafe_code' },
    { pattern: /^loft\s*access|attic\s*access/i, field: 'loft_access' },
    { pattern: /^has\s*loft/i, field: 'has_loft_access' },
    { pattern: /^access\s*ramp|ramp/i, field: 'access_ramp' },
    { pattern: /^communal.*entrance|block.*entrance/i, field: 'block_communal_entrance' },
    { pattern: /^communal\s*tv/i, field: 'communal_tv_supply' },
    
    // Utilities
    { pattern: /^stop\s*tap|water\s*stop/i, field: 'water_stop_tap_location' },
    { pattern: /^electric.*meter.*loc/i, field: 'electric_meter_location' },
    { pattern: /^gas.*meter.*loc/i, field: 'gas_meter_location' },
    { pattern: /^water.*meter.*loc/i, field: 'water_meter_location' },
    { pattern: /^electric.*meter.*num/i, field: 'electric_meter_number' },
    { pattern: /^gas.*meter.*num/i, field: 'gas_meter_number' },
    { pattern: /^water.*meter.*num/i, field: 'water_meter_number' },
    
    // Schedule
    { pattern: /^kitchen/i, field: 'kitchens' },
    { pattern: /^bedroom|beds$/i, field: 'bedrooms' },
    { pattern: /^hmo.*bed|bed\s*space/i, field: 'hmo_bed_spaces' },
    { pattern: /^bathroom|baths$/i, field: 'bathrooms' },
    { pattern: /^wc|cloakroom/i, field: 'wc_cloakroom' },
    { pattern: /^ensuite/i, field: 'ensuites' },
    { pattern: /^living.*communal|communal.*living/i, field: 'living_rooms_communal' },
    
    // Licensing
    { pattern: /^hmo.*required/i, field: 'hmo_licence_required' },
    { pattern: /^hmo.*licence$|^hmo.*license$|^has.*hmo/i, field: 'hmo_licence' },
    { pattern: /^hmo.*number|licence.*number/i, field: 'hmo_licence_number' },
    { pattern: /^hmo.*expiry|licence.*expiry/i, field: 'hmo_licence_expiry' },
    { pattern: /^asset.*performance|performance.*rating/i, field: 'asset_performance_rating' },
    
    // Amenities
    { pattern: /^bin\s*store/i, field: 'has_bin_store' },
    { pattern: /^cycle\s*store|bike\s*store/i, field: 'has_cycle_store' },
    { pattern: /^guest\s*room/i, field: 'has_guest_room' },
    { pattern: /^carport/i, field: 'carport' },
    
    // Links
    { pattern: /^photo.*link|photograph/i, field: 'photographs_link' },
    { pattern: /^dropbox|documents.*link/i, field: 'dropbox_link' },
    
    // Management
    { pattern: /^management.*company|property.*management/i, field: 'property_management_company' },
    { pattern: /^management.*fee|fee.*percent/i, field: 'property_management_fee_percent' },
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
