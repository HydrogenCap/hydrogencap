type AuditRecordValues = Record<string, unknown>;

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: AuditRecordValues | null;
  new_values: AuditRecordValues | null;
  changed_fields: string[] | null;
  changed_by: string | null;
  changed_at: string;
  ip_address: string | null;
  session_id: string | null;
  context: string | null;
}

export interface AuditLogFilters {
  dateFrom?: string;
  dateTo?: string;
  tableName?: string;
  action?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export const TABLE_DISPLAY_NAMES: Record<string, string> = {
  legal_entities: 'Legal Entity',
  entity_directors: 'Director',
  entity_shareholders: 'Shareholder',
  properties_v2: 'Property',
  rooms_v2: 'Room',
  tenancy_agreements: 'Tenancy Agreement',
  lenders: 'Lender',
  loan_facilities: 'Loan Facility',
  compliance_documents_v2: 'Compliance Document',
  compliance_requirements: 'Compliance Requirement',
  contractors: 'Contractor',
  contractor_jobs: 'Contractor Job',
  financial_snapshots: 'Financial Snapshot',
  financial_categories: 'Financial Category',
  properties: 'Property (Legacy)',
  rooms: 'Room (Legacy)',
  tenants: 'Tenant',
  compliance_documents: 'Compliance Document (Legacy)',
};

export const AUDITED_TABLES = Object.keys(TABLE_DISPLAY_NAMES);

export function getTableDisplayName(tableName: string): string {
  return TABLE_DISPLAY_NAMES[tableName] || tableName.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStringValue(values: AuditRecordValues, key: string): string | undefined {
  const value = values[key];
  return typeof value === 'string' ? value : undefined;
}

function getIdPreview(values: AuditRecordValues): string | undefined {
  return getStringValue(values, 'id')?.slice(0, 6);
}

export function getRecordIdentifier(tableName: string, values: AuditRecordValues | null): string {
  if (!values) return '-';

  switch (tableName) {
    case 'properties_v2':
    case 'properties':
      return getStringValue(values, 'address_line_1') || getStringValue(values, 'address_line') || getIdPreview(values) || '-';
    case 'tenants':
      return [getStringValue(values, 'first_name'), getStringValue(values, 'last_name')].filter(Boolean).join(' ')
        || getStringValue(values, 'company_name')
        || getIdPreview(values)
        || '-';
    case 'legal_entities':
      return getStringValue(values, 'entity_name') || getIdPreview(values) || '-';
    case 'rooms_v2':
    case 'rooms':
      return getStringValue(values, 'room_name') || getIdPreview(values) || '-';
    case 'compliance_documents_v2':
    case 'compliance_documents':
      return getStringValue(values, 'document_type') || getIdPreview(values) || '-';
    case 'loan_facilities':
      return getStringValue(values, 'facility_type') || getStringValue(values, 'account_reference') || getIdPreview(values) || '-';
    case 'tenancy_agreements': {
      const startDate = getStringValue(values, 'start_date');
      return startDate ? `Tenancy ${startDate}` : getIdPreview(values) || '-';
    }
    case 'financial_snapshots':
      return getStringValue(values, 'snapshot_month') || getIdPreview(values) || '-';
    case 'contractors':
      return getStringValue(values, 'name') || getStringValue(values, 'company_name') || getIdPreview(values) || '-';
    case 'contractor_jobs':
      return getStringValue(values, 'job_type') || getIdPreview(values) || '-';
    case 'entity_directors':
      return getStringValue(values, 'director_name') || getIdPreview(values) || '-';
    case 'entity_shareholders':
      return getStringValue(values, 'shareholder_name') || getIdPreview(values) || '-';
    case 'lenders':
      return getStringValue(values, 'lender_name') || getIdPreview(values) || '-';
    default:
      return getIdPreview(values) || '-';
  }
}

export function humanizeFieldName(field: string): string {
  const overrides: Record<string, string> = {
    pcm: 'PCM', ltv: 'LTV', erc: 'ERC', icr: 'ICR', noi: 'NOI',
    spv: 'SPV', hmo: 'HMO', epc: 'EPC', eicr: 'EICR', vat: 'VAT',
    id: 'ID', uuid: 'UUID', url: 'URL', ip: 'IP', gbp: 'GBP',
  };

  return field
    .split('_')
    .map((word) => overrides[word] || word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);

  if (field.includes('amount') || field.includes('price') || field.includes('valuation')
      || field.includes('balance') || field.includes('payment') || field.includes('cost')
      || field.includes('fee') || field.includes('rent') || field.includes('income')
      || field.includes('loss') || field.endsWith('_gbp')) {
    return `GBP ${Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  }

  if (field.includes('rate') || field.includes('ltv') || field.includes('percentage')
      || field.includes('occupancy') || field.includes('yield')) {
    return `${value}%`;
  }

  if (field.includes('date') && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(value).toLocaleDateString('en-GB');
  }

  return String(value);
}
