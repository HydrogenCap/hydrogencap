import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getComplianceStatus, getComplianceStatusColor, formatComplianceDate } from './complianceStatus';

describe('getComplianceStatus', () => {
  beforeEach(() => {
    // Fix current date to 2026-02-09 for predictable tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-09'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns unknown for null date', () => {
    const result = getComplianceStatus(null);
    expect(result.status).toBe('unknown');
    expect(result.daysUntilDue).toBeNull();
  });

  it('returns overdue for past dates', () => {
    const result = getComplianceStatus('2026-02-01');
    expect(result.status).toBe('overdue');
    expect(result.daysUntilDue).toBeLessThan(0);
    expect(result.label).toContain('overdue');
  });

  it('returns due_soon for dates within 30 days', () => {
    const result = getComplianceStatus('2026-02-20');
    expect(result.status).toBe('due_soon');
    expect(result.daysUntilDue).toBe(11);
    expect(result.label).toContain('11 days');
  });

  it('returns due_soon with "Due today" for today', () => {
    const result = getComplianceStatus('2026-02-09');
    expect(result.status).toBe('due_soon');
    expect(result.daysUntilDue).toBe(0);
    expect(result.label).toBe('Due today');
  });

  it('returns ok for dates more than 30 days out', () => {
    const result = getComplianceStatus('2026-06-01');
    expect(result.status).toBe('ok');
    expect(result.daysUntilDue).toBeGreaterThan(30);
  });
});

describe('getComplianceStatusColor', () => {
  it('returns red classes for overdue', () => {
    expect(getComplianceStatusColor('overdue')).toContain('red');
  });

  it('returns amber classes for due_soon', () => {
    expect(getComplianceStatusColor('due_soon')).toContain('amber');
  });

  it('returns green classes for ok', () => {
    expect(getComplianceStatusColor('ok')).toContain('green');
  });

  it('returns muted classes for unknown', () => {
    expect(getComplianceStatusColor('unknown')).toContain('muted');
  });
});

describe('formatComplianceDate', () => {
  it('formats date in UK short format', () => {
    const result = formatComplianceDate('2026-03-15');
    expect(result).toMatch(/15 Mar 2026/);
  });

  it('handles null', () => {
    expect(formatComplianceDate(null)).toBe('—');
  });
});
