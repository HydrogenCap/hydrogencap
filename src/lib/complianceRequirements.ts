// Compliance Requirements Engine
// Determines which compliance items are required based on property features

import type { ComplianceItem, ComplianceStatus } from './complianceTypes';
import { getComplianceItemStatus } from './complianceTypes';

// Property features that drive compliance requirements
export interface PropertyComplianceFeatures {
  id: string;
  address_line: string;
  has_gas: boolean | null;
  has_fire_alarm_system: boolean | null;
  fire_alarm_grade: string | null;
  has_emergency_lighting: boolean | null;
  asset_category: string | null;
  occupancy_status: string | null;
  is_hmo_licensed: boolean | null;
  selective_licence_required: boolean | null;
  co_alarm_required: boolean | null;
  epc_required: boolean | null;
  listed_status: string | null;
}

// Requirement status
export type RequirementStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing' | 'not_required';

// Single compliance requirement
export interface ComplianceRequirement {
  type: string;           // Compliance type name
  category: string;       // Category: Safety, HMO, Insurance
  required: boolean;      // Whether this is required for this property
  reason: string;         // Why it's required or not
  status: RequirementStatus;
  existingItem: ComplianceItem | null;
  daysUntilExpiry: number | null;
  hasDocument: boolean;
}

// Property compliance summary
export interface PropertyComplianceSummary {
  propertyId: string;
  propertyAddress: string;
  requirements: ComplianceRequirement[];
  missingCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  validCount: number;
  notRequiredCount: number;
  totalRequired: number;
  complianceScore: number; // Percentage of valid items
}

// Define all compliance types with their rules
export const COMPLIANCE_REQUIREMENT_DEFINITIONS = {
  // Safety & Legal
  'Gas Safety Certificate (CP12)': {
    category: 'Safety & Legal',
    defaultRequired: true,
    validityYears: 1,
    condition: (p: PropertyComplianceFeatures) => p.has_gas !== false,
    reasonRequired: 'Gas supply present - annual Gas Safety Certificate required',
    reasonNotRequired: 'No gas supply at property',
  },
  'Electrical Safety Certificate (EICR)': {
    category: 'Safety & Legal',
    defaultRequired: true,
    validityYears: 5,
    condition: () => true, // Always required for rentals
    reasonRequired: 'Mandatory for all rental properties - 5 year validity',
    reasonNotRequired: 'Not applicable',
  },
  'EPC': {
    category: 'Safety & Legal',
    defaultRequired: true,
    validityYears: 10,
    condition: (p: PropertyComplianceFeatures) => p.epc_required !== false,
    reasonRequired: 'Mandatory for all rental properties',
    reasonNotRequired: 'Listed building - EPC exempt',
  },
  'Smoke Alarm Declaration': {
    category: 'Safety & Legal',
    defaultRequired: true,
    validityYears: null, // No expiry - must be in place
    condition: () => true,
    reasonRequired: 'Smoke alarms required on every floor (Smoke and CO Alarm Regs 2015)',
    reasonNotRequired: 'Not applicable',
  },
  'Carbon Monoxide Alarm Declaration': {
    category: 'Safety & Legal',
    defaultRequired: true,
    validityYears: null,
    condition: (p: PropertyComplianceFeatures) => p.co_alarm_required !== false,
    reasonRequired: 'CO alarms required in rooms with combustion appliances (gas, solid fuel)',
    reasonNotRequired: 'No combustion appliances at property',
  },
  'Fire Risk Assessment (FRA)': {
    category: 'Safety & Legal',
    defaultRequired: true,
    validityYears: 1,
    condition: (p: PropertyComplianceFeatures) => 
      p.asset_category?.includes('HMO') || p.has_fire_alarm_system === true,
    reasonRequired: 'Required for HMO properties or those with fire alarm systems',
    reasonNotRequired: 'Single let without integrated fire system',
  },
  'Legionella Risk Assessment': {
    category: 'Safety & Legal',
    defaultRequired: true,
    validityYears: 2,
    condition: () => true,
    reasonRequired: 'Recommended for all rental properties',
    reasonNotRequired: 'Not applicable',
  },
  'PAT Testing': {
    category: 'Safety & Legal',
    defaultRequired: false,
    validityYears: 1,
    condition: (p: PropertyComplianceFeatures) => p.asset_category?.includes('HMO') === true,
    reasonRequired: 'Required for HMO properties with electrical appliances',
    reasonNotRequired: 'Only required for furnished HMOs',
  },
  // HMO / Licensing
  'HMO Licence': {
    category: 'HMO & Licensing',
    defaultRequired: false,
    validityYears: 5,
    condition: (p: PropertyComplianceFeatures) => p.is_hmo_licensed === true,
    reasonRequired: 'Property requires HMO licence',
    reasonNotRequired: 'Not an HMO or HMO licence not required',
  },
  'Selective Licence': {
    category: 'HMO & Licensing',
    defaultRequired: false,
    validityYears: 5,
    condition: (p: PropertyComplianceFeatures) => p.selective_licence_required === true,
    reasonRequired: 'Property in selective licensing area',
    reasonNotRequired: 'Property not in selective licensing area',
  },
  'Fire Alarm Certificate': {
    category: 'HMO & Licensing',
    defaultRequired: false,
    validityYears: 1,
    condition: (p: PropertyComplianceFeatures) => 
      p.has_fire_alarm_system === true || 
      p.fire_alarm_grade === 'Grade A' ||
      p.fire_alarm_grade === 'Grade D1',
    reasonRequired: 'Property has integrated fire alarm system',
    reasonNotRequired: 'No integrated fire alarm system',
  },
  'Emergency Lighting Certificate': {
    category: 'HMO & Licensing',
    defaultRequired: false,
    validityYears: 1,
    condition: (p: PropertyComplianceFeatures) => p.has_emergency_lighting === true,
    reasonRequired: 'Property has emergency lighting system',
    reasonNotRequired: 'No emergency lighting system',
  },
  'Fire Suppression System Certificate': {
    category: 'HMO & Licensing',
    defaultRequired: false,
    validityYears: 1,
    condition: () => false, // Manually added per property - condition for listed HMOs
    reasonRequired: 'Fire suppression system installed (HMO licence condition)',
    reasonNotRequired: 'No fire suppression system',
  },
  // Insurance
  'Buildings Insurance Schedule': {
    category: 'Insurance',
    defaultRequired: true,
    validityYears: 1,
    condition: () => true,
    reasonRequired: 'Buildings insurance mandatory for all properties',
    reasonNotRequired: 'Not applicable',
  },
} as const;

export type ComplianceTypeName = keyof typeof COMPLIANCE_REQUIREMENT_DEFINITIONS;

// Calculate days until expiry
function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Determine requirement status
function getRequirementStatus(
  required: boolean,
  existingItem: ComplianceItem | null,
  hasDocument: boolean
): RequirementStatus {
  if (!required) return 'not_required';
  
  if (!existingItem) return 'missing';
  
  if (!hasDocument && !existingItem.expiry_date) return 'missing';
  
  const itemStatus = getComplianceItemStatus(existingItem.expiry_date);
  
  if (itemStatus === 'expired') return 'expired';
  if (itemStatus === 'expiring_soon') return 'expiring_soon';
  if (itemStatus === 'valid') return 'valid';
  
  // If status is unknown (no expiry date), check if document exists
  return hasDocument ? 'valid' : 'missing';
}

// Main function: Calculate compliance requirements for a property
export function calculateComplianceRequirements(
  property: PropertyComplianceFeatures,
  existingItems: (ComplianceItem & { documents?: { id: string; is_current: boolean }[] })[]
): PropertyComplianceSummary {
  const requirements: ComplianceRequirement[] = [];
  
  let missingCount = 0;
  let expiredCount = 0;
  let expiringSoonCount = 0;
  let validCount = 0;
  let notRequiredCount = 0;
  
  // Create a map of existing items by type
  const itemsByType = new Map<string, ComplianceItem & { documents?: { id: string; is_current: boolean }[] }>();
  existingItems.forEach(item => {
    itemsByType.set(item.compliance_type, item);
  });
  
  // Process each compliance type
  for (const [typeName, definition] of Object.entries(COMPLIANCE_REQUIREMENT_DEFINITIONS)) {
    const required = definition.condition(property);
    const existingItem = itemsByType.get(typeName) || null;
    const hasDocument = existingItem?.documents?.some(d => d.is_current) || false;
    
    const status = getRequirementStatus(required, existingItem, hasDocument);
    const daysUntilExpiry = existingItem ? getDaysUntilExpiry(existingItem.expiry_date) : null;
    
    requirements.push({
      type: typeName,
      category: definition.category,
      required,
      reason: required ? definition.reasonRequired : definition.reasonNotRequired,
      status,
      existingItem,
      daysUntilExpiry,
      hasDocument,
    });
    
    // Count by status
    switch (status) {
      case 'missing': missingCount++; break;
      case 'expired': expiredCount++; break;
      case 'expiring_soon': expiringSoonCount++; break;
      case 'valid': validCount++; break;
      case 'not_required': notRequiredCount++; break;
    }
  }
  
  const totalRequired = requirements.filter(r => r.required).length;
  const complianceScore = totalRequired > 0 
    ? Math.round((validCount / totalRequired) * 100) 
    : 100;
  
  return {
    propertyId: property.id,
    propertyAddress: property.address_line,
    requirements,
    missingCount,
    expiredCount,
    expiringSoonCount,
    validCount,
    notRequiredCount,
    totalRequired,
    complianceScore,
  };
}

// Get status color for traffic light display
export function getRequirementStatusColor(status: RequirementStatus): string {
  switch (status) {
    case 'missing':
    case 'expired':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'expiring_soon':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'valid':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'not_required':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// Get status label
export function getRequirementStatusLabel(status: RequirementStatus, daysUntilExpiry: number | null): string {
  switch (status) {
    case 'missing':
      return 'Missing';
    case 'expired':
      return daysUntilExpiry !== null ? `Expired ${Math.abs(daysUntilExpiry)} days ago` : 'Expired';
    case 'expiring_soon':
      return daysUntilExpiry !== null 
        ? daysUntilExpiry === 0 ? 'Expires today' : `Expires in ${daysUntilExpiry} days`
        : 'Expiring Soon';
    case 'valid':
      return daysUntilExpiry !== null ? `Valid (${daysUntilExpiry} days)` : 'Valid';
    case 'not_required':
      return 'Not Required';
    default:
      return 'Unknown';
  }
}

// Get status icon indicator
export function getRequirementStatusIndicator(status: RequirementStatus): '🔴' | '🟠' | '🟢' | '⚪' {
  switch (status) {
    case 'missing':
    case 'expired':
      return '🔴';
    case 'expiring_soon':
      return '🟠';
    case 'valid':
      return '🟢';
    case 'not_required':
      return '⚪';
    default:
      return '⚪';
  }
}

// Group requirements by category
export function groupRequirementsByCategory(requirements: ComplianceRequirement[]): Record<string, ComplianceRequirement[]> {
  const grouped: Record<string, ComplianceRequirement[]> = {};
  
  requirements.forEach(req => {
    if (!grouped[req.category]) {
      grouped[req.category] = [];
    }
    grouped[req.category].push(req);
  });
  
  return grouped;
}

// Filter for only issues (missing, expired, expiring soon)
export function getComplianceIssues(requirements: ComplianceRequirement[]): ComplianceRequirement[] {
  return requirements.filter(r => 
    r.status === 'missing' || r.status === 'expired' || r.status === 'expiring_soon'
  );
}
