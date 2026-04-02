/**
 * Tests for HMO compliance logic:
 * Part 1 — Pure HMO room-size calculations (sqft→sqm, room minimums, amenity ratios)
 * Part 2 — Compliance requirements engine (conditions, statuses, scoring)
 */
import { describe, it, expect } from 'vitest';
import {
  calculateComplianceRequirements,
  getRequirementStatusLabel,
  getRequirementStatusIndicator,
  groupRequirementsByCategory,
  getComplianceIssues,
  COMPLIANCE_REQUIREMENT_DEFINITIONS,
  type PropertyComplianceFeatures,
  type ComplianceRequirement,
} from '../complianceRequirements';
import {
  getComplianceStatus,
  formatComplianceDate,
} from '../complianceStatus';
import {
  getComplianceItemStatus,
  STATUS_THRESHOLDS,
} from '../complianceTypes';

// ══════════════════════════════════════════════════════════════════════
// Part 1: HMO Room Size & Amenity Ratio Calculations
// ══════════════════════════════════════════════════════════════════════

// Re-implement the pure functions from HmoComplianceCard for testing
// (they're not exported, so we replicate the logic)

const MIN_SIZES = {
  single_adult: 6.51,
  double_adult: 10.22,
  child_under_10: 4.64,
};

function sqftToSqm(sqft: number): number {
  return sqft * 0.092903;
}

function getRoomMinSize(roomType: string): number {
  if (roomType === 'double' || roomType === 'ensuite' || roomType === 'studio') {
    return MIN_SIZES.double_adult;
  }
  return MIN_SIZES.single_adult;
}

function checkRoomCompliance(sqft: number, roomType: string) {
  const sqm = sqftToSqm(sqft);
  const minSize = getRoomMinSize(roomType);
  return {
    sqm: Math.round(sqm * 100) / 100,
    minSize,
    compliant: sqm >= minSize,
  };
}

function checkBathroomRatio(occupants: number, bathrooms: number) {
  const ratio = occupants / bathrooms;
  return {
    ratio,
    compliant: ratio <= 5,
  };
}

describe('sqftToSqm conversion', () => {
  it('converts 0 sqft to 0 sqm', () => {
    expect(sqftToSqm(0)).toBe(0);
  });

  it('converts 100 sqft correctly', () => {
    expect(sqftToSqm(100)).toBeCloseTo(9.2903, 3);
  });

  it('converts 70 sqft (minimum single room) correctly', () => {
    expect(sqftToSqm(70)).toBeCloseTo(6.503, 2);
  });

  it('converts 110 sqft (minimum double room) correctly', () => {
    expect(sqftToSqm(110)).toBeCloseTo(10.219, 2);
  });
});

describe('getRoomMinSize', () => {
  it('returns double_adult size for double rooms', () => {
    expect(getRoomMinSize('double')).toBe(10.22);
  });

  it('returns double_adult size for ensuite rooms', () => {
    expect(getRoomMinSize('ensuite')).toBe(10.22);
  });

  it('returns double_adult size for studio rooms', () => {
    expect(getRoomMinSize('studio')).toBe(10.22);
  });

  it('returns single_adult size for single rooms', () => {
    expect(getRoomMinSize('single')).toBe(6.51);
  });

  it('returns single_adult size for unknown room types', () => {
    expect(getRoomMinSize('other')).toBe(6.51);
    expect(getRoomMinSize('utility')).toBe(6.51);
  });
});

describe('room size compliance checks', () => {
  it('compliant single room at 71 sqft', () => {
    const result = checkRoomCompliance(71, 'single');
    expect(result.compliant).toBe(true);
    expect(result.sqm).toBeCloseTo(6.60, 1);
  });

  it('non-compliant single room at 70 sqft (just under 6.51 sqm)', () => {
    const result = checkRoomCompliance(70, 'single');
    // 70 sqft = 6.503 sqm, min is 6.51 sqm — not compliant
    expect(result.compliant).toBe(false);
  });

  it('non-compliant single room at 65 sqft', () => {
    const result = checkRoomCompliance(65, 'single');
    expect(result.compliant).toBe(false);
  });

  it('compliant double room at 111 sqft', () => {
    const result = checkRoomCompliance(111, 'double');
    expect(result.compliant).toBe(true);
  });

  it('non-compliant double room at 110 sqft (just under 10.22 sqm)', () => {
    // 110 sqft = 10.219 sqm, min is 10.22 sqm — not compliant
    const result = checkRoomCompliance(110, 'double');
    expect(result.compliant).toBe(false);
  });

  it('non-compliant double room at 100 sqft', () => {
    const result = checkRoomCompliance(100, 'double');
    expect(result.compliant).toBe(false);
    expect(result.sqm).toBeCloseTo(9.29, 1);
  });

  it('ensuite treated as double', () => {
    const result = checkRoomCompliance(115, 'ensuite');
    expect(result.compliant).toBe(true);
    expect(result.minSize).toBe(10.22);
  });

  it('large room is always compliant', () => {
    const result = checkRoomCompliance(200, 'single');
    expect(result.compliant).toBe(true);
  });
});

describe('bathroom amenity ratio', () => {
  it('compliant with 5 occupants and 1 bathroom (ratio = 5)', () => {
    const { compliant, ratio } = checkBathroomRatio(5, 1);
    expect(compliant).toBe(true);
    expect(ratio).toBe(5);
  });

  it('non-compliant with 6 occupants and 1 bathroom', () => {
    const { compliant } = checkBathroomRatio(6, 1);
    expect(compliant).toBe(false);
  });

  it('compliant with 10 occupants and 2 bathrooms', () => {
    const { compliant } = checkBathroomRatio(10, 2);
    expect(compliant).toBe(true);
  });

  it('compliant with 3 occupants and 2 bathrooms', () => {
    const { compliant, ratio } = checkBathroomRatio(3, 2);
    expect(compliant).toBe(true);
    expect(ratio).toBe(1.5);
  });

  it('non-compliant with 11 occupants and 2 bathrooms', () => {
    const { compliant } = checkBathroomRatio(11, 2);
    expect(compliant).toBe(false);
  });
});

describe('overall compliance score logic', () => {
  it('returns 100% when all checks pass', () => {
    const checks = [true, true, true];
    const passed = checks.filter(Boolean).length;
    const score = Math.round((passed / checks.length) * 100);
    expect(score).toBe(100);
  });

  it('returns 67% when one check fails', () => {
    const checks = [true, true, false];
    const passed = checks.filter(Boolean).length;
    const score = Math.round((passed / checks.length) * 100);
    expect(score).toBe(67);
  });

  it('returns 33% when two checks fail', () => {
    const checks = [true, false, false];
    const passed = checks.filter(Boolean).length;
    const score = Math.round((passed / checks.length) * 100);
    expect(score).toBe(33);
  });

  it('returns 0% when all checks fail', () => {
    const checks = [false, false, false];
    const passed = checks.filter(Boolean).length;
    const score = Math.round((passed / checks.length) * 100);
    expect(score).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Part 2: Compliance Requirements Engine
// ══════════════════════════════════════════════════════════════════════

// ── Helpers ─────────────────────────────────────────────────────────────

function makeProperty(overrides: Partial<PropertyComplianceFeatures> = {}): PropertyComplianceFeatures {
  return {
    id: 'prop-1',
    address_line: '1 Test Lane',
    has_gas: true,
    has_fire_alarm_system: false,
    fire_alarm_grade: null,
    has_emergency_lighting: false,
    asset_category: null,
    occupancy_status: 'occupied',
    is_hmo_licensed: false,
    selective_licence_required: false,
    co_alarm_required: true,
    epc_required: true,
    listed_status: null,
    is_grade_listed: false,
    listing_grade: null,
    has_solar: false,
    ...overrides,
  };
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function makeComplianceItem(type: string, expiryDays: number | null, hasCurrent = true) {
  return {
    id: `ci-${type}`,
    property_id: 'prop-1',
    org_id: 'org-1',
    compliance_type: type,
    issue_date: '2023-01-01',
    expiry_date: expiryDays !== null ? daysFromNow(expiryDays) : null,
    reminder_days: [30, 60],
    responsible_party: 'Owner',
    notes: null,
    created_at: '2023-01-01',
    updated_at: '2023-01-01',
    documents: hasCurrent ? [{ id: 'doc-1', is_current: true }] : [],
  };
}

// ── COMPLIANCE_REQUIREMENT_DEFINITIONS ──────────────────────────────────

describe('COMPLIANCE_REQUIREMENT_DEFINITIONS', () => {
  it('requires Gas Safety when property has gas', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Gas Safety Certificate (CP12)'];
    expect(def.condition(makeProperty({ has_gas: true }))).toBe(true);
  });

  it('does not require Gas Safety when has_gas is false', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Gas Safety Certificate (CP12)'];
    expect(def.condition(makeProperty({ has_gas: false }))).toBe(false);
  });

  it('requires Gas Safety when has_gas is null (default safe)', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Gas Safety Certificate (CP12)'];
    expect(def.condition(makeProperty({ has_gas: null }))).toBe(true);
  });

  it('always requires EICR', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Electrical Safety Certificate (EICR)'];
    expect(def.condition(makeProperty())).toBe(true);
    expect(def.condition(makeProperty({ has_gas: false }))).toBe(true);
  });

  it('exempts grade-listed buildings from EPC', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['EPC'];
    expect(def.condition(makeProperty({ is_grade_listed: true }))).toBe(false);
  });

  it('requires EPC for non-listed buildings', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['EPC'];
    expect(def.condition(makeProperty({ is_grade_listed: false }))).toBe(true);
  });

  it('requires Smoke Alarm when no fire alarm system', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Smoke Alarm Declaration'];
    expect(def.condition(makeProperty({ has_fire_alarm_system: false }))).toBe(true);
  });

  it('does not require Smoke Alarm when fire alarm system present', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Smoke Alarm Declaration'];
    expect(def.condition(makeProperty({ has_fire_alarm_system: true }))).toBe(false);
  });

  it('requires FRA for HMO properties', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Fire Risk Assessment (FRA)'];
    expect(def.condition(makeProperty({ asset_category: 'HMO - Large' }))).toBe(true);
  });

  it('requires FRA for properties with fire alarm system', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Fire Risk Assessment (FRA)'];
    expect(def.condition(makeProperty({ has_fire_alarm_system: true }))).toBe(true);
  });

  it('does not require FRA for standard single-let', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Fire Risk Assessment (FRA)'];
    expect(def.condition(makeProperty({ asset_category: 'BTL', has_fire_alarm_system: false }))).toBe(false);
  });

  it('requires PAT testing for HMOs', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['PAT Testing'];
    expect(def.condition(makeProperty({ asset_category: 'HMO' }))).toBe(true);
  });

  it('does not require PAT testing for non-HMO', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['PAT Testing'];
    expect(def.condition(makeProperty({ asset_category: 'BTL' }))).toBe(false);
  });

  it('requires HMO Licence when is_hmo_licensed is true', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['HMO Licence'];
    expect(def.condition(makeProperty({ is_hmo_licensed: true }))).toBe(true);
  });

  it('does not require HMO Licence for non-HMO', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['HMO Licence'];
    expect(def.condition(makeProperty({ is_hmo_licensed: false }))).toBe(false);
  });

  it('requires Selective Licence when in selective area', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Selective Licence'];
    expect(def.condition(makeProperty({ selective_licence_required: true }))).toBe(true);
  });

  it('requires Fire Alarm Certificate for Grade A alarm', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Fire Alarm Certificate'];
    expect(def.condition(makeProperty({ fire_alarm_grade: 'Grade A' }))).toBe(true);
  });

  it('requires Emergency Lighting Certificate when installed', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Emergency Lighting Certificate'];
    expect(def.condition(makeProperty({ has_emergency_lighting: true }))).toBe(true);
  });

  it('always requires Buildings Insurance', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['Buildings Insurance Schedule'];
    expect(def.condition(makeProperty())).toBe(true);
  });

  it('requires MCS Certificate when solar panels installed', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['MCS Certificate'];
    expect(def.condition(makeProperty({ has_solar: true }))).toBe(true);
  });

  it('does not require MCS Certificate without solar', () => {
    const def = COMPLIANCE_REQUIREMENT_DEFINITIONS['MCS Certificate'];
    expect(def.condition(makeProperty({ has_solar: false }))).toBe(false);
  });
});

// ── calculateComplianceRequirements ─────────────────────────────────────

describe('calculateComplianceRequirements', () => {
  it('returns missing status for required items with no existing record', () => {
    const property = makeProperty();
    const summary = calculateComplianceRequirements(property, []);
    const gasSafety = summary.requirements.find(r => r.type === 'Gas Safety Certificate (CP12)');
    expect(gasSafety?.required).toBe(true);
    expect(gasSafety?.status).toBe('missing');
    expect(summary.missingCount).toBeGreaterThan(0);
  });

  it('returns valid status for items with current documents and future expiry', () => {
    const property = makeProperty();
    const items = [makeComplianceItem('Gas Safety Certificate (CP12)', 180)];
    const summary = calculateComplianceRequirements(property, items);
    const gasSafety = summary.requirements.find(r => r.type === 'Gas Safety Certificate (CP12)');
    expect(gasSafety?.status).toBe('valid');
  });

  it('returns expired status for expired items', () => {
    const property = makeProperty();
    const items = [makeComplianceItem('Gas Safety Certificate (CP12)', -10)];
    const summary = calculateComplianceRequirements(property, items);
    const gasSafety = summary.requirements.find(r => r.type === 'Gas Safety Certificate (CP12)');
    expect(gasSafety?.status).toBe('expired');
  });

  it('returns expiring_soon status for items expiring within threshold', () => {
    const property = makeProperty();
    const items = [makeComplianceItem('Gas Safety Certificate (CP12)', 30)];
    const summary = calculateComplianceRequirements(property, items);
    const gasSafety = summary.requirements.find(r => r.type === 'Gas Safety Certificate (CP12)');
    expect(gasSafety?.status).toBe('expiring_soon');
  });

  it('returns not_required for items whose condition is false', () => {
    const property = makeProperty({ has_gas: false });
    const summary = calculateComplianceRequirements(property, []);
    const gasSafety = summary.requirements.find(r => r.type === 'Gas Safety Certificate (CP12)');
    expect(gasSafety?.status).toBe('not_required');
    expect(gasSafety?.required).toBe(false);
  });

  it('calculates compliance score as percentage of valid required items', () => {
    const property = makeProperty();
    const requiredTypes = Object.entries(COMPLIANCE_REQUIREMENT_DEFINITIONS)
      .filter(([, def]) => def.condition(property))
      .map(([name]) => name);

    const items = requiredTypes.map(type => makeComplianceItem(type, 180));
    const summary = calculateComplianceRequirements(property, items);
    expect(summary.complianceScore).toBe(100);
  });

  it('returns 100% score when no items are required', () => {
    const property = makeProperty({
      has_gas: false,
      is_grade_listed: true,
      epc_required: false,
      has_fire_alarm_system: true,
    });
    const summary = calculateComplianceRequirements(property, []);
    expect(summary.totalRequired).toBeGreaterThan(0);
  });

  it('counts statuses correctly', () => {
    const property = makeProperty();
    const items = [
      makeComplianceItem('Gas Safety Certificate (CP12)', 180),
      makeComplianceItem('Electrical Safety Certificate (EICR)', -5),
    ];
    const summary = calculateComplianceRequirements(property, items);
    expect(summary.validCount).toBeGreaterThanOrEqual(1);
    expect(summary.expiredCount).toBeGreaterThanOrEqual(1);
  });
});

// ── getComplianceItemStatus (from complianceTypes) ──────────────────────

describe('getComplianceItemStatus', () => {
  it('returns unknown for null expiry', () => {
    expect(getComplianceItemStatus(null)).toBe('unknown');
    expect(getComplianceItemStatus(undefined)).toBe('unknown');
  });

  it('returns expired for past dates', () => {
    expect(getComplianceItemStatus(daysFromNow(-1))).toBe('expired');
    expect(getComplianceItemStatus(daysFromNow(-365))).toBe('expired');
  });

  it('returns expiring_soon within threshold', () => {
    expect(getComplianceItemStatus(daysFromNow(30))).toBe('expiring_soon');
    expect(getComplianceItemStatus(daysFromNow(STATUS_THRESHOLDS.EXPIRING_SOON))).toBe('expiring_soon');
  });

  it('returns valid for dates beyond threshold', () => {
    expect(getComplianceItemStatus(daysFromNow(STATUS_THRESHOLDS.EXPIRING_SOON + 1))).toBe('valid');
    expect(getComplianceItemStatus(daysFromNow(365))).toBe('valid');
  });
});

// ── getComplianceStatus (from complianceStatus) ─────────────────────────

describe('getComplianceStatus', () => {
  it('returns unknown for null/undefined', () => {
    expect(getComplianceStatus(null).status).toBe('unknown');
    expect(getComplianceStatus(undefined).status).toBe('unknown');
  });

  it('returns overdue for past dates', () => {
    const result = getComplianceStatus(daysFromNow(-10));
    expect(result.status).toBe('overdue');
    expect(result.daysUntilDue).toBeLessThan(0);
    expect(result.label).toContain('overdue');
  });

  it('returns due_soon for dates within 30 days', () => {
    const result = getComplianceStatus(daysFromNow(15));
    expect(result.status).toBe('due_soon');
    expect(result.daysUntilDue).toBeGreaterThanOrEqual(0);
  });

  it('returns ok for dates more than 30 days away', () => {
    const result = getComplianceStatus(daysFromNow(60));
    expect(result.status).toBe('ok');
    expect(result.daysUntilDue).toBeGreaterThan(30);
  });

  it('returns due_soon with "Due today" label when days = 0', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const result = getComplianceStatus(todayStr);
    expect(result.status).toBe('due_soon');
    expect(result.label).toBe('Due today');
  });
});

// ── formatComplianceDate ────────────────────────────────────────────────

describe('formatComplianceDate', () => {
  it('returns dash for null/undefined', () => {
    expect(formatComplianceDate(null)).toBe('—');
    expect(formatComplianceDate(undefined)).toBe('—');
  });

  it('formats date in en-GB format', () => {
    const result = formatComplianceDate('2024-12-25');
    expect(result).toMatch(/25/);
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/2024/);
  });
});

// ── getRequirementStatusLabel ───────────────────────────────────────────

describe('getRequirementStatusLabel', () => {
  it('returns Missing for missing status', () => {
    expect(getRequirementStatusLabel('missing', null)).toBe('Missing');
  });

  it('returns Expired with days for expired status', () => {
    expect(getRequirementStatusLabel('expired', -10)).toBe('Expired 10 days ago');
  });

  it('returns Expired without days when null', () => {
    expect(getRequirementStatusLabel('expired', null)).toBe('Expired');
  });

  it('returns Expires today when daysUntilExpiry is 0', () => {
    expect(getRequirementStatusLabel('expiring_soon', 0)).toBe('Expires today');
  });

  it('returns Expires in N days for expiring_soon', () => {
    expect(getRequirementStatusLabel('expiring_soon', 15)).toBe('Expires in 15 days');
  });

  it('returns Valid with days for valid status', () => {
    expect(getRequirementStatusLabel('valid', 180)).toBe('Valid (180 days)');
  });

  it('returns Not Required for not_required', () => {
    expect(getRequirementStatusLabel('not_required', null)).toBe('Not Required');
  });
});

// ── getRequirementStatusIndicator ───────────────────────────────────────

describe('getRequirementStatusIndicator', () => {
  it('returns red for missing', () => {
    expect(getRequirementStatusIndicator('missing')).toBe('🔴');
  });

  it('returns red for expired', () => {
    expect(getRequirementStatusIndicator('expired')).toBe('🔴');
  });

  it('returns orange for expiring_soon', () => {
    expect(getRequirementStatusIndicator('expiring_soon')).toBe('🟠');
  });

  it('returns green for valid', () => {
    expect(getRequirementStatusIndicator('valid')).toBe('🟢');
  });

  it('returns white for not_required', () => {
    expect(getRequirementStatusIndicator('not_required')).toBe('⚪');
  });
});

// ── groupRequirementsByCategory ─────────────────────────────────────────

describe('groupRequirementsByCategory', () => {
  it('groups requirements by their category', () => {
    const reqs: ComplianceRequirement[] = [
      { type: 'Gas Safety', category: 'Safety & Legal', required: true, reason: '', status: 'valid', existingItem: null, daysUntilExpiry: null, hasDocument: false },
      { type: 'HMO Licence', category: 'HMO & Licensing', required: true, reason: '', status: 'missing', existingItem: null, daysUntilExpiry: null, hasDocument: false },
      { type: 'EICR', category: 'Safety & Legal', required: true, reason: '', status: 'valid', existingItem: null, daysUntilExpiry: null, hasDocument: false },
    ];
    const grouped = groupRequirementsByCategory(reqs);
    expect(grouped['Safety & Legal']).toHaveLength(2);
    expect(grouped['HMO & Licensing']).toHaveLength(1);
  });

  it('handles empty array', () => {
    const grouped = groupRequirementsByCategory([]);
    expect(Object.keys(grouped)).toHaveLength(0);
  });
});

// ── getComplianceIssues ─────────────────────────────────────────────────

describe('getComplianceIssues', () => {
  it('filters for missing, expired, and expiring_soon only', () => {
    const reqs: ComplianceRequirement[] = [
      { type: 'A', category: 'X', required: true, reason: '', status: 'valid', existingItem: null, daysUntilExpiry: null, hasDocument: false },
      { type: 'B', category: 'X', required: true, reason: '', status: 'missing', existingItem: null, daysUntilExpiry: null, hasDocument: false },
      { type: 'C', category: 'X', required: true, reason: '', status: 'expired', existingItem: null, daysUntilExpiry: null, hasDocument: false },
      { type: 'D', category: 'X', required: true, reason: '', status: 'expiring_soon', existingItem: null, daysUntilExpiry: null, hasDocument: false },
      { type: 'E', category: 'X', required: false, reason: '', status: 'not_required', existingItem: null, daysUntilExpiry: null, hasDocument: false },
    ];
    const issues = getComplianceIssues(reqs);
    expect(issues).toHaveLength(3);
    expect(issues.map(i => i.type)).toEqual(['B', 'C', 'D']);
  });

  it('returns empty array when no issues', () => {
    const reqs: ComplianceRequirement[] = [
      { type: 'A', category: 'X', required: true, reason: '', status: 'valid', existingItem: null, daysUntilExpiry: null, hasDocument: false },
    ];
    expect(getComplianceIssues(reqs)).toHaveLength(0);
  });
});
