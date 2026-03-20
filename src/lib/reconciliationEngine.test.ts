import { describe, it, expect } from 'vitest';
import { scoreMatch, findMatches, confidenceLabel } from './reconciliationEngine';
import type { BankTxn } from './reconciliationEngine';
import type { RentScheduleItem } from '@/hooks/useRentCollection';

const baseTxn: BankTxn = {
  id: 'txn-1',
  transaction_date: '2026-03-01',
  description: 'BANK TRANSFER REF-ABC123',
  amount: 750,
  reference: 'REF-ABC123',
  status: 'unmatched',
};

const baseSchedule: RentScheduleItem & { tenant_name?: string; payment_reference?: string | null } = {
  id: 'sched-1',
  org_id: 'org-1',
  tenancy_id: 't-1',
  agreement_id: null,
  due_date: '2026-03-01',
  period_start: '2026-03-01',
  period_end: '2026-03-31',
  rent_amount: 750,
  additional_charges: 0,
  amount_paid: 0,
  amount_outstanding: 750,
  status: 'due',
  reminder_sent_at: null,
  warning_sent_at: null,
  notes: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  tenant_name: 'John Smith',
  payment_reference: 'REF-ABC123',
};

describe('scoreMatch', () => {
  it('returns high confidence for exact amount + date + reference', () => {
    const result = scoreMatch(baseTxn, baseSchedule);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(80);
    expect(result!.matchReasons).toContain('exact_amount');
    expect(result!.matchReasons).toContain('exact_date');
    expect(result!.matchReasons).toContain('reference_match');
  });

  it('returns null for negative amounts', () => {
    expect(scoreMatch({ ...baseTxn, amount: -100 }, baseSchedule)).toBeNull();
  });

  it('returns null for already matched transactions', () => {
    expect(scoreMatch({ ...baseTxn, status: 'matched' }, baseSchedule)).toBeNull();
  });

  it('returns null when amount is wildly different', () => {
    expect(scoreMatch({ ...baseTxn, amount: 5000 }, baseSchedule)).toBeNull();
  });

  it('rejects low-score matches with only amount signal (HMO guard)', () => {
    const result = scoreMatch(
      { ...baseTxn, reference: null, description: 'PAYMENT', transaction_date: '2026-04-15' },
      { ...baseSchedule, tenant_name: undefined, payment_reference: null }
    );
    expect(result).toBeNull();
  });

  it('accepts moderate score when tenant name is present', () => {
    const result = scoreMatch(
      { ...baseTxn, reference: null, description: 'John Smith rent', transaction_date: '2026-03-05' },
      { ...baseSchedule, payment_reference: null }
    );
    expect(result).not.toBeNull();
    expect(result!.matchReasons).toContain('full_name_in_desc');
  });
});

describe('findMatches', () => {
  it('returns greedy 1:1 matches sorted by confidence', () => {
    const txns: BankTxn[] = [
      { ...baseTxn, id: 'txn-1', amount: 750 },
      { ...baseTxn, id: 'txn-2', amount: 600, reference: null, description: 'OTHER' },
    ];
    const schedules = [
      { ...baseSchedule, id: 'sched-1' },
      { ...baseSchedule, id: 'sched-2', rent_amount: 600, amount_outstanding: 600, payment_reference: null, tenant_name: undefined },
    ];
    const matches = findMatches(txns, schedules);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].transactionId).toBe('txn-1');
    expect(matches[0].scheduleId).toBe('sched-1');
  });

  it('skips non-open schedule items', () => {
    const matches = findMatches(
      [baseTxn],
      [{ ...baseSchedule, status: 'paid' }]
    );
    expect(matches).toHaveLength(0);
  });
});

describe('confidenceLabel', () => {
  it('returns High for >= 80', () => expect(confidenceLabel(85)).toBe('High'));
  it('returns Medium for 50-79', () => expect(confidenceLabel(60)).toBe('Medium'));
  it('returns Low for < 50', () => expect(confidenceLabel(30)).toBe('Low'));
});
