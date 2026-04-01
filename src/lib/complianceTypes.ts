// Compliance types and constants
import { SEVERITY } from '@/lib/design-tokens';

export const COMPLIANCE_TYPES = [
  'Gas Safety Certificate (CP12)',
  'Electrical Safety Certificate (EICR)',
  'Fire Alarm Certificate',
  'Emergency Lighting Certificate',
  'Fire Risk Assessment (FRA)',
  'Fire Suppression System Certificate',
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
  'MCS Certificate',
  'Other',
] as const;

export type ComplianceType = typeof COMPLIANCE_TYPES[number];

export type ComplianceStatus = 'valid' | 'expiring_soon' | 'expired' | 'unknown' | 'not_required' | 'optional';

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
  is_required?: boolean;
  is_manually_excluded?: boolean;
  exclusion_reason?: string | null;
  is_coho_required?: boolean;
  reminder_days: number[];
  reminder_count?: number;
  last_reminder_sent_at?: string | null;
  responsible_party: string;
  notes: string | null;
  renewal_status?: string | null;
  renewal_contractor_id?: string | null;
  renewal_booked_date?: string | null;
  renewal_notes?: string | null;
  auto_job_created?: boolean;
  auto_job_id?: string | null;
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
      return SEVERITY.critical.badge;
    case 'expiring_soon':
      return SEVERITY.warning.badge;
    case 'valid':
      return SEVERITY.success.badge;
    case 'not_required':
    case 'optional':
      return SEVERITY.info.badge;
    case 'unknown':
    default:
      return SEVERITY.neutral.badge;
  }
}
