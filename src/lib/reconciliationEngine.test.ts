import { describe, it, expect } from 'vitest';
import {
  scoreMatch,
  findMatches,
  confidenceLabel,
  confidenceColor,
  confidenceBadgeClass,
} from './reconciliationEngine';
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

  it('boundary: 80 is High, 79 is Medium', () => {
    expect(confidenceLabel(80)).toBe('High');
    expect(confidenceLabel(79)).toBe('Medium');
  });

  it('boundary: 50 is Medium, 49 is Low', () => {
    expect(confidenceLabel(50)).toBe('Medium');
    expect(confidenceLabel(49)).toBe('Low');
  });
});

describe('confidenceColor / confidenceBadgeClass', () => {
  it('returns the success tokens for high scores', () => {
    expect(confidenceColor(90)).toBeTruthy();
    expect(confidenceBadgeClass(90)).toBeTruthy();
    // The two helpers share the same bucket logic — verify 80 boundary
    expect(confidenceColor(80)).toBe(confidenceColor(99));
    expect(confidenceBadgeClass(80)).toBe(confidenceBadgeClass(99));
  });

  it('returns the warning tokens for medium scores', () => {
    // 50-79 is its own bucket
    expect(confidenceColor(50)).toBe(confidenceColor(79));
    expect(confidenceColor(50)).not.toBe(confidenceColor(80));
  });

  it('returns the critical tokens for low scores', () => {
    // 0-49 share a bucket
    expect(confidenceColor(0)).toBe(confidenceColor(49));
    expect(confidenceColor(0)).not.toBe(confidenceColor(50));
  });
});

describe('scoreMatch — amount tiers', () => {
  it('awards 38 points for amounts within 1 penny (rounding)', () => {
    // Amount diff < 1 but > 0 → 38 points + other signals.
    // Use a combination that clears the 40-point floor via date + ref.
    const result = scoreMatch(
      { ...baseTxn, amount: 750.001 }, // diff = 0.001
      baseSchedule,
    );
    expect(result).not.toBeNull();
    expect(result!.matchReasons).toContain('amount_within_1p');
  });

  it('awards 25 points for amounts within 5% but > 1p', () => {
    const result = scoreMatch(
      { ...baseTxn, amount: 760 }, // diff 10 = ~1.3%
      baseSchedule,
    );
    expect(result).not.toBeNull();
    expect(result!.matchReasons).toContain('amount_within_5pct');
    expect(result!.matchReasons).not.toContain('exact_amount');
  });

  it('awards 10 points for a partial payment (50%-150% band) with non-amount signals', () => {
    // 50% partial: needs the non-amount floor override via reference/name
    const result = scoreMatch(
      { ...baseTxn, amount: 400 }, // diff pct > 5, within partial band
      baseSchedule,
    );
    expect(result).not.toBeNull();
    expect(result!.matchReasons).toContain('partial_amount');
  });

  it('rejects amounts outside the partial band entirely', () => {
    // 200% — outside the 50–150% partial band
    expect(
      scoreMatch({ ...baseTxn, amount: 1_600 }, baseSchedule),
    ).toBeNull();
  });

  it('records a negative amountDifference when paid short, positive when overpaid', () => {
    const short = scoreMatch({ ...baseTxn, amount: 745 }, baseSchedule);
    const over = scoreMatch({ ...baseTxn, amount: 755 }, baseSchedule);
    expect(short!.amountDifference).toBeLessThan(0);
    expect(over!.amountDifference).toBeGreaterThan(0);
  });

  it('adds additional_charges to the expected amount', () => {
    const schedule = {
      ...baseSchedule,
      rent_amount: 700,
      additional_charges: 50,
      amount_outstanding: 750, // matches rent + charges
    };
    const result = scoreMatch({ ...baseTxn, amount: 750 }, schedule);
    expect(result!.matchReasons).toContain('exact_amount');
    expect(result!.expectedAmount).toBe(750);
  });

  it('falls back to rent_amount + additional_charges when amount_outstanding is missing', () => {
    const schedule = {
      ...baseSchedule,
      rent_amount: 500,
      additional_charges: 50,
      amount_outstanding: 0,
    };
    const result = scoreMatch({ ...baseTxn, amount: 550 }, schedule);
    // outstanding=0 → expected = 550; diff = 0 → exact_amount
    expect(result).not.toBeNull();
    expect(result!.matchReasons).toContain('exact_amount');
  });
});

describe('scoreMatch — date tiers', () => {
  const baseTxnWithRef = { ...baseTxn }; // keep reference match so low date tiers can pass the 40-point floor

  it('awards 20 points for a date within 3 days', () => {
    const result = scoreMatch(
      { ...baseTxnWithRef, transaction_date: '2026-03-03' },
      baseSchedule,
    );
    expect(result!.matchReasons).toContain('date_within_3_days');
  });

  it('awards 12 points for a date within 7 days', () => {
    const result = scoreMatch(
      { ...baseTxnWithRef, transaction_date: '2026-03-05' },
      baseSchedule,
    );
    expect(result!.matchReasons).toContain('date_within_7_days');
  });

  it('awards 5 points for a date within 14 days', () => {
    const result = scoreMatch(
      { ...baseTxnWithRef, transaction_date: '2026-03-14' },
      baseSchedule,
    );
    expect(result!.matchReasons).toContain('date_within_14_days');
  });

  it('awards 2 points for a date within the month', () => {
    const result = scoreMatch(
      { ...baseTxnWithRef, transaction_date: '2026-03-28' },
      baseSchedule,
    );
    expect(result!.matchReasons).toContain('date_within_month');
  });

  it('awards no date points for a transaction > 31 days away', () => {
    const result = scoreMatch(
      { ...baseTxnWithRef, transaction_date: '2026-05-10' },
      baseSchedule,
    );
    // Still passes floor via reference (20) + exact_amount (40) = 60
    expect(result).not.toBeNull();
    expect(result!.matchReasons.some((r) => r.startsWith('date_'))).toBe(false);
  });
});

describe('scoreMatch — reference tiers', () => {
  it('awards 10 points for a partial reference match (last 6 chars)', () => {
    // payment_reference is "REF-ABC123", last 6 is "ABC123"
    const result = scoreMatch(
      {
        ...baseTxn,
        reference: null,
        description: 'some transfer containing abc123 within text',
      },
      baseSchedule,
    );
    expect(result).not.toBeNull();
    expect(result!.matchReasons).toContain('partial_reference');
    expect(result!.matchReasons).not.toContain('reference_match');
  });

  it('does not partial-match when the reference is too short', () => {
    const result = scoreMatch(
      { ...baseTxn, reference: null, description: 'nothing to see' },
      { ...baseSchedule, payment_reference: 'xyz' }, // 3 chars < 4-char threshold
    );
    // No ref signal, no name (since default John Smith isn't in the description), but score may still be exact_amount + exact_date = 65
    // But 65 > 60 doesn't require non-amount — wait, 65 >= 60 so the HMO guard doesn't kick in. So it should match.
    // The point is: matchReasons shouldn't include any reference reason.
    expect(result).not.toBeNull();
    expect(result!.matchReasons).not.toContain('reference_match');
    expect(result!.matchReasons).not.toContain('partial_reference');
  });

  it('falls back to description when reference is null', () => {
    const result = scoreMatch(
      { ...baseTxn, reference: null, description: 'transfer REF-ABC123 rent' },
      baseSchedule,
    );
    expect(result!.matchReasons).toContain('reference_match');
  });
});

describe('scoreMatch — tenant name tiers', () => {
  it('awards 8 points for surname-only match (not full name)', () => {
    const result = scoreMatch(
      { ...baseTxn, reference: null, description: 'TRANSFER FROM SMITH', transaction_date: '2026-03-05' },
      { ...baseSchedule, payment_reference: null, tenant_name: 'John Smith' },
    );
    expect(result).not.toBeNull();
    expect(result!.matchReasons).toContain('surname_in_desc');
    expect(result!.matchReasons).not.toContain('full_name_in_desc');
  });

  it('does not surname-match a single-name tenant (nameParts.length must be > 1)', () => {
    const result = scoreMatch(
      { ...baseTxn, reference: null, description: 'TRANSFER FROM MADONNA', transaction_date: '2026-03-05' },
      { ...baseSchedule, payment_reference: null, tenant_name: 'Madonna' },
    );
    // Full name matches "Madonna" since description contains it
    expect(result).not.toBeNull();
    expect(result!.matchReasons).toContain('full_name_in_desc');
  });

  it('handles missing tenant_name gracefully (no crash, no points)', () => {
    const result = scoreMatch(
      { ...baseTxn, description: 'payment', transaction_date: '2026-03-05' },
      { ...baseSchedule, tenant_name: undefined },
    );
    expect(result).not.toBeNull();
    expect(result!.matchReasons.some((r) => r.includes('name'))).toBe(false);
  });
});

describe('scoreMatch — HMO guard (40-point threshold with non-amount signal requirement)', () => {
  it('accepts a score of 40-59 ONLY when at least one non-amount signal is present', () => {
    // 38 (near-exact amount) + 5 (date_within_14_days) = 43; no ref, no name → should REJECT
    const result = scoreMatch(
      {
        ...baseTxn,
        amount: 750.001, // near-exact
        reference: null,
        description: 'BANK TRANSFER ONLY',
        transaction_date: '2026-03-12', // 11 days → 5 pts
      },
      { ...baseSchedule, payment_reference: null, tenant_name: undefined },
    );
    expect(result).toBeNull();
  });

  it('accepts the same score when a reference match adds a non-amount signal', () => {
    const result = scoreMatch(
      {
        ...baseTxn,
        amount: 750.001,
        reference: 'REF-ABC123',
        description: 'with ref',
        transaction_date: '2026-03-12',
      },
      baseSchedule, // keeps payment_reference = 'REF-ABC123'
    );
    expect(result).not.toBeNull();
    expect(result!.matchReasons).toContain('reference_match');
  });
});

describe('findMatches — greedy assignment', () => {
  it('pairs the best candidate; the loser reverts to its next-best schedule', () => {
    // One transaction, two schedules — schedule A is an exact match, B is partial.
    const schedules = [
      { ...baseSchedule, id: 'sched-a' }, // exact match
      {
        ...baseSchedule,
        id: 'sched-b',
        rent_amount: 750,
        amount_outstanding: 750,
        due_date: '2026-03-01',
        payment_reference: 'OTHER',
      },
    ];
    const matches = findMatches([baseTxn], schedules);
    // The one txn binds to sched-a (the stronger match)
    expect(matches).toHaveLength(1);
    expect(matches[0].scheduleId).toBe('sched-a');
  });

  it('does not reuse a transaction across multiple schedule items', () => {
    const schedules = [
      { ...baseSchedule, id: 'sched-a' },
      { ...baseSchedule, id: 'sched-b' },
    ];
    const matches = findMatches([baseTxn], schedules);
    expect(matches).toHaveLength(1);
  });

  it('skips non-unmatched transactions entirely', () => {
    const matches = findMatches(
      [{ ...baseTxn, status: 'matched' }],
      [baseSchedule],
    );
    expect(matches).toHaveLength(0);
  });

  it('skips non-positive transactions entirely', () => {
    const matches = findMatches(
      [{ ...baseTxn, amount: 0 }, { ...baseTxn, id: 'txn-neg', amount: -50 }],
      [baseSchedule],
    );
    expect(matches).toHaveLength(0);
  });

  it('returns matches sorted by confidence (highest first)', () => {
    const txns: BankTxn[] = [
      { ...baseTxn, id: 'txn-weak', amount: 400, description: 'John Smith', reference: null, transaction_date: '2026-03-08' },
      { ...baseTxn, id: 'txn-strong' }, // exact match
    ];
    const schedules = [
      { ...baseSchedule, id: 'sched-a' },
      { ...baseSchedule, id: 'sched-b', rent_amount: 400, amount_outstanding: 400 },
    ];
    const matches = findMatches(txns, schedules);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // Strong (exact) match must rank above the weak partial match.
    expect(matches[0].transactionId).toBe('txn-strong');
  });

  it('considers only open schedule statuses (due, overdue, partial, upcoming)', () => {
    const schedules: typeof baseSchedule[] = [
      { ...baseSchedule, id: 'sched-paid', status: 'paid' as const },
      { ...baseSchedule, id: 'sched-bad', status: 'bad_debt' as const },
      { ...baseSchedule, id: 'sched-due', status: 'due' as const },
    ];
    const matches = findMatches([baseTxn], schedules);
    expect(matches).toHaveLength(1);
    expect(matches[0].scheduleId).toBe('sched-due');
  });
});
