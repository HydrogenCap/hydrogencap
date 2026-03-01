export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'notices' | 'agreements' | 'inventories' | 'compliance' | 'lettings';
  requiredData: string[];
  legalWarning?: string;
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'section_21_notice',
    name: 'Section 21 Notice (Form 6A)',
    description: "No-fault eviction notice — requires 2 months' notice, valid Gas Cert, EPC, and How to Rent guide served",
    category: 'notices',
    requiredData: ['tenancy', 'property', 'tenant', 'compliance'],
    legalWarning: 'This generates a template only. Seek legal advice before serving any notice.',
  },
  {
    id: 'section_8_notice',
    name: 'Section 8 Notice (Form 3)',
    description: 'Eviction notice on specific grounds — select applicable grounds',
    category: 'notices',
    requiredData: ['tenancy', 'property', 'tenant'],
    legalWarning: 'This generates a template only. Seek legal advice before serving any notice.',
  },
  {
    id: 'section_13_rent_increase',
    name: 'Section 13 Rent Increase Notice',
    description: 'Formal rent increase for periodic tenancies — requires 1 month notice for monthly tenancies',
    category: 'notices',
    requiredData: ['tenancy', 'property', 'tenant'],
  },
  {
    id: 'guarantor_agreement',
    name: 'Guarantor Agreement',
    description: 'Standard guarantor form for a named tenant',
    category: 'agreements',
    requiredData: ['tenancy', 'property', 'tenant'],
  },
  {
    id: 'inventory_template',
    name: 'Inventory & Schedule of Condition',
    description: 'Room-by-room inventory template with condition notes',
    category: 'inventories',
    requiredData: ['property', 'rooms'],
  },
  {
    id: 'how_to_rent_cover',
    name: 'How to Rent — Cover Letter & Proof of Service',
    description: 'Cover letter confirming the How to Rent guide was provided to the tenant',
    category: 'compliance',
    requiredData: ['tenancy', 'property', 'tenant'],
  },
  {
    id: 'tenant_reference_request',
    name: 'Landlord Reference Request',
    description: "Request a reference from a prospective tenant's previous landlord",
    category: 'lettings',
    requiredData: ['property'],
  },
];

export const TEMPLATE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'notices', label: 'Notices' },
  { value: 'agreements', label: 'Agreements' },
  { value: 'inventories', label: 'Inventories' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'lettings', label: 'Lettings' },
];

export const SECTION_8_GROUNDS = [
  { value: '8', label: 'Ground 8 — At least 2 months\' rent arrears (mandatory)' },
  { value: '10', label: 'Ground 10 — Some rent unpaid (discretionary)' },
  { value: '11', label: 'Ground 11 — Persistent delay in paying rent (discretionary)' },
  { value: '12', label: 'Ground 12 — Breach of tenancy obligation (discretionary)' },
  { value: '13', label: 'Ground 13 — Waste or neglect of property (discretionary)' },
  { value: '14', label: 'Ground 14 — Nuisance or annoyance (discretionary)' },
  { value: '14A', label: 'Ground 14A — Domestic violence (discretionary)' },
  { value: '17', label: 'Ground 17 — False statement by tenant (discretionary)' },
];
