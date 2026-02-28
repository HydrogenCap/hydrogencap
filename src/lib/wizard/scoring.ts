import type { WizardPayload, WizardRoom, ComplianceItem } from './types';

interface ScoreCategory {
  label: string;
  weight: number;
  fields: string[];
  conditionalFields?: (data: WizardPayload) => string[];
}

const CATEGORIES: ScoreCategory[] = [
  {
    label: 'Address & Basics',
    weight: 15,
    fields: ['address_line_1', 'city', 'postcode', 'property_type', 'lifecycle_stage'],
  },
  {
    label: 'Ownership',
    weight: 15,
    fields: ['entity_id', 'listing_grade'],
  },
  {
    label: 'Layout',
    weight: 10,
    fields: ['has_gas_supply'],
    conditionalFields: (d) => {
      if (['hmo_licensed', 'hmo_mandatory'].includes(d.property_type as string)) {
        return ['rooms'];
      }
      return [];
    },
  },
  {
    label: 'Compliance',
    weight: 25,
    fields: ['compliance_items'],
  },
  {
    label: 'Finance',
    weight: 20,
    fields: ['has_mortgage'],
    conditionalFields: (d) => {
      if (d.has_mortgage) {
        return ['lender_name', 'original_amount', 'interest_rate', 'rate_type', 'facility_type'];
      }
      return [];
    },
  },
  {
    label: 'Documents',
    weight: 15,
    fields: [],
  },
];

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export interface ScoreBreakdown {
  total: number;
  categories: { label: string; weight: number; percent: number; filled: number; total: number }[];
}

export function calculateCompletenessScore(data: WizardPayload): ScoreBreakdown {
  const categories = CATEGORIES.map((cat) => {
    const allFields = [
      ...cat.fields,
      ...(cat.conditionalFields?.(data) || []),
    ];

    if (allFields.length === 0) {
      return { label: cat.label, weight: cat.weight, percent: 100, filled: 0, total: 0 };
    }

    const filled = allFields.filter((f) => {
      if (f === 'rooms') {
        return ((data.rooms as WizardRoom[])?.length || 0) > 0;
      }
      if (f === 'compliance_items') {
        return ((data.compliance_items as ComplianceItem[])?.length || 0) > 0;
      }
      return isFilled(data[f]);
    }).length;

    const percent = Math.round((filled / allFields.length) * 100);
    return { label: cat.label, weight: cat.weight, percent, filled, total: allFields.length };
  });

  const total = Math.round(
    categories.reduce((sum, c) => sum + (c.weight * c.percent) / 100, 0)
  );

  return { total, categories };
}
