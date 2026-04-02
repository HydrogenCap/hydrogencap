import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateAllEvents } from '../tenancyLifecycle';

const NOW = new Date('2025-06-15T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeTenancy(overrides = {}) {
  return {
    id: 't-1',
    start_date: '2024-06-15',
    initial_end_date: '2025-06-15',
    actual_end_date: null,
    break_clause_date: null,
    last_rent_review_date: null,
    status: 'active',
    rent_amount_pcm: 1000,
    is_periodic: false,
    tenant: { first_name: 'John', last_name: 'Doe' },
    room: {
      room_name: 'Room A',
      property: { id: 'prop-1', address_line_1: '1 Test St', city: 'London', postcode: 'SW1' },
    },
    ...overrides,
  };
}

describe('calculateAllEvents', () => {
  it('returns empty array for null input', () => {
    expect(calculateAllEvents(null)).toEqual([]);
  });

  it('returns empty array for empty array', () => {
    expect(calculateAllEvents([])).toEqual([]);
  });

  // Tenancy end events
  describe('tenancy end events', () => {
    it('creates event for upcoming end date', () => {
      const t = makeTenancy({ initial_end_date: '2025-07-01' });
      const events = calculateAllEvents([t]);
      const endEvent = events.find(e => e.type === 'tenancy_end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.date).toBe('2025-07-01');
      expect(endEvent!.status).toBe('action_required');
      expect(endEvent!.tenantName).toBe('John Doe');
    });

    it('creates overdue event for past end date', () => {
      const t = makeTenancy({ initial_end_date: '2025-06-01' });
      const events = calculateAllEvents([t]);
      const endEvent = events.find(e => e.type === 'tenancy_end');
      expect(endEvent).toBeDefined();
      expect(endEvent!.status).toBe('overdue');
      expect(endEvent!.daysUntil).toBeLessThan(0);
    });

    it('prefers actual_end_date over initial_end_date', () => {
      const t = makeTenancy({
        initial_end_date: '2025-12-01',
        actual_end_date: '2025-07-15',
      });
      const events = calculateAllEvents([t]);
      const endEvent = events.find(e => e.type === 'tenancy_end');
      expect(endEvent!.date).toBe('2025-07-15');
    });

    it('skips tenancy end beyond daysAhead window', () => {
      const t = makeTenancy({ initial_end_date: '2026-06-01' });
      const events = calculateAllEvents([t], 90);
      const endEvent = events.find(e => e.type === 'tenancy_end');
      expect(endEvent).toBeUndefined();
    });
  });

  // Break clause events
  describe('break clause events', () => {
    it('creates event for break clause notice deadline', () => {
      const t = makeTenancy({ break_clause_date: '2025-09-01' });
      const events = calculateAllEvents([t]);
      const breakEvent = events.find(e => e.type === 'break_clause');
      expect(breakEvent).toBeDefined();
      // Notice deadline = 2 months before break = 2025-07-01
      expect(breakEvent!.date).toBe('2025-07-01');
    });

    it('marks break clause as overdue if notice deadline passed', () => {
      const t = makeTenancy({ break_clause_date: '2025-07-01' });
      const events = calculateAllEvents([t]);
      const breakEvent = events.find(e => e.type === 'break_clause');
      expect(breakEvent).toBeDefined();
      expect(breakEvent!.status).toBe('overdue');
    });
  });

  // Rent review events
  describe('rent review events', () => {
    it('creates rent review event for active tenancy within window', () => {
      // Started 2024-08-01, anniversary = 2025-08-01 → 47 days from now (within 90-day window)
      const t = makeTenancy({ status: 'active', start_date: '2024-08-01' });
      const events = calculateAllEvents([t]);
      const review = events.find(e => e.type === 'rent_review');
      expect(review).toBeDefined();
      expect(review!.type).toBe('rent_review');
    });

    it('uses last_rent_review_date + 1 year if set (within window)', () => {
      // last review on 2024-07-01, next = 2025-07-01 → 16 days from now
      const t = makeTenancy({
        status: 'active',
        start_date: '2022-01-01',
        last_rent_review_date: '2024-07-01',
      });
      const events = calculateAllEvents([t]);
      const review = events.find(e => e.type === 'rent_review');
      expect(review).toBeDefined();
      expect(review!.date).toBe('2025-07-01');
    });

    it('skips rent review for non-active tenancies', () => {
      const t = makeTenancy({ status: 'ended' });
      const events = calculateAllEvents([t]);
      const review = events.find(e => e.type === 'rent_review');
      expect(review).toBeUndefined();
    });

    it('creates rent review for periodic tenancy', () => {
      // Started 2024-08-01, anniversary = 2025-08-01 → 47 days from now
      const t = makeTenancy({ status: 'periodic', start_date: '2024-08-01' });
      const events = calculateAllEvents([t]);
      const review = events.find(e => e.type === 'rent_review');
      expect(review).toBeDefined();
    });
  });

  // Sorting
  describe('sorting', () => {
    it('sorts overdue events first', () => {
      const tenancies = [
        makeTenancy({ id: 't1', initial_end_date: '2025-07-30' }),
        makeTenancy({ id: 't2', initial_end_date: '2025-05-01' }),
      ];
      const events = calculateAllEvents(tenancies);
      const endEvents = events.filter(e => e.type === 'tenancy_end');
      if (endEvents.length >= 2) {
        expect(endEvents[0].status).toBe('overdue');
      }
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('handles missing tenant gracefully', () => {
      const t = makeTenancy({ tenant: null });
      const events = calculateAllEvents([t]);
      const endEvent = events.find(e => e.type === 'tenancy_end');
      expect(endEvent?.tenantName).toBe('Unknown');
    });

    it('handles missing room gracefully', () => {
      const t = makeTenancy({ room: null });
      const events = calculateAllEvents([t]);
      const endEvent = events.find(e => e.type === 'tenancy_end');
      expect(endEvent?.roomName).toBe('Unknown Room');
      expect(endEvent?.propertyAddress).toBe('Unknown Property');
    });

    it('handles missing property on room', () => {
      const t = makeTenancy({ room: { room_name: 'Room B', property: null } });
      const events = calculateAllEvents([t]);
      const endEvent = events.find(e => e.type === 'tenancy_end');
      expect(endEvent?.propertyAddress).toBe('Unknown Property');
    });
  });
});
