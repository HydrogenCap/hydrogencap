// ============================================================
// Tenancy Compliance Checklist — UK landlord legal requirements
// ============================================================

import type { ComplianceDocType } from '@/lib/complianceV2Types';

// ─── Types ───────────────────────────────────────────────────

export type ChecklistCategory = 'safety' | 'legal' | 'financial' | 'documentation';

export type ChecklistDeadline =
  | 'before_move_in'
  | 'within_28_days'
  | 'within_30_days'
  | 'annually'
  | 'every_5_years';

export type ChecklistRequired = 'always' | 'hmo_only' | 'selective_only';

export type ChecklistItemStatus = 'done' | 'pending' | 'overdue';

export interface ChecklistItemDefinition {
  id: string;
  title: string;
  description: string;
  legal_reference: string;
  required: ChecklistRequired;
  deadline: ChecklistDeadline;
  category: ChecklistCategory;
  /** Maps to a compliance doc type for auto-checking, if applicable */
  linked_doc_type?: ComplianceDocType;
  /** Maps to a tenancy agreement field for auto-checking */
  linked_tenancy_field?: string;
}

export interface ChecklistItem extends ChecklistItemDefinition {
  status: ChecklistItemStatus;
  completed_date: string | null;
  completed_by: string | null;
  notes: string | null;
  document_url: string | null;
  due_date: string | null;
  /** Whether this item was auto-checked from existing data */
  auto_verified: boolean;
}

export interface ChecklistSummary {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
}

// ─── Checklist Item Definitions ──────────────────────────────

export const CHECKLIST_ITEMS: ChecklistItemDefinition[] = [
  {
    id: 'gas_safety',
    title: 'Gas Safety Certificate (CP12)',
    description: 'Provide a copy of the Gas Safety Certificate to the tenant before move-in. Must be renewed annually.',
    legal_reference: 'Gas Safety (Installation and Use) Regulations 1998, Reg 36',
    required: 'always',
    deadline: 'annually',
    category: 'safety',
    linked_doc_type: 'gas_safety_certificate',
  },
  {
    id: 'eicr',
    title: 'EICR (Electrical Installation Condition Report)',
    description: 'Obtain an EICR every 5 years. Provide a copy to the tenant within 28 days of the inspection.',
    legal_reference: 'Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020',
    required: 'always',
    deadline: 'every_5_years',
    category: 'safety',
    linked_doc_type: 'eicr',
  },
  {
    id: 'epc',
    title: 'Energy Performance Certificate (EPC)',
    description: 'Provide a valid EPC (minimum rating E, changing to C) before the tenancy starts.',
    legal_reference: 'Energy Performance of Buildings (England and Wales) Regulations 2012; MEES Regulations 2015',
    required: 'always',
    deadline: 'before_move_in',
    category: 'documentation',
    linked_doc_type: 'epc',
  },
  {
    id: 'how_to_rent',
    title: 'How to Rent Guide',
    description: 'Provide the current version of the "How to Rent" guide at the start of the tenancy.',
    legal_reference: 'Deregulation Act 2015, s33 (prescribed requirement for s21 notice)',
    required: 'always',
    deadline: 'before_move_in',
    category: 'legal',
    linked_tenancy_field: 'how_to_rent_served_date',
  },
  {
    id: 'deposit_protection',
    title: 'Deposit Protection',
    description: 'Protect the tenancy deposit in a government-approved scheme within 30 days of receipt.',
    legal_reference: 'Housing Act 2004, ss 212-215',
    required: 'always',
    deadline: 'within_30_days',
    category: 'financial',
    linked_tenancy_field: 'deposit_protected_date',
  },
  {
    id: 'deposit_prescribed_info',
    title: 'Deposit Prescribed Information',
    description: 'Serve the prescribed information about the deposit to the tenant within 30 days.',
    legal_reference: 'Housing (Tenancy Deposits) (Prescribed Information) Order 2007',
    required: 'always',
    deadline: 'within_30_days',
    category: 'financial',
    linked_tenancy_field: 'prescribed_info_served_date',
  },
  {
    id: 'smoke_alarms',
    title: 'Smoke Alarms',
    description: 'Install smoke alarms on every storey. Test at the start of each tenancy.',
    legal_reference: 'Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022',
    required: 'always',
    deadline: 'before_move_in',
    category: 'safety',
    linked_doc_type: 'smoke_co_alarm_cert',
  },
  {
    id: 'co_alarms',
    title: 'Carbon Monoxide Alarms',
    description: 'Install CO alarms in rooms with fuel-burning appliances (since Oct 2022: any fuel-burning appliance, not just solid fuel).',
    legal_reference: 'Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022',
    required: 'always',
    deadline: 'before_move_in',
    category: 'safety',
    linked_doc_type: 'smoke_co_alarm_cert',
  },
  {
    id: 'right_to_rent',
    title: 'Right to Rent Check',
    description: 'Verify the immigration status of all adult occupiers before the tenancy begins.',
    legal_reference: 'Immigration Act 2014, ss 20-37',
    required: 'always',
    deadline: 'before_move_in',
    category: 'legal',
  },
  {
    id: 'legionella_risk',
    title: 'Legionella Risk Assessment',
    description: 'Carry out a Legionella risk assessment. Recommended for all rental properties.',
    legal_reference: 'Health and Safety at Work Act 1974; HSE L8 Approved Code of Practice',
    required: 'always',
    deadline: 'before_move_in',
    category: 'safety',
    linked_doc_type: 'legionella_risk_assessment',
  },
  {
    id: 'hmo_licence',
    title: 'HMO Licence',
    description: 'Obtain a mandatory or additional HMO licence if the property qualifies as a House in Multiple Occupation.',
    legal_reference: 'Housing Act 2004, Part 2',
    required: 'hmo_only',
    deadline: 'before_move_in',
    category: 'legal',
    linked_doc_type: 'hmo_licence',
  },
  {
    id: 'fire_risk_assessment',
    title: 'Fire Risk Assessment',
    description: 'Carry out a fire risk assessment for HMOs and shared houses. Keep documented and review regularly.',
    legal_reference: 'Regulatory Reform (Fire Safety) Order 2005',
    required: 'hmo_only',
    deadline: 'before_move_in',
    category: 'safety',
    linked_doc_type: 'fire_risk_assessment',
  },
  {
    id: 'selective_licence',
    title: 'Selective Licensing',
    description: 'Obtain a selective licence if the property is in a designated selective licensing area.',
    legal_reference: 'Housing Act 2004, Part 3',
    required: 'selective_only',
    deadline: 'before_move_in',
    category: 'legal',
    linked_doc_type: 'selective_licence',
  },
  {
    id: 'contact_details',
    title: 'Landlord & Tenant Contact Details',
    description: 'Exchange contact details (name, address, phone, email) between landlord and tenant.',
    legal_reference: 'Landlord and Tenant Act 1985, s1; s48',
    required: 'always',
    deadline: 'before_move_in',
    category: 'documentation',
  },
];

// ─── Category Display Names ──────────────────────────────────

export const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  safety: 'Safety',
  legal: 'Legal',
  financial: 'Financial',
  documentation: 'Documentation',
};

export const CATEGORY_ORDER: ChecklistCategory[] = ['safety', 'legal', 'financial', 'documentation'];

export const DEADLINE_LABELS: Record<ChecklistDeadline, string> = {
  before_move_in: 'Before move-in',
  within_28_days: 'Within 28 days',
  within_30_days: 'Within 30 days',
  annually: 'Annually',
  every_5_years: 'Every 5 years',
};

// ─── Checklist Generation ────────────────────────────────────

export interface PropertyContext {
  property_type?: string | null;
  is_hmo?: boolean;
  is_selective_area?: boolean;
}

/**
 * Generate applicable checklist item definitions based on property type and context.
 */
export function generateChecklistDefinitions(context: PropertyContext): ChecklistItemDefinition[] {
  return CHECKLIST_ITEMS.filter((item) => {
    if (item.required === 'always') return true;
    if (item.required === 'hmo_only') return context.is_hmo === true;
    if (item.required === 'selective_only') return context.is_selective_area === true;
    return false;
  });
}

// ─── Compliance Matching ─────────────────────────────────────

export interface ComplianceData {
  /** Compliance documents keyed by doc_type */
  documents: Map<ComplianceDocType, { status: string; expiry_date: string | null }>;
  /** Tenancy agreement fields */
  tenancyFields: Record<string, string | null>;
}

/**
 * Calculate due date for an item based on its deadline type and tenancy start date.
 */
export function calculateDueDate(deadline: ChecklistDeadline, tenancyStartDate: string): string {
  const start = new Date(tenancyStartDate);

  switch (deadline) {
    case 'before_move_in':
      return tenancyStartDate;
    case 'within_28_days': {
      const d = new Date(start);
      d.setDate(d.getDate() + 28);
      return d.toISOString().split('T')[0];
    }
    case 'within_30_days': {
      const d = new Date(start);
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    }
    case 'annually': {
      const d = new Date(start);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    }
    case 'every_5_years': {
      const d = new Date(start);
      d.setFullYear(d.getFullYear() + 5);
      return d.toISOString().split('T')[0];
    }
  }
}

/**
 * Check a single checklist item against existing compliance data and return its status.
 */
function resolveItemStatus(
  definition: ChecklistItemDefinition,
  complianceData: ComplianceData,
  existingItem: { completed_date: string | null; notes: string | null; document_url: string | null } | null,
  dueDate: string,
): { status: ChecklistItemStatus; auto_verified: boolean; completed_date: string | null } {
  const today = new Date().toISOString().split('T')[0];

  // Check if manually completed
  if (existingItem?.completed_date) {
    return { status: 'done', auto_verified: false, completed_date: existingItem.completed_date };
  }

  // Auto-verify against compliance documents
  if (definition.linked_doc_type) {
    const doc = complianceData.documents.get(definition.linked_doc_type);
    if (doc && (doc.status === 'valid' || doc.status === 'expiring_soon')) {
      return { status: 'done', auto_verified: true, completed_date: today };
    }
  }

  // Auto-verify against tenancy agreement fields
  if (definition.linked_tenancy_field) {
    const fieldValue = complianceData.tenancyFields[definition.linked_tenancy_field];
    if (fieldValue) {
      return { status: 'done', auto_verified: true, completed_date: fieldValue };
    }
  }

  // Not completed — check if overdue
  if (dueDate < today) {
    return { status: 'overdue', auto_verified: false, completed_date: null };
  }

  return { status: 'pending', auto_verified: false, completed_date: null };
}

/**
 * Build the full checklist for a tenancy, resolving each item's status against
 * existing compliance data.
 */
export function buildTenancyChecklist(
  definitions: ChecklistItemDefinition[],
  complianceData: ComplianceData,
  existingItems: Map<string, { completed_date: string | null; completed_by: string | null; notes: string | null; document_url: string | null }>,
  tenancyStartDate: string,
): ChecklistItem[] {
  return definitions.map((def) => {
    const existing = existingItems.get(def.id) || null;
    const dueDate = calculateDueDate(def.deadline, tenancyStartDate);
    const resolved = resolveItemStatus(def, complianceData, existing, dueDate);

    return {
      ...def,
      status: resolved.status,
      completed_date: resolved.completed_date,
      completed_by: existing?.completed_by || null,
      notes: existing?.notes || null,
      document_url: existing?.document_url || null,
      due_date: dueDate,
      auto_verified: resolved.auto_verified,
    };
  });
}

/**
 * Calculate summary stats from a checklist.
 */
export function getChecklistSummary(items: ChecklistItem[]): ChecklistSummary {
  const total = items.length;
  const completed = items.filter((i) => i.status === 'done').length;
  const overdue = items.filter((i) => i.status === 'overdue').length;
  const pending = items.filter((i) => i.status === 'pending').length;

  return {
    total,
    completed,
    pending,
    overdue,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 100,
  };
}

/**
 * Group checklist items by category.
 */
export function groupByCategory(items: ChecklistItem[]): Record<ChecklistCategory, ChecklistItem[]> {
  const grouped: Record<ChecklistCategory, ChecklistItem[]> = {
    safety: [],
    legal: [],
    financial: [],
    documentation: [],
  };

  for (const item of items) {
    grouped[item.category].push(item);
  }

  return grouped;
}
