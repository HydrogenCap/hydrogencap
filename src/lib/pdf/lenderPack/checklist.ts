/**
 * Single source of truth for the lender-pack document checklist.
 *
 * Both the in-app dialog (showing what's missing before generation) and
 * the PDF "Document Checklist" page render from this helper, so they
 * can never disagree.
 */
import { getComplianceStatus } from '../status';
import type { PropertyReportData } from '../types';

export type LenderPackChecklistStatus =
  | 'uploaded'
  | 'missing'
  | 'expired'
  | 'expiring_soon'
  | 'na';

export interface VaultDocRef {
  property_id: string | null;
  category: string | null;
  file_url: string | null;
  original_file_name: string | null;
  expiry_date?: string | null;
}

export interface LenderPackChecklistItem {
  key: string;
  label: string;
  required: boolean;
  status: LenderPackChecklistStatus;
  expiry?: string | null;
  /** Vault link(s) we can reuse instead of re-uploading. */
  vaultLinks: Array<{ fileUrl: string; fileName: string }>;
}

const COMPLIANCE_ROWS: Array<{
  key: string;
  label: string;
  complianceType: string;
  required: (p: PropertyReportData) => boolean;
}> = [
  { key: 'epc', label: 'EPC Certificate', complianceType: 'epc', required: () => true },
  { key: 'eicr', label: 'EICR (Electrical Safety)', complianceType: 'eicr', required: () => true },
  { key: 'gas_safety', label: 'Gas Safety Certificate', complianceType: 'gas_safety', required: () => true },
  { key: 'hmo_licence', label: 'HMO Licence', complianceType: 'hmo_licence', required: (p) => !!p.is_hmo_licensed },
  { key: 'fire_alarm', label: 'Fire Alarm / Detection Certificate', complianceType: 'fire_alarm', required: (p) => !!p.is_hmo_licensed },
];

const VAULT_ROWS: Array<{
  key: string;
  label: string;
  categories: string[];
  required: (p: PropertyReportData) => boolean;
}> = [
  { key: 'tenancy', label: 'AST / Tenancy Agreement', categories: ['tenancy'], required: (p) => p.lifecycle_type === 'core_rental' },
  { key: 'title', label: 'Title Register / Legal Pack', categories: ['legal-pack'], required: () => true },
  { key: 'accounts', label: 'Company Accounts / SPV Confirmation', categories: ['company-formation'], required: () => true },
  { key: 'bank_statements', label: 'Bank Statements (rental income)', categories: ['bank-statements', 'statements'], required: (p) => p.lifecycle_type === 'core_rental' },
];

function statusFromCompliance(item: PropertyReportData['complianceItems'][number] | undefined, required: boolean): LenderPackChecklistStatus {
  if (!item) return required ? 'missing' : 'na';
  const s = getComplianceStatus(item);
  if (s === 'valid') return 'uploaded';
  if (s === 'expired') return 'expired';
  if (s === 'expiring_soon') return 'expiring_soon';
  return required ? 'missing' : 'na';
}

export function computePropertyChecklist(
  prop: PropertyReportData,
  vaultDocs: VaultDocRef[] = [],
): LenderPackChecklistItem[] {
  const items: LenderPackChecklistItem[] = [];

  // Compliance certs (from compliance_documents — already in the vault)
  for (const row of COMPLIANCE_ROWS) {
    const required = row.required(prop);
    const compItem = prop.complianceItems.find(c => c.compliance_type === row.complianceType);
    const status = statusFromCompliance(compItem, required);
    const vaultLinks = (compItem?.documents ?? [])
      .filter(d => d?.file_url)
      .map(d => ({ fileUrl: d!.file_url as string, fileName: d!.original_file_name || `${row.key}.pdf` }));
    items.push({
      key: row.key,
      label: row.label,
      required,
      status,
      expiry: compItem?.expiry_date ?? null,
      vaultLinks,
    });
  }

  // Rental income / tenancy schedule — derived from income, no doc by default
  items.push({
    key: 'rent_schedule',
    label: 'Rent Schedule',
    required: prop.lifecycle_type === 'core_rental',
    status: (prop.income?.some(i => i.annual_rent_gbp > 0) ?? false) ? 'uploaded' : (prop.lifecycle_type === 'core_rental' ? 'missing' : 'na'),
    vaultLinks: [],
  });

  // Tenancy ledger — surfaced from rent_payments if present (we only check existence flag)
  items.push({
    key: 'tenancy_ledger',
    label: 'Tenancy Ledger',
    required: prop.lifecycle_type === 'core_rental',
    status: (prop.income?.some(i => i.annual_rent_gbp > 0) ?? false) ? 'uploaded' : (prop.lifecycle_type === 'core_rental' ? 'missing' : 'na'),
    vaultLinks: [],
  });

  // Insurance schedule (insurance policy record + any vault docs in 'insurance')
  const insuranceDocs = vaultDocs.filter(d => d.property_id === prop.id && (d.category === 'insurance'));
  items.push({
    key: 'insurance',
    label: 'Buildings Insurance Schedule',
    required: true,
    status: prop.insurancePolicy || insuranceDocs.length > 0 ? 'uploaded' : 'missing',
    expiry: prop.insurancePolicy?.renewal_date ?? null,
    vaultLinks: insuranceDocs
      .filter(d => d.file_url)
      .map(d => ({ fileUrl: d.file_url!, fileName: d.original_file_name || 'insurance.pdf' })),
  });

  // Ownership structure — present whenever the property has a legal owner company
  items.push({
    key: 'ownership',
    label: 'Ownership Structure',
    required: true,
    status: prop.legal_owner_company_id ? 'uploaded' : 'missing',
    vaultLinks: [],
  });

  // Generic vault-backed documents (title, accounts, bank statements, AST)
  for (const row of VAULT_ROWS) {
    const matches = vaultDocs.filter(
      d => d.property_id === prop.id && row.categories.includes(d.category ?? ''),
    );
    const required = row.required(prop);
    items.push({
      key: row.key,
      label: row.label,
      required,
      status: matches.length > 0 ? 'uploaded' : (required ? 'missing' : 'na'),
      vaultLinks: matches
        .filter(d => d.file_url)
        .map(d => ({ fileUrl: d.file_url!, fileName: d.original_file_name || `${row.key}.pdf` })),
    });
  }

  return items;
}

export function countMissing(items: LenderPackChecklistItem[]): number {
  return items.filter(i => i.required && (i.status === 'missing' || i.status === 'expired')).length;
}
