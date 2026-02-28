import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateComplianceRequirements,
  getRequirementStatusColor,
  getRequirementStatusLabel,
  getRequirementStatusIndicator,
  groupRequirementsByCategory,
  getComplianceIssues,
  type PropertyComplianceFeatures,
} from './complianceRequirements';

describe('calculateComplianceRequirements', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProperty: PropertyComplianceFeatures = {
    id: 'prop-1',
    address_line: '10 Test Street',
    has_gas: true,
    has_fire_alarm_system: false,
    fire_alarm_grade: null,
    has_emergency_lighting: false,
    asset_category: 'Single Let',
    occupancy_status: 'tenanted',
    is_hmo_licensed: false,
    selective_licence_required: false,
    co_alarm_required: null,
    epc_required: null,
    listed_status: null,
    is_grade_listed: false,
    listing_grade: null,
    has_solar: false,
  };

  it('requires Gas Safety Certificate when property has gas', () => {
    const result = calculateComplianceRequirements(baseProperty, []);
    const gasCert = result.requirements.find(r => r.type === 'Gas Safety Certificate (CP12)');
    expect(gasCert).toBeDefined();
    expect(gasCert!.required).toBe(true);
    expect(gasCert!.status).toBe('missing');
  });

  it('does NOT require Gas Safety when property has no gas', () => {
    const noGasProperty = { ...baseProperty, has_gas: false };
    const result = calculateComplianceRequirements(noGasProperty, []);
    const gasCert = result.requirements.find(r => r.type === 'Gas Safety Certificate (CP12)');
    expect(gasCert).toBeDefined();
    expect(gasCert!.required).toBe(false);
    expect(gasCert!.status).toBe('not_required');
  });

  it('does NOT require EPC for Grade Listed buildings', () => {
    const listedProperty = { ...baseProperty, is_grade_listed: true };
    const result = calculateComplianceRequirements(listedProperty, []);
    const epc = result.requirements.find(r => r.type === 'EPC');
    expect(epc).toBeDefined();
    expect(epc!.required).toBe(false);
    expect(epc!.reason).toContain('Listed');
  });

  it('always requires EICR', () => {
    const result = calculateComplianceRequirements(baseProperty, []);
    const eicr = result.requirements.find(r => r.type === 'Electrical Safety Certificate (EICR)');
    expect(eicr).toBeDefined();
    expect(eicr!.required).toBe(true);
  });

  it('marks existing valid items as valid', () => {
    const validItem = {
      id: 'comp-1',
      property_id: 'prop-1',
      compliance_type: 'Gas Safety Certificate (CP12)',
      issue_date: '2025-12-01',
      expiry_date: '2026-12-01',
      notes: null,
      org_id: 'org-1',
      created_at: '2025-12-01',
      updated_at: '2025-12-01',
      reminder_days: [30, 14, 7],
      responsible_party: 'landlord',
    };
    const result = calculateComplianceRequirements(baseProperty, [validItem]);
    const gasCert = result.requirements.find(r => r.type === 'Gas Safety Certificate (CP12)');
    expect(gasCert!.status).toBe('valid');
    expect(gasCert!.daysUntilExpiry).toBeGreaterThan(0);
  });

  it('calculates compliance score correctly', () => {
    const result = calculateComplianceRequirements(baseProperty, []);
    expect(result.complianceScore).toBeDefined();
    expect(result.complianceScore).toBeGreaterThanOrEqual(0);
    expect(result.complianceScore).toBeLessThanOrEqual(100);
    // With no items uploaded, score should be low
    expect(result.missingCount).toBeGreaterThan(0);
  });

  it('requires HMO Licence for HMO properties', () => {
    const hmoProperty = {
      ...baseProperty,
      asset_category: 'HMO',
      is_hmo_licensed: true,
    };
    const result = calculateComplianceRequirements(hmoProperty, []);
    const hmoLicence = result.requirements.find(r => r.type === 'HMO Licence');
    expect(hmoLicence).toBeDefined();
    expect(hmoLicence!.required).toBe(true);
  });
});

describe('getRequirementStatusColor', () => {
  it('returns red for expired', () => {
    expect(getRequirementStatusColor('expired')).toContain('red');
  });

  it('returns amber/yellow for expiring_soon', () => {
    const color = getRequirementStatusColor('expiring_soon');
    expect(color).toMatch(/amber|yellow/);
  });

  it('returns green for valid', () => {
    expect(getRequirementStatusColor('valid')).toContain('green');
  });

  it('returns muted for not_required', () => {
    expect(getRequirementStatusColor('not_required')).toContain('muted');
  });
});

describe('getRequirementStatusLabel', () => {
  it('returns Missing for missing status', () => {
    expect(getRequirementStatusLabel('missing', null)).toContain('Missing');
  });

  it('returns days until expiry for expiring_soon', () => {
    const label = getRequirementStatusLabel('expiring_soon', 15);
    expect(label).toContain('15');
  });
});

describe('getRequirementStatusIndicator', () => {
  it('returns correct emoji indicators', () => {
    expect(getRequirementStatusIndicator('expired')).toBe('🔴');
    expect(getRequirementStatusIndicator('expiring_soon')).toBe('🟠');
    expect(getRequirementStatusIndicator('valid')).toBe('🟢');
    expect(getRequirementStatusIndicator('not_required')).toBe('⚪');
  });
});

describe('groupRequirementsByCategory', () => {
  it('groups requirements by their category field', () => {
    const requirements = [
      { type: 'Gas Safety', category: 'Safety & Legal', required: true, reason: '', status: 'valid' as const, existingItem: null, daysUntilExpiry: null, hasDocument: false },
      { type: 'EPC', category: 'Safety & Legal', required: true, reason: '', status: 'valid' as const, existingItem: null, daysUntilExpiry: null, hasDocument: false },
      { type: 'HMO Licence', category: 'HMO & Licensing', required: true, reason: '', status: 'missing' as const, existingItem: null, daysUntilExpiry: null, hasDocument: false },
    ];
    const grouped = groupRequirementsByCategory(requirements);
    expect(Object.keys(grouped)).toContain('Safety & Legal');
    expect(Object.keys(grouped)).toContain('HMO & Licensing');
    expect(grouped['Safety & Legal'].length).toBe(2);
  });
});

describe('getComplianceIssues', () => {
  it('returns only expired and missing items', () => {
    const requirements = [
      { type: 'Gas Safety', category: 'Safety', required: true, reason: '', status: 'valid' as const, existingItem: null, daysUntilExpiry: 200, hasDocument: true },
      { type: 'EICR', category: 'Safety', required: true, reason: '', status: 'expired' as const, existingItem: null, daysUntilExpiry: -30, hasDocument: false },
      { type: 'EPC', category: 'Safety', required: true, reason: '', status: 'missing' as const, existingItem: null, daysUntilExpiry: null, hasDocument: false },
    ];
    const issues = getComplianceIssues(requirements);
    expect(issues.length).toBe(2);
    expect(issues.map(i => i.type)).toContain('EICR');
    expect(issues.map(i => i.type)).toContain('EPC');
  });
});
