// Generate missing compliance items for properties based on required types
// Includes conditional logic for mutually exclusive requirements (Fire Alarm vs Smoke Alarm)
// Missing items are shown as 'unknown' status and count toward the Expired total

import type { ComplianceItem, ComplianceStatus } from './complianceTypes';
import { COMPLIANCE_REQUIREMENT_DEFINITIONS, type PropertyComplianceFeatures } from './complianceRequirements';

export interface ComplianceItemWithMissing {
  id: string;
  property_id: string;
  compliance_type: string;
  issue_date: string | null;
  expiry_date: string | null;
  status: ComplianceStatus;
  daysUntilExpiry: number | null;
  isMissing: boolean;
  documents?: { id: string; is_current: boolean }[];
  // Conditional logic fields
  conditionalReason?: string;
  alternativeType?: string;
}

export interface PropertyForCompliance {
  id: string;
  address_line: string;
  postcode: string | null;
  has_gas: boolean | null;
  has_fire_alarm_system: boolean | null;
  fire_alarm_grade: string | null;
  has_emergency_lighting: boolean | null;
  asset_category: string | null;
  is_hmo_licensed: boolean | null;
  selective_licence_required: boolean | null;
  lifecycle_type: string | null;
}

// Define conditional pairs: when one exists, the other becomes optional/not_required
const CONDITIONAL_PAIRS: Record<string, { alternative: string; priority: 'this' | 'alternative' }> = {
  'Fire Alarm Certificate': { alternative: 'Smoke Alarm Declaration', priority: 'alternative' },
  'Smoke Alarm Declaration': { alternative: 'Fire Alarm Certificate', priority: 'this' },
};

/**
 * Calculate status and days until expiry for an item
 */
function calculateItemStatus(expiryDate: string | null): { status: ComplianceStatus; daysUntilExpiry: number | null } {
  if (!expiryDate) {
    return { status: 'unknown', daysUntilExpiry: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: ComplianceStatus;
  if (daysUntilExpiry < 0) {
    status = 'expired';
  } else if (daysUntilExpiry <= 60) {
    status = 'expiring_soon';
  } else {
    status = 'valid';
  }

  return { status, daysUntilExpiry };
}

/**
 * Check if an item has a valid document uploaded (status != unknown)
 */
function hasValidRecord(
  items: Map<string, ComplianceItem & { documents?: { id: string; is_current: boolean }[] }>,
  propertyId: string,
  complianceType: string
): boolean {
  const key = `${propertyId}::${complianceType}`;
  const item = items.get(key);
  if (!item) return false;
  
  // Has a document OR has an expiry date
  const hasDocument = item.documents?.some(d => d.is_current) ?? false;
  return hasDocument || item.expiry_date !== null;
}

/**
 * Get required compliance types for a property based on its features
 */
function getRequiredTypesForProperty(property: PropertyForCompliance): string[] {
  // Skip compliance tracking for properties in development
  if (property.lifecycle_type === 'development') {
    return [];
  }

  const features: PropertyComplianceFeatures = {
    id: property.id,
    address_line: property.address_line,
    has_gas: property.has_gas,
    has_fire_alarm_system: property.has_fire_alarm_system,
    fire_alarm_grade: property.fire_alarm_grade,
    has_emergency_lighting: property.has_emergency_lighting,
    asset_category: property.asset_category,
    occupancy_status: null,
    is_hmo_licensed: property.is_hmo_licensed,
    selective_licence_required: property.selective_licence_required,
    co_alarm_required: property.has_gas, // Assume CO alarm required if has gas
    epc_required: true, // Default to required
    listed_status: null,
  };

  const requiredTypes: string[] = [];

  for (const [typeName, definition] of Object.entries(COMPLIANCE_REQUIREMENT_DEFINITIONS)) {
    if (definition.condition(features)) {
      requiredTypes.push(typeName);
    }
  }

  return requiredTypes;
}

/**
 * Generate all compliance items including missing placeholders with conditional logic
 */
export function generateComplianceItemsWithMissing(
  actualItems: (ComplianceItem & { documents?: { id: string; is_current: boolean }[] })[],
  properties: PropertyForCompliance[]
): ComplianceItemWithMissing[] {
  const result: ComplianceItemWithMissing[] = [];

  // Create a lookup for existing items by property_id + compliance_type
  const existingItemsMap = new Map<string, ComplianceItem & { documents?: { id: string; is_current: boolean }[] }>();
  actualItems.forEach(item => {
    const key = `${item.property_id}::${item.compliance_type}`;
    existingItemsMap.set(key, item);
  });

  // Process each property
  properties.forEach(property => {
    const requiredTypes = getRequiredTypesForProperty(property);

    // Check which conditional items exist for this property
    const hasFireAlarmCert = hasValidRecord(existingItemsMap, property.id, 'Fire Alarm Certificate');
    const hasSmokeAlarmDecl = hasValidRecord(existingItemsMap, property.id, 'Smoke Alarm Declaration');

    requiredTypes.forEach(complianceType => {
      const key = `${property.id}::${complianceType}`;
      const existingItem = existingItemsMap.get(key);

      let conditionalStatus: ComplianceStatus | null = null;
      let conditionalReason: string | undefined;
      let alternativeType: string | undefined;

      // Apply conditional logic for Fire Alarm Certificate / Smoke Alarm Declaration
      if (complianceType === 'Smoke Alarm Declaration') {
        if (hasFireAlarmCert) {
          // Fire Alarm Certificate exists - Smoke Alarm Declaration is not required
          conditionalStatus = 'not_required';
          conditionalReason = 'Fire Alarm Certificate uploaded';
          alternativeType = 'Fire Alarm Certificate';
        }
      } else if (complianceType === 'Fire Alarm Certificate') {
        if (hasSmokeAlarmDecl && !hasFireAlarmCert) {
          // Smoke Alarm Declaration exists - Fire Alarm Certificate is optional
          conditionalStatus = 'optional';
          conditionalReason = 'Alternative to Smoke Alarm Declaration';
          alternativeType = 'Smoke Alarm Declaration';
        }
      }

      if (existingItem) {
        // Use actual item
        const { status, daysUntilExpiry } = calculateItemStatus(existingItem.expiry_date);
        
        // Override status if conditional logic applies (only for items without valid docs)
        const finalStatus = conditionalStatus && status === 'unknown' ? conditionalStatus : status;
        
        result.push({
          id: existingItem.id,
          property_id: existingItem.property_id,
          compliance_type: existingItem.compliance_type,
          issue_date: existingItem.issue_date,
          expiry_date: existingItem.expiry_date,
          status: finalStatus,
          daysUntilExpiry,
          isMissing: false,
          documents: existingItem.documents,
          conditionalReason,
          alternativeType,
        });
        // Remove from map so we don't double-count
        existingItemsMap.delete(key);
      } else {
        // Create missing placeholder
        // If conditional status applies, use it; otherwise use 'unknown'
        result.push({
          id: `missing-${property.id}-${complianceType.replace(/\s+/g, '-')}`,
          property_id: property.id,
          compliance_type: complianceType,
          issue_date: null,
          expiry_date: null,
          status: conditionalStatus || 'unknown',
          daysUntilExpiry: null,
          isMissing: true,
          documents: [],
          conditionalReason,
          alternativeType,
        });
      }
    });
  });

  // Add any remaining actual items that aren't in the required types
  // (e.g., "Other" compliance types manually added)
  existingItemsMap.forEach(item => {
    const { status, daysUntilExpiry } = calculateItemStatus(item.expiry_date);
    result.push({
      id: item.id,
      property_id: item.property_id,
      compliance_type: item.compliance_type,
      issue_date: item.issue_date,
      expiry_date: item.expiry_date,
      status,
      daysUntilExpiry,
      isMissing: false,
      documents: item.documents,
    });
  });

  return result;
}

/**
 * Calculate summary stats - excludes 'not_required' and 'optional' from expired count
 */
export function calculateComplianceStats(items: ComplianceItemWithMissing[]) {
  return items.reduce(
    (acc, item) => {
      // Don't count not_required or optional in totals
      if (item.status === 'not_required' || item.status === 'optional') {
        acc.notRequired++;
        return acc;
      }
      
      acc.total++;
      if (item.status === 'valid') acc.valid++;
      else if (item.status === 'expiring_soon') acc.expiring++;
      else if (item.status === 'expired' || item.status === 'unknown') {
        // Count both expired AND missing/unknown as "expired" (needing action)
        acc.expired++;
      }
      return acc;
    },
    { valid: 0, expiring: 0, expired: 0, total: 0, notRequired: 0 }
  );
}
