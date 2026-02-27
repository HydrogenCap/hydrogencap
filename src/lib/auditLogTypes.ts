export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
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
  compliance_requirements_v2: 'Compliance Requirement',
  contractors: 'Contractor',
  contractor_jobs: 'Contractor Job',
  financial_snapshots: 'Financial Snapshot',
  financial_categories: 'Financial Category',
  // Legacy tables (in case they appear)
  properties: 'Property (Legacy)',
  rooms: 'Room (Legacy)',
  tenants: 'Tenant',
  compliance_documents: 'Compliance Document (Legacy)',
  compliance_requirements: 'Compliance Requirement (Legacy)',
};

export const AUDITED_TABLES = Object.keys(TABLE_DISPLAY_NAMES);

export function getTableDisplayName(tableName: string): string {
  return TABLE_DISPLAY_NAMES[tableName] || tableName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getRecordIdentifier(tableName: string, values: Record<string, any> | null): string {
  if (!values) return '—';
  switch (tableName) {
    case 'properties_v2':
    case 'properties':
      return values.address_line_1 || values.address_line || values.id?.slice(0, 6) || '—';
    case 'tenants':
      return [values.first_name, values.last_name].filter(Boolean).join(' ') || values.company_name || values.id?.slice(0, 6) || '—';
    case 'legal_entities':
      return values.entity_name || values.id?.slice(0, 6) || '—';
    case 'rooms_v2':
    case 'rooms':
      return values.room_name || values.id?.slice(0, 6) || '—';
    case 'compliance_documents_v2':
    case 'compliance_documents':
      return values.document_type || values.id?.slice(0, 6) || '—';
    case 'loan_facilities':
      return values.facility_type || values.account_reference || values.id?.slice(0, 6) || '—';
    case 'tenancy_agreements':
      return values.start_date ? `Tenancy ${values.start_date}` : values.id?.slice(0, 6) || '—';
    case 'financial_snapshots':
      return values.snapshot_month || values.id?.slice(0, 6) || '—';
    case 'contractors':
      return values.name || values.company_name || values.id?.slice(0, 6) || '—';
    case 'contractor_jobs':
      return values.job_type || values.id?.slice(0, 6) || '—';
    case 'entity_directors':
      return values.director_name || values.id?.slice(0, 6) || '—';
    case 'entity_shareholders':
      return values.shareholder_name || values.id?.slice(0, 6) || '—';
    case 'lenders':
      return values.lender_name || values.id?.slice(0, 6) || '—';
    default:
      return values.id?.slice(0, 6) || '—';
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
    .map(word => overrides[word] || word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatAuditValue(field: string, value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);

  if (field.includes('amount') || field.includes('price') || field.includes('valuation') ||
      field.includes('balance') || field.includes('payment') || field.includes('cost') ||
      field.includes('fee') || field.includes('rent') || field.includes('income') ||
      field.includes('loss') || field.endsWith('_gbp')) {
    return `£${Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  }

  if (field.includes('rate') || field.includes('ltv') || field.includes('percentage') ||
      field.includes('occupancy') || field.includes('yield')) {
    return `${value}%`;
  }

  if (field.includes('date') && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    const d = new Date(value);
    return d.toLocaleDateString('en-GB');
  }

  return String(value);
}
