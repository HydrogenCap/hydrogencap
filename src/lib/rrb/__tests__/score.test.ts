import { describe, it, expect } from 'vitest';
import { computeRRBScore } from '../score';

const NOW = new Date('2026-04-26T00:00:00Z');

function future(days: number) {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
function past(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

const allCerts = [
  { type: 'gas', expiry_date: future(180) },
  { type: 'eicr', expiry_date: future(180) },
  { type: 'epc', expiry_date: future(180) },
  { type: 'fire_alarm', expiry_date: future(180) },
];

const goodTenancy = {
  id: 't1',
  status: 'active',
  agreement_text: 'periodic tenancy with break clause',
  deposit_protection_scheme: 'mydeposits',
  deposit_protection_id: 'DP-12345',
};

const longRentHistory = [
  { tenancy_id: 't1', due_date: past(400), rent_amount: 1000 },
  { tenancy_id: 't1', due_date: past(30), rent_amount: 1000 },
];

describe('computeRRBScore', () => {
  it('(a) perfect score returns 100', () => {
    const r = computeRRBScore({
      tenancies: [goodTenancy],
      rentSchedule: longRentHistory,
      compliance: allCerts,
      hmo: { is_hmo: false },
      now: NOW,
    });
    expect(r.total).toBe(100);
    expect(r.subScores).toEqual({
      tenancyTerms: 20,
      depositProtection: 20,
      rentIncreases: 20,
      complianceCerts: 20,
      hmoLicence: 20,
    });
    expect(r.missingData).toEqual([]);
  });

  it('(b) missing deposit protection on one tenancy zeroes deposit sub-score', () => {
    const r = computeRRBScore({
      tenancies: [
        goodTenancy,
        { ...goodTenancy, id: 't2', deposit_protection_id: null },
      ],
      rentSchedule: longRentHistory,
      compliance: allCerts,
      hmo: { is_hmo: false },
      now: NOW,
    });
    expect(r.subScores.depositProtection).toBe(0);
    expect(r.missingData).toContain('missing deposit protection: tenancy t2');
  });

  it('(c) expired gas cert deducts 5', () => {
    const r = computeRRBScore({
      tenancies: [goodTenancy],
      rentSchedule: longRentHistory,
      compliance: [
        { type: 'gas', expiry_date: past(10) },
        ...allCerts.slice(1),
      ],
      hmo: { is_hmo: false },
      now: NOW,
    });
    expect(r.subScores.complianceCerts).toBe(15);
    expect(r.missingData.some((m) => m.includes('gas'))).toBe(true);
  });

  it('(d) fixed-term tenancy without break clause partially fails tenancyTerms', () => {
    const r = computeRRBScore({
      tenancies: [
        goodTenancy,
        { ...goodTenancy, id: 't2', agreement_text: 'fixed-term 12 months' },
      ],
      rentSchedule: longRentHistory,
      compliance: allCerts,
      hmo: { is_hmo: false },
      now: NOW,
    });
    expect(r.subScores.tenancyTerms).toBe(10);
    expect(r.subScores.tenancyTerms).toBeLessThan(20);
  });

  it('(e) <12 months rent history yields rent sub-score 10 and the insufficient rent history note', () => {
    const r = computeRRBScore({
      tenancies: [goodTenancy],
      rentSchedule: [
        { tenancy_id: 't1', due_date: past(60), rent_amount: 1000 },
        { tenancy_id: 't1', due_date: past(30), rent_amount: 1000 },
      ],
      compliance: allCerts,
      hmo: { is_hmo: false },
      now: NOW,
    });
    expect(r.subScores.rentIncreases).toBe(10);
    expect(r.missingData).toContain('insufficient rent history');
  });

  it('(f) non-HMO property gets full hmoLicence credit', () => {
    const r = computeRRBScore({
      tenancies: [goodTenancy],
      rentSchedule: longRentHistory,
      compliance: allCerts,
      hmo: { is_hmo: false },
      now: NOW,
    });
    expect(r.subScores.hmoLicence).toBe(20);
  });

  it('(g) a partially-failing property scores around 50', () => {
    const r = computeRRBScore({
      tenancies: [
        goodTenancy,
        { ...goodTenancy, id: 't2', agreement_text: 'fixed-term 12 months' },
      ],
      rentSchedule: [
        { tenancy_id: 't1', due_date: past(60), rent_amount: 1000 },
        { tenancy_id: 't1', due_date: past(30), rent_amount: 1000 },
      ],
      compliance: [
        { type: 'gas', expiry_date: past(10) },
        { type: 'epc', expiry_date: future(180) },
      ],
      hmo: { is_hmo: true, has_active_licence: false },
      now: NOW,
    });
    expect(r.total).toBeGreaterThanOrEqual(35);
    expect(r.total).toBeLessThanOrEqual(65);
    expect(r.missingData).toContain('missing HMO licence');
  });
});
