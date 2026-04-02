import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateAllEvents, type TenancyEvent } from '../tenancyLifecycle';

// ── Test Data Factories ─────────────────────────────────────────────────

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function makeTenancy(overrides: Partial<{
  id: string;
  start_date: string;
  initial_end_date: string | null;
  actual_end_date: string | null;
  break_clause_date: string | null;
  last_rent_review_date: string | null;
  status: string;
  rent_amount_pcm: number;
  is_periodic: boolean | null;
  tenant: { first_name: string; last_name: string } | null;
  room: { room_name: string; property: { id: string; address_line_1: string; city: string | null; postcode: string | null } | null } | null;
}> = {}) {
  return {
    id: 't-1',
    start_date: '2023-01-01',
    initial_end_date: null,
    actual_end_date: null,
    break_clause_date: null,
    last_rent_review_date: null,
    status: 'active',
    rent_amount_pcm: 800,
    is_periodic: false,
    tenant: { first_name: 'John', last_name: 'Doe' },
    room: {
      room_name: 'Room 1',
      property: { id: 'p-1', address_line_1: '1 Test Lane', city: 'London', postcode: 'SW1A 1AA' },
    },
    ...overrides,
  };
}

// ── calculateAllEvents ──────────────────────────────────────────────────

describe('calculateAllEvents', () => {
  // --- Null/empty inputs ---

  it('returns empty array for null input', () => {
    expect(calculateAllEvents(null)).toEqual([]);
  });

  it('returns empty array for empty array', () => {
    expect(calculateAllEvents([])).toEqual([]);
  });

  // --- Tenancy end events ---

  it('creates tenancy_end event for upcoming end date', () => {
    const tenancies = [makeTenancy({ initial_end_date: daysFromNow(30) })];
    const events = calculateAllEvents(tenancies);
    const endEvents = events.filter(e => e.type === 'tenancy_end');
    expect(endEvents).toHaveLength(1);
    expect(endEvents[0].daysUntil).toBeGreaterThanOrEqual(29);
    expect(endEvents[0].daysUntil).toBeLessThanOrEqual(30);
    expect(endEvents[0].status).toBe('action_required');
  });

  it('creates overdue tenancy_end event for past end date', () => {
    const tenancies = [makeTenancy({ initial_end_date: daysFromNow(-10) })];
    const events = calculateAllEvents(tenancies);
    const endEvents = events.filter(e => e.type === 'tenancy_end');
    expect(endEvents).toHaveLength(1);
    expect(endEvents[0].status).toBe('overdue');
    expect(endEvents[0].description).toContain('ended');
  });

  it('uses actual_end_date over initial_end_date', () => {
    const tenancies = [makeTenancy({
      initial_end_date: daysFromNow(60),
      actual_end_date: daysFromNow(30),
    })];
    const events = calculateAllEvents(tenancies);
    const endEvents = events.filter(e => e.type === 'tenancy_end');
    expect(endEvents).toHaveLength(1);
    expect(endEvents[0].daysUntil).toBeGreaterThanOrEqual(29);
    expect(endEvents[0].daysUntil).toBeLessThanOrEqual(30);
  });

  it('does not create tenancy_end for far future dates', () => {
    const tenancies = [makeTenancy({ initial_end_date: daysFromNow(200) })];
    const events = calculateAllEvents(tenancies, 90);
    const endEvents = events.filter(e => e.type === 'tenancy_end');
    expect(endEvents).toHaveLength(0);
  });

  it('does not create tenancy_end when no end date', () => {
    const tenancies = [makeTenancy({ initial_end_date: null, actual_end_date: null })];
    const events = calculateAllEvents(tenancies);
    const endEvents = events.filter(e => e.type === 'tenancy_end');
    expect(endEvents).toHaveLength(0);
  });

  it('assigns upcoming status for end dates > 60 days away but within horizon', () => {
    const tenancies = [makeTenancy({ initial_end_date: daysFromNow(80) })];
    const events = calculateAllEvents(tenancies);
    const endEvents = events.filter(e => e.type === 'tenancy_end');
    expect(endEvents).toHaveLength(1);
    expect(endEvents[0].status).toBe('upcoming');
  });

  // --- Break clause events ---

  it('creates break_clause event (notice deadline = 2 months before break)', () => {
    // Break date 80 days from now → notice deadline ~19 days from now
    const tenancies = [makeTenancy({ break_clause_date: daysFromNow(80) })];
    const events = calculateAllEvents(tenancies);
    const breakEvents = events.filter(e => e.type === 'break_clause');
    expect(breakEvents).toHaveLength(1);
    expect(breakEvents[0].title).toBe('Break clause notice deadline');
  });

  it('marks break clause as overdue when notice deadline has passed', () => {
    // Break date 30 days from now → notice deadline ~-30 days (already passed)
    const tenancies = [makeTenancy({ break_clause_date: daysFromNow(30) })];
    const events = calculateAllEvents(tenancies);
    const breakEvents = events.filter(e => e.type === 'break_clause');
    expect(breakEvents).toHaveLength(1);
    expect(breakEvents[0].status).toBe('overdue');
    expect(breakEvents[0].description).toContain('passed');
  });

  it('does not create break_clause when no break date', () => {
    const tenancies = [makeTenancy({ break_clause_date: null })];
    const events = calculateAllEvents(tenancies);
    const breakEvents = events.filter(e => e.type === 'break_clause');
    expect(breakEvents).toHaveLength(0);
  });

  // --- Rent review events ---

  it('creates rent_review event for active tenancy', () => {
    const tenancies = [makeTenancy({
      status: 'active',
      start_date: daysFromNow(-335), // ~30 days until 1 year anniversary
    })];
    const events = calculateAllEvents(tenancies, 90);
    const reviewEvents = events.filter(e => e.type === 'rent_review');
    expect(reviewEvents).toHaveLength(1);
    expect(reviewEvents[0].title).toBe('Rent review due');
  });

  it('creates rent_review for periodic tenancy', () => {
    const tenancies = [makeTenancy({
      status: 'periodic',
      start_date: daysFromNow(-335),
    })];
    const events = calculateAllEvents(tenancies, 90);
    const reviewEvents = events.filter(e => e.type === 'rent_review');
    expect(reviewEvents).toHaveLength(1);
  });

  it('does not create rent_review for ended tenancy', () => {
    const tenancies = [makeTenancy({
      status: 'ended',
      start_date: daysFromNow(-335),
    })];
    const events = calculateAllEvents(tenancies, 90);
    const reviewEvents = events.filter(e => e.type === 'rent_review');
    expect(reviewEvents).toHaveLength(0);
  });

  it('uses last_rent_review_date to calculate next review', () => {
    const tenancies = [makeTenancy({
      status: 'active',
      start_date: '2022-01-01',
      last_rent_review_date: daysFromNow(-340), // next review ~25 days away
    })];
    const events = calculateAllEvents(tenancies, 90);
    const reviewEvents = events.filter(e => e.type === 'rent_review');
    expect(reviewEvents).toHaveLength(1);
  });

  it('marks rent_review as overdue when past due', () => {
    const tenancies = [makeTenancy({
      status: 'active',
      last_rent_review_date: daysFromNow(-375), // 375 days ago, so review was 10 days ago
    })];
    const events = calculateAllEvents(tenancies, 90);
    const reviewEvents = events.filter(e => e.type === 'rent_review');
    expect(reviewEvents).toHaveLength(1);
    expect(reviewEvents[0].status).toBe('overdue');
  });

  // --- Metadata extraction ---

  it('extracts tenant name correctly', () => {
    const tenancies = [makeTenancy({
      initial_end_date: daysFromNow(30),
      tenant: { first_name: 'Jane', last_name: 'Smith' },
    })];
    const events = calculateAllEvents(tenancies);
    expect(events[0].tenantName).toBe('Jane Smith');
  });

  it('defaults to Unknown for null tenant', () => {
    const tenancies = [makeTenancy({
      initial_end_date: daysFromNow(30),
      tenant: null,
    })];
    const events = calculateAllEvents(tenancies);
    expect(events[0].tenantName).toBe('Unknown');
  });

  it('extracts property address correctly', () => {
    const tenancies = [makeTenancy({ initial_end_date: daysFromNow(30) })];
    const events = calculateAllEvents(tenancies);
    expect(events[0].propertyAddress).toBe('1 Test Lane, London');
  });

  it('handles missing city in address', () => {
    const tenancies = [makeTenancy({
      initial_end_date: daysFromNow(30),
      room: {
        room_name: 'Room 1',
        property: { id: 'p-1', address_line_1: '1 Test Lane', city: null, postcode: null },
      },
    })];
    const events = calculateAllEvents(tenancies);
    expect(events[0].propertyAddress).toBe('1 Test Lane');
  });

  it('defaults to Unknown when room/property is null', () => {
    const tenancies = [makeTenancy({
      initial_end_date: daysFromNow(30),
      room: null,
    })];
    const events = calculateAllEvents(tenancies);
    expect(events[0].propertyAddress).toBe('Unknown Property');
    expect(events[0].roomName).toBe('Unknown Room');
  });

  // --- Sorting ---

  it('sorts overdue events first', () => {
    const tenancies = [
      makeTenancy({ id: 't-1', initial_end_date: daysFromNow(30) }),
      makeTenancy({ id: 't-2', initial_end_date: daysFromNow(-5) }),
    ];
    const events = calculateAllEvents(tenancies);
    expect(events[0].status).toBe('overdue');
  });

  it('sorts remaining events by daysUntil ascending', () => {
    const tenancies = [
      makeTenancy({ id: 't-1', initial_end_date: daysFromNow(60) }),
      makeTenancy({ id: 't-2', initial_end_date: daysFromNow(10) }),
    ];
    const events = calculateAllEvents(tenancies);
    const nonOverdue = events.filter(e => e.status !== 'overdue');
    for (let i = 1; i < nonOverdue.length; i++) {
      expect(nonOverdue[i].daysUntil).toBeGreaterThanOrEqual(nonOverdue[i - 1].daysUntil);
    }
  });

  // --- daysAhead parameter ---

  it('respects custom daysAhead parameter', () => {
    const tenancies = [
      makeTenancy({ id: 't-1', initial_end_date: daysFromNow(30) }),
      makeTenancy({ id: 't-2', initial_end_date: daysFromNow(200) }),
    ];
    const events30 = calculateAllEvents(tenancies, 30);
    const events365 = calculateAllEvents(tenancies, 365);
    expect(events30.filter(e => e.type === 'tenancy_end')).toHaveLength(1);
    expect(events365.filter(e => e.type === 'tenancy_end')).toHaveLength(2);
  });

  // --- Multiple event types ---

  it('generates multiple event types for a single tenancy', () => {
    const tenancies = [makeTenancy({
      status: 'active',
      start_date: daysFromNow(-335),       // rent review ~30 days
      initial_end_date: daysFromNow(60),    // end in 60 days
      break_clause_date: daysFromNow(80),   // break notice ~20 days
    })];
    const events = calculateAllEvents(tenancies);
    const types = new Set(events.map(e => e.type));
    expect(types.has('tenancy_end')).toBe(true);
    expect(types.has('break_clause')).toBe(true);
    expect(types.has('rent_review')).toBe(true);
  });

  it('handles multiple tenancies', () => {
    const tenancies = [
      makeTenancy({ id: 't-1', initial_end_date: daysFromNow(30) }),
      makeTenancy({ id: 't-2', initial_end_date: daysFromNow(45) }),
      makeTenancy({ id: 't-3', initial_end_date: daysFromNow(60) }),
    ];
    const events = calculateAllEvents(tenancies);
    const endEvents = events.filter(e => e.type === 'tenancy_end');
    expect(endEvents).toHaveLength(3);
  });
});
