/**
 * Portfolio Backup Configuration
 *
 * Defines which tables to export, in what order, and which storage
 * buckets contain uploaded files.
 *
 * Numbering scheme controls import order (parents before children):
 *   00–13  Top-level entities (no FK deps)
 *   20–33  Property children (depend on properties/companies/contractors)
 *   34–44  Cross-entity links (depend on multiple parents)
 *   50–59  Deepest children (depend on tenancies, jobs, etc.)
 *   60–61  Historical / audit (import last, optional)
 */

export interface TableExportConfig {
  /** Table name in Supabase */
  table: string;
  /** Filename prefix in ZIP (controls import order) */
  prefix: string;
  /** Display name for progress UI */
  label: string;
  /** Whether to include in essential-only backup */
  essential: boolean;
  /** Column that holds a storage file URL (if any) */
  fileUrlColumn?: string;
  /** Storage bucket the files live in */
  storageBucket?: string;
}

export const BACKUP_TABLES: TableExportConfig[] = [
  // ═══ Level 0: Organisation ═══
  { table: 'organizations', prefix: '00', label: 'Organisations', essential: true },

  // ═══ Level 1: Top-level entities (no parent FK) ═══
  { table: 'companies', prefix: '01', label: 'Companies', essential: true },
  { table: 'properties', prefix: '02', label: 'Properties', essential: true },
  { table: 'contractors', prefix: '03', label: 'Contractors', essential: true },
  { table: 'tenants', prefix: '04', label: 'Tenants', essential: true },
  { table: 'parties', prefix: '05', label: 'Parties', essential: true },
  { table: 'beneficial_groups', prefix: '06', label: 'Beneficial Groups', essential: false },
  { table: 'ownership_groups', prefix: '07', label: 'Ownership Groups', essential: false },
  { table: 'ownership_entities', prefix: '08', label: 'Ownership Entities', essential: false },
  { table: 'local_authorities', prefix: '09', label: 'Local Authorities', essential: false },
  { table: 'management_companies', prefix: '10', label: 'Management Companies', essential: false },
  { table: 'certificate_type_mappings', prefix: '11', label: 'Certificate Type Mappings', essential: false },
  { table: 'document_categories', prefix: '12', label: 'Document Categories', essential: false },
  { table: 'job_request_templates', prefix: '13', label: 'Job Request Templates', essential: false },

  // ═══ Level 2: Property children ═══
  { table: 'loans', prefix: '20', label: 'Loans / Mortgages', essential: true },
  { table: 'income', prefix: '21', label: 'Income', essential: true },
  { table: 'costs', prefix: '22', label: 'Costs', essential: true },
  { table: 'rooms', prefix: '23', label: 'Rooms', essential: true },
  { table: 'property_passport', prefix: '24', label: 'Property Passports', essential: true },
  { table: 'property_title_numbers', prefix: '25', label: 'Title Numbers', essential: false },
  { table: 'property_valuations', prefix: '26', label: 'Valuations', essential: false },
  { table: 'property_ownership', prefix: '27', label: 'Property Ownership', essential: true },
  { table: 'compliance_items', prefix: '28', label: 'Compliance Items', essential: true },
  {
    table: 'photos', prefix: '29', label: 'Photos',
    essential: false, fileUrlColumn: 'file_url', storageBucket: 'photos',
  },
  {
    table: 'floorplans', prefix: '30', label: 'Floorplans',
    essential: false, fileUrlColumn: 'file_url', storageBucket: 'floorplans',
  },
  { table: 'go_live_checklists', prefix: '31', label: 'Go-Live Checklists', essential: false },
  { table: 'insurance_policies', prefix: '32', label: 'Insurance Policies', essential: true },
  { table: 'comparable_sales', prefix: '33', label: 'Comparable Sales', essential: false },

  // ═══ Level 3: Cross-entity links ═══
  {
    table: 'compliance_documents', prefix: '34', label: 'Compliance Certificates',
    essential: true, fileUrlColumn: 'file_url', storageBucket: 'compliance',
  },
  { table: 'contractor_jobs', prefix: '35', label: 'Contractor Jobs', essential: true },
  { table: 'tenancies', prefix: '36', label: 'Tenancies', essential: true },
  {
    table: 'documents', prefix: '37', label: 'Documents',
    essential: true, fileUrlColumn: 'file_url', storageBucket: 'documents',
  },
  { table: 'maintenance_requests', prefix: '38', label: 'Maintenance Requests', essential: false },
  { table: 'ownership_links', prefix: '39', label: 'Ownership Links', essential: false },
  { table: 'entity_shareholdings', prefix: '40', label: 'Entity Shareholdings', essential: false },
  { table: 'entity_beneficial_mapping', prefix: '41', label: 'Entity Beneficial Mapping', essential: false },
  { table: 'shareholdings', prefix: '42', label: 'Shareholdings', essential: false },
  { table: 'share_classes', prefix: '43', label: 'Share Classes', essential: false },
  { table: 'group_members', prefix: '44', label: 'Group Members', essential: false },

  // ═══ Level 4: Deepest children ═══
  { table: 'rent_schedule', prefix: '50', label: 'Rent Schedule', essential: true },
  { table: 'rent_payments', prefix: '51', label: 'Rent Payments', essential: true },
  { table: 'tenancy_compliance_items', prefix: '52', label: 'Tenancy Compliance', essential: false },
  { table: 'job_notes', prefix: '53', label: 'Job Notes', essential: false },
  { table: 'job_follow_ups', prefix: '54', label: 'Job Follow-Ups', essential: false },
  { table: 'contractor_reviews', prefix: '55', label: 'Contractor Reviews', essential: false },
  { table: 'contractor_service_areas', prefix: '56', label: 'Contractor Service Areas', essential: false },
  { table: 'maintenance_updates', prefix: '57', label: 'Maintenance Updates', essential: false },
  { table: 'document_share_links', prefix: '58', label: 'Document Share Links', essential: false },
  { table: 'notification_preferences', prefix: '59', label: 'Notification Preferences', essential: false },

  // ═══ Level 5: Historical / Audit ═══
  { table: 'inbound_emails', prefix: '60', label: 'Inbound Emails', essential: false },
  { table: 'activity_log', prefix: '61', label: 'Activity Log', essential: false },
];

/**
 * Tables deliberately excluded from backup (derived, transient, or recreated automatically):
 *
 * - profiles              → recreated on sign-up
 * - memberships           → recreated when user joins org
 * - shareholder_access    → recreated via invites
 * - shareholder_invites   → transient invites
 * - demo_requests         → marketing, not portfolio data
 * - company_metric_snapshots → derived, regenerated
 * - passport_autofill_suggestions → AI-generated, transient
 * - passport_field_audit  → audit trail, regenerated
 * - dismissed_duplicates  → UI state
 * - payment_reminders     → auto-generated
 * - scheduled_email_runs  → transient scheduler state
 * - scheduled_notifications → transient
 * - valuation_alerts      → derived
 * - refinancing_opportunities → derived view
 * - document_activity     → audit trail, regenerated
 * - company_secrets       → sensitive, excluded for security
 * - notification_log      → transient delivery log
 */

export const STORAGE_BUCKETS = ['compliance', 'documents', 'photos', 'floorplans'] as const;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
