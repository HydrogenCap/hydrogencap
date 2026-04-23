import { describe, it, expect } from 'vitest';
import {
  isWorkingDay,
  addWorkingDays,
  addHours,
  workingDaysRemaining,
  hoursRemaining,
  formatCountdown,
  getDeadlineSeverity,
  DEADLINE_SEVERITY_STYLES,
} from './working-days';

// Use local-time constructor (Y, M, D) — module builds its holiday set from
// `new Date('YYYY-MM-DDT00:00:00').toDateString()`, which is local-time based.

describe('isWorkingDay', () => {
  it('returns true for a regular weekday', () => {
    expect(isWorkingDay(new Date(2026, 5, 17))).toBe(true); // Wed 17 Jun 2026
  });

  it('returns false for Saturday', () => {
    expect(isWorkingDay(new Date(2026, 5, 20))).toBe(false); // Sat
  });

  it('returns false for Sunday', () => {
    expect(isWorkingDay(new Date(2026, 5, 21))).toBe(false); // Sun
  });

  it('returns false for New Year\'s Day (bank holiday)', () => {
    expect(isWorkingDay(new Date(2026, 0, 1))).toBe(false); // 1 Jan 2026
  });

  it('returns false for a bank holiday that falls on a weekday (Good Friday 2026)', () => {
    expect(isWorkingDay(new Date(2026, 3, 3))).toBe(false); // 3 Apr 2026
  });
});

describe('addWorkingDays', () => {
  it('adds a single working day forward', () => {
    const mon = new Date(2026, 5, 15); // Mon
    const result = addWorkingDays(mon, 1);
    expect(result.toDateString()).toBe(new Date(2026, 5, 16).toDateString()); // Tue
  });

  it('skips Saturday and Sunday when crossing a weekend', () => {
    const fri = new Date(2026, 5, 19); // Fri
    const result = addWorkingDays(fri, 1);
    expect(result.toDateString()).toBe(new Date(2026, 5, 22).toDateString()); // Mon
  });

  it('skips over a bank holiday', () => {
    // 3 Apr 2026 is Good Friday (Fri). Thu 2 Apr + 1 working day → Tue 7 Apr
    // (because 3 Apr bank holiday, 4/5 Apr weekend, 6 Apr Easter Monday — also a bank holiday)
    const thu = new Date(2026, 3, 2); // Thu 2 Apr
    const result = addWorkingDays(thu, 1);
    expect(result.toDateString()).toBe(new Date(2026, 3, 7).toDateString());
  });

  it('accumulates across multiple weekends', () => {
    // Fri 19 Jun + 6 working days → Mon 29 Jun (skipping 2 weekends)
    const fri = new Date(2026, 5, 19);
    const result = addWorkingDays(fri, 6);
    expect(result.toDateString()).toBe(new Date(2026, 5, 29).toDateString());
  });

  it('returns the start date when 0 working days added', () => {
    const mon = new Date(2026, 5, 15);
    const result = addWorkingDays(mon, 0);
    // Same calendar date (loop never runs).
    expect(result.toDateString()).toBe(mon.toDateString());
  });
});

describe('addHours', () => {
  it('adds positive hours', () => {
    const base = new Date('2025-06-15T10:00:00Z');
    const result = addHours(base, 5);
    expect(result.toISOString()).toBe('2025-06-15T15:00:00.000Z');
  });

  it('accepts fractional hours', () => {
    const base = new Date('2025-06-15T10:00:00Z');
    const result = addHours(base, 0.5);
    expect(result.toISOString()).toBe('2025-06-15T10:30:00.000Z');
  });

  it('accepts negative hours (goes backwards)', () => {
    const base = new Date('2025-06-15T10:00:00Z');
    const result = addHours(base, -2);
    expect(result.toISOString()).toBe('2025-06-15T08:00:00.000Z');
  });
});

describe('workingDaysRemaining', () => {
  it('returns a positive count for a future deadline', () => {
    const from = new Date(2026, 5, 15); // Mon 15 Jun
    const deadline = new Date(2026, 5, 22); // Mon 22 Jun
    // Mon→Fri = 5 working days (Tue, Wed, Thu, Fri, Mon)
    expect(workingDaysRemaining(deadline, from)).toBe(5);
  });

  it('returns 0 when deadline is exactly now', () => {
    const now = new Date(2026, 5, 15, 12, 0, 0);
    expect(workingDaysRemaining(now, now)).toBe(0);
  });

  it('returns a negative count when overdue', () => {
    const deadline = new Date(2026, 5, 15); // Mon
    const from = new Date(2026, 5, 18); // Thu
    // Tue, Wed, Thu = 3 working days overdue → -3
    expect(workingDaysRemaining(deadline, from)).toBe(-3);
  });

  it('skips weekends when counting overdue days', () => {
    const deadline = new Date(2026, 5, 19); // Fri
    const from = new Date(2026, 5, 23); // Tue
    // Sat, Sun skipped → Mon, Tue = 2 working days overdue → -2
    expect(workingDaysRemaining(deadline, from)).toBe(-2);
  });
});

describe('hoursRemaining', () => {
  it('returns positive hours until the deadline', () => {
    const from = new Date('2025-06-15T10:00:00Z');
    const deadline = new Date('2025-06-15T15:30:00Z');
    expect(hoursRemaining(deadline, from)).toBeCloseTo(5.5, 2);
  });

  it('returns negative hours when overdue', () => {
    const from = new Date('2025-06-15T15:00:00Z');
    const deadline = new Date('2025-06-15T13:00:00Z');
    expect(hoursRemaining(deadline, from)).toBe(-2);
  });
});

describe('formatCountdown', () => {
  it('formats a short future window as "Xh Ym"', () => {
    const from = new Date('2025-06-15T10:00:00Z');
    const deadline = new Date('2025-06-15T12:30:00Z');
    expect(formatCountdown(deadline, from)).toBe('2h 30m');
  });

  it('caps the hour-granular format at < 48h', () => {
    const from = new Date('2025-06-15T10:00:00Z');
    const deadline = new Date('2025-06-15T58:00:00Z'); // 48h later
    // 48h is not < 48, so switches to working-days format.
    expect(formatCountdown(deadline, from)).not.toMatch(/^\d+h \d+m$/);
  });

  it('formats a long window in working days', () => {
    const from = new Date(2026, 5, 15, 10, 0, 0); // Mon 10am
    const deadline = new Date(2026, 5, 22, 10, 0, 0); // Mon +7 calendar days
    // 5 working days (Tue, Wed, Thu, Fri, Mon) → "5 working days"
    expect(formatCountdown(deadline, from)).toBe('5 working days');
  });

  it('uses singular "working day" when exactly 1', () => {
    const from = new Date(2026, 5, 15, 10, 0, 0); // Mon
    const deadline = new Date(2026, 5, 17, 10, 0, 0); // Wed — 48h exactly, but let's push it past 48
    // Actually 48h isn't < 48, so this uses working-days. Mon→Wed = 2 working days.
    expect(formatCountdown(deadline, from)).toBe('2 working days');
  });

  it('formats overdue < 1 working day as "Xh overdue"', () => {
    // Deadline 2h ago on a Friday evening; "tomorrow" is Saturday (not a
    // working day) so workingDaysRemaining counts 0 → the "Xh overdue"
    // branch fires.
    const deadline = new Date(2026, 5, 19, 15, 0, 0); // Fri 19 Jun 2026, 15:00
    const from = new Date(2026, 5, 19, 17, 0, 0); // Fri 17:00 (2h later)
    expect(formatCountdown(deadline, from)).toBe('2h overdue');
  });

  it('formats multi-working-day overdue correctly', () => {
    const deadline = new Date(2026, 5, 15, 12, 0, 0); // Mon 15 Jun noon
    const from = new Date(2026, 5, 18, 12, 0, 0); // Thu 18 Jun noon
    // Tue, Wed, Thu = 3 working days overdue.
    expect(formatCountdown(deadline, from)).toBe('3 working days overdue');
  });

  it('uses singular "working day overdue" for exactly 1', () => {
    const deadline = new Date(2026, 5, 15, 12, 0, 0); // Mon
    const from = new Date(2026, 5, 16, 12, 0, 0); // Tue (24h later, but Tue is a full working day)
    expect(formatCountdown(deadline, from)).toBe('1 working day overdue');
  });
});

describe('getDeadlineSeverity', () => {
  it('returns "overdue" when now is past the deadline', () => {
    const start = new Date(2026, 5, 10);
    const deadline = new Date(2026, 5, 15);
    const now = new Date(2026, 5, 20);
    expect(getDeadlineSeverity(deadline, start, now)).toBe('overdue');
  });

  it('returns "safe" in the first half of the window', () => {
    const start = new Date(2026, 5, 1);
    const deadline = new Date(2026, 5, 11); // 10-day window
    const now = new Date(2026, 5, 3); // 20% elapsed → 80% remaining
    expect(getDeadlineSeverity(deadline, start, now)).toBe('safe');
  });

  it('returns "warning" between 50–75% elapsed', () => {
    const start = new Date(2026, 5, 1);
    const deadline = new Date(2026, 5, 11);
    const now = new Date(2026, 5, 7); // 60% elapsed → 40% remaining
    expect(getDeadlineSeverity(deadline, start, now)).toBe('warning');
  });

  it('returns "critical" in the last 25% of the window', () => {
    const start = new Date(2026, 5, 1);
    const deadline = new Date(2026, 5, 11);
    const now = new Date(2026, 5, 10); // 90% elapsed → 10% remaining
    expect(getDeadlineSeverity(deadline, start, now)).toBe('critical');
  });

  it('boundary: exactly 25% remaining is critical', () => {
    const start = new Date(2026, 5, 1);
    const deadline = new Date(2026, 5, 11); // 10 days
    const now = new Date(2026, 5, 8, 12, 0, 0); // 75% elapsed exactly → 25% remaining
    expect(getDeadlineSeverity(deadline, start, now)).toBe('critical');
  });

  it('boundary: exactly 50% remaining is warning (not safe)', () => {
    const start = new Date(2026, 5, 1);
    const deadline = new Date(2026, 5, 11);
    const now = new Date(2026, 5, 6); // 50% elapsed → 50% remaining
    expect(getDeadlineSeverity(deadline, start, now)).toBe('warning');
  });
});

describe('DEADLINE_SEVERITY_STYLES', () => {
  it('exports a non-empty CSS class string for every severity', () => {
    expect(DEADLINE_SEVERITY_STYLES.safe).toBeTruthy();
    expect(DEADLINE_SEVERITY_STYLES.warning).toBeTruthy();
    expect(DEADLINE_SEVERITY_STYLES.critical).toBeTruthy();
    expect(DEADLINE_SEVERITY_STYLES.overdue).toBeTruthy();
  });
});
