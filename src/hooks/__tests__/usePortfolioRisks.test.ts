import { describe, it, expect } from 'vitest';
import { calculatePortfolioRisks } from '../usePortfolioRisks';
import type { ComplianceMatrixRow } from '@/lib/complianceV2Types';
import type { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';

// Minimal property factory — only the fields calculatePortfolioRisks reads.
function makeProperty(overrides: Partial<PropertyWithFinancials> = {}): PropertyWithFinancials {
  return {
    id: 'prop-1',
    org_id: 'org-1',
    address_line: '22 Wellsfield',
    lifecycle_type: 'core_rental',
    current_value_gbp: 300000,
    epc_rating: 'C',
    epc_required: false,
    is_hmo_licensed: false,
    loans: [],
    income: [],
    costs: [],
    ...overrides,
  } as unknown as PropertyWithFinancials;
}

function makeMatrixRow(overrides: Partial<ComplianceMatrixRow> = {}): ComplianceMatrixRow {
  return {
    requirement_id: 'req-1',
    org_id: 'org-1',
    property_id: 'prop-1',
    property_address: '22 Wellsfield',
    property_type: 'hmo',
    entity_name: null,
    document_type: 'hmo_licence',
    is_required: true,
    override_reason: null,
    review_frequency_months: 60,
    lead_time_days: 60,
    document_id: null,
    issue_date: null,
    expiry_date: null,
    issuer_name: null,
    certificate_number: null,
    file_url: null,
    ai_extracted: null,
    cost: null,
    document_notes: null,
    calculated_status: 'missing',
    days_remaining: null,
    urgency_score: 0,
    ...overrides,
  };
}

describe('calculatePortfolioRisks — HMO licence suppression', () => {
  it('does NOT flag missing HMO licence when property.is_hmo_licensed is false', () => {
    // Even if a matrix row says is_required, the property-level flag suppresses the risk.
    const property = makeProperty({ is_hmo_licensed: false });
    const matrix = [makeMatrixRow({ is_required: true, calculated_status: 'missing' })];

    const risks = calculatePortfolioRisks([property], new Map(), matrix);
    const hmoRisks = risks.filter(r => r.type === 'hmo_licence');

    expect(hmoRisks).toHaveLength(0);
  });

  it('does NOT flag missing HMO licence when the requirement row is marked is_required=false', () => {
    // Regression: previously the `find` excluded is_required=false rows and fell through
    // to "HMO licence required but missing" — false positive for 22 Wellsfield etc.
    const property = makeProperty({ is_hmo_licensed: true });
    const matrix = [
      makeMatrixRow({
        is_required: false,
        override_reason: 'Manually removed - HMO licence not required',
        calculated_status: 'not_required',
      }),
    ];

    const risks = calculatePortfolioRisks([property], new Map(), matrix);
    const hmoRisks = risks.filter(r => r.type === 'hmo_licence');

    expect(hmoRisks).toHaveLength(0);
  });

  it('DOES flag missing HMO licence when is_hmo_licensed=true and requirement is required & missing', () => {
    const property = makeProperty({ is_hmo_licensed: true });
    const matrix = [makeMatrixRow({ is_required: true, calculated_status: 'missing' })];

    const risks = calculatePortfolioRisks([property], new Map(), matrix);
    const hmoRisks = risks.filter(r => r.type === 'hmo_licence');

    expect(hmoRisks).toHaveLength(1);
    expect(hmoRisks[0].message).toMatch(/required but missing/i);
  });

  it('DOES flag expired HMO licence when requirement is required & expired', () => {
    const property = makeProperty({ is_hmo_licensed: true });
    const matrix = [
      makeMatrixRow({ is_required: true, calculated_status: 'expired', days_remaining: -10 }),
    ];

    const risks = calculatePortfolioRisks([property], new Map(), matrix);
    const hmoRisks = risks.filter(r => r.type === 'hmo_licence');

    expect(hmoRisks).toHaveLength(1);
    expect(hmoRisks[0].message).toMatch(/expired/i);
  });
});

describe('calculatePortfolioRisks — recomputation on requirement-applicability changes', () => {
  it('recomputes when is_required flips from true to false (Today page query result changes)', () => {
    // Simulates what happens when the compliance matrix query is invalidated after
    // a user toggles a requirement's applicability. usePortfolioRisks consumes the
    // matrix via useMemo, so a new matrix array must produce a new risk list.
    const property = makeProperty({ is_hmo_licensed: true });

    const beforeMatrix = [makeMatrixRow({ is_required: true, calculated_status: 'missing' })];
    const before = calculatePortfolioRisks([property], new Map(), beforeMatrix);
    expect(before.some(r => r.type === 'hmo_licence')).toBe(true);

    const afterMatrix = [
      makeMatrixRow({
        is_required: false,
        calculated_status: 'not_required',
        override_reason: 'Not required',
      }),
    ];
    const after = calculatePortfolioRisks([property], new Map(), afterMatrix);
    expect(after.some(r => r.type === 'hmo_licence')).toBe(false);
  });
});
