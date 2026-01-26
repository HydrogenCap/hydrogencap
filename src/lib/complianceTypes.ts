// Compliance types and constants

export const COMPLIANCE_TYPES = [
  'Gas Safety Certificate (CP12)',
  'Electrical Safety Certificate (EICR)',
  'Fire Alarm Certificate',
  'Emergency Lighting Certificate',
  'Fire Risk Assessment (FRA)',
  'PAT Testing',
  'Legionella Risk Assessment',
  'EPC',
  'HMO Licence',
  'Asbestos Survey',
  'Building Control Certificate',
  'Fire Door Certification',
  'Fire Panel Commissioning Certificate',
  'Insurance Schedule',
  'Floor Plans / Fire Plans',
  'Other',
] as const;

export type ComplianceType = typeof COMPLIANCE_TYPES[number];

export type ComplianceStatus = 'valid' | 'expiring_soon' | 'expired' | 'unknown';

export type ResponsibleParty = 'Agent' | 'Contractor' | 'Owner';

export const RESPONSIBLE_PARTIES: ResponsibleParty[] = ['Agent', 'Contractor', 'Owner'];

export const DEFAULT_REMINDER_DAYS = [90, 60, 30, 0];

// Status thresholds in days
export const STATUS_THRESHOLDS = {
  EXPIRING_SOON: 60, // Amber if expiring within 60 days
};

export interface ComplianceItem {
  id: string;
  property_id: string;
  org_id: string;
  compliance_type: string;
  issue_date: string | null;
  expiry_date: string | null;
  reminder_days: number[];
  responsible_party: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  documents?: ComplianceDocument[];
}

export interface ComplianceDocument {
  id: string;
  compliance_item_id: string;
  file_url: string;
  original_file_name: string;
  file_type: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  is_current: boolean;
  version_number: number;
  archived_at: string | null;
  notes: string | null;
}

/**
 * Calculate compliance status based on expiry date
 */
export function getComplianceItemStatus(expiryDate: string | null | undefined): ComplianceStatus {
  if (!expiryDate) return 'unknown';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= STATUS_THRESHOLDS.EXPIRING_SOON) return 'expiring_soon';
  return 'valid';
}

/**
 * Get status label for display
 */
export function getComplianceStatusLabel(status: ComplianceStatus, expiryDate: string | null): string {
  if (!expiryDate || status === 'unknown') return 'No expiry set';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  switch (status) {
    case 'expired':
      return `Expired ${Math.abs(daysUntilExpiry)} days ago`;
    case 'expiring_soon':
      return daysUntilExpiry === 0 ? 'Expires today' : `Expires in ${daysUntilExpiry} days`;
    case 'valid':
      return `Valid for ${daysUntilExpiry} days`;
    default:
      return 'Unknown';
  }
}

/**
 * Get CSS classes for status badge
 */
export function getComplianceStatusColor(status: ComplianceStatus): string {
  switch (status) {
    case 'expired':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'expiring_soon':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'valid':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'unknown':
    default:
      return 'bg-muted text-muted-foreground';
  }
}
