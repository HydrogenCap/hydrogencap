import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectVoidRooms, type DetectedVoid } from '../voidDetection';

// ── Test Data Factories ─────────────────────────────────────────────────

function makeRoom(overrides: Partial<{
  id: string; property_id: string; room_name: string;
  is_lettable: boolean; occupancy_status: string | null; current_rent_pcm: number | null;
}> = {}) {
  return {
    id: 'room-1',
    property_id: 'prop-1',
    room_name: 'Room 1',
    is_lettable: true,
    occupancy_status: 'vacant',
    current_rent_pcm: 650,
    ...overrides,
  };
}

function makeTenancy(overrides: Partial<{
  room_id: string; status: string; start_date: string; actual_end_date: string | null;
}> = {}) {
  const today = new Date().toISOString().split('T')[0];
  return {
    room_id: 'room-1',
    status: 'active',
    start_date: '2024-01-01',
    actual_end_date: null,
    ...overrides,
  };
}

function makeVoidPeriod(overrides: Partial<{
  property_id: string; room_id: string | null; end_date: string | null;
}> = {}) {
  return {
    property_id: 'prop-1',
    room_id: 'room-1',
    end_date: null,
    ...overrides,
  };
}

const PROPERTIES = [
  { id: 'prop-1', address_line_1: '1 Test Lane', postcode: 'SW1A 1AA' },
  { id: 'prop-2', address_line_1: '2 Test Lane', postcode: 'EC1A 1BB' },
];

// ── detectVoidRooms ─────────────────────────────────────────────────────

describe('detectVoidRooms', () => {
  it('detects a void room with no active tenancy and no void period', () => {
    const rooms = [makeRoom()];
    const result = detectVoidRooms(rooms, [], [], PROPERTIES);
    expect(result).toHaveLength(1);
    expect(result[0].roomId).toBe('room-1');
    expect(result[0].roomName).toBe('Room 1');
    expect(result[0].propertyId).toBe('prop-1');
    expect(result[0].propertyAddress).toBe('1 Test Lane, SW1A 1AA');
    expect(result[0].currentRentPcm).toBe(650);
  });

  it('excludes rooms with active tenancy', () => {
    const rooms = [makeRoom()];
    const tenancies = [makeTenancy({ room_id: 'room-1', status: 'active' })];
    const result = detectVoidRooms(rooms, tenancies, [], PROPERTIES);
    expect(result).toHaveLength(0);
  });

  it('excludes rooms with periodic tenancy', () => {
    const rooms = [makeRoom()];
    const tenancies = [makeTenancy({ room_id: 'room-1', status: 'periodic' })];
    const result = detectVoidRooms(rooms, tenancies, [], PROPERTIES);
    expect(result).toHaveLength(0);
  });

  it('excludes rooms with notice_served tenancy', () => {
    const rooms = [makeRoom()];
    const tenancies = [makeTenancy({ room_id: 'room-1', status: 'notice_served' })];
    const result = detectVoidRooms(rooms, tenancies, [], PROPERTIES);
    expect(result).toHaveLength(0);
  });

  it('excludes rooms with notice_period tenancy', () => {
    const rooms = [makeRoom()];
    const tenancies = [makeTenancy({ room_id: 'room-1', status: 'notice_period' })];
    const result = detectVoidRooms(rooms, tenancies, [], PROPERTIES);
    expect(result).toHaveLength(0);
  });

  it('includes rooms where tenancy has ended (actual_end_date in past)', () => {
    const rooms = [makeRoom()];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tenancies = [makeTenancy({
      room_id: 'room-1', status: 'active',
      actual_end_date: yesterday.toISOString().split('T')[0],
    })];
    const result = detectVoidRooms(rooms, tenancies, [], PROPERTIES);
    expect(result).toHaveLength(1);
  });

  it('excludes rooms with existing open void period', () => {
    const rooms = [makeRoom()];
    const voids = [makeVoidPeriod({ room_id: 'room-1', end_date: null })];
    const result = detectVoidRooms(rooms, [], voids, PROPERTIES);
    expect(result).toHaveLength(0);
  });

  it('includes rooms where void period has ended', () => {
    const rooms = [makeRoom()];
    const voids = [makeVoidPeriod({ room_id: 'room-1', end_date: '2024-01-01' })];
    const result = detectVoidRooms(rooms, [], voids, PROPERTIES);
    expect(result).toHaveLength(1);
  });

  it('excludes non-lettable rooms', () => {
    const rooms = [makeRoom({ is_lettable: false })];
    const result = detectVoidRooms(rooms, [], [], PROPERTIES);
    expect(result).toHaveLength(0);
  });

  it('handles property-level void period (room_id is null)', () => {
    const rooms = [makeRoom({ id: 'room-1', property_id: 'prop-1' })];
    const voids = [makeVoidPeriod({ property_id: 'prop-1', room_id: null, end_date: null })];
    const result = detectVoidRooms(rooms, [], voids, PROPERTIES);
    expect(result).toHaveLength(0);
  });

  it('detects voids across multiple rooms', () => {
    const rooms = [
      makeRoom({ id: 'room-1', room_name: 'Room 1' }),
      makeRoom({ id: 'room-2', room_name: 'Room 2' }),
      makeRoom({ id: 'room-3', room_name: 'Room 3' }),
    ];
    const tenancies = [makeTenancy({ room_id: 'room-2', status: 'active' })];
    const result = detectVoidRooms(rooms, tenancies, [], PROPERTIES);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.roomId).sort()).toEqual(['room-1', 'room-3']);
  });

  it('handles rooms from different properties', () => {
    const rooms = [
      makeRoom({ id: 'room-1', property_id: 'prop-1' }),
      makeRoom({ id: 'room-2', property_id: 'prop-2' }),
    ];
    const result = detectVoidRooms(rooms, [], [], PROPERTIES);
    expect(result).toHaveLength(2);
    expect(result[0].propertyAddress).toContain('1 Test Lane');
    expect(result[1].propertyAddress).toContain('2 Test Lane');
  });

  it('handles unknown property gracefully', () => {
    const rooms = [makeRoom({ property_id: 'unknown-prop' })];
    const result = detectVoidRooms(rooms, [], [], PROPERTIES);
    expect(result).toHaveLength(1);
    expect(result[0].propertyAddress).toBe('Unknown');
  });

  it('handles empty rooms array', () => {
    const result = detectVoidRooms([], [], [], PROPERTIES);
    expect(result).toHaveLength(0);
  });

  it('handles null current_rent_pcm', () => {
    const rooms = [makeRoom({ current_rent_pcm: null })];
    const result = detectVoidRooms(rooms, [], [], PROPERTIES);
    expect(result).toHaveLength(1);
    expect(result[0].currentRentPcm).toBeNull();
  });

  it('does not count ended tenancy with status other than active statuses', () => {
    const rooms = [makeRoom()];
    const tenancies = [makeTenancy({ room_id: 'room-1', status: 'ended' })];
    const result = detectVoidRooms(rooms, tenancies, [], PROPERTIES);
    expect(result).toHaveLength(1);
  });

  it('handles tenancy starting in the future', () => {
    const rooms = [makeRoom()];
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const tenancies = [makeTenancy({
      room_id: 'room-1', status: 'active',
      start_date: futureDate.toISOString().split('T')[0],
    })];
    const result = detectVoidRooms(rooms, tenancies, [], PROPERTIES);
    // Future tenancy start_date > today, so condition start_date <= today is false
    expect(result).toHaveLength(1);
  });

  it('handles multiple tenancies on same room (only one active)', () => {
    const rooms = [makeRoom()];
    const tenancies = [
      makeTenancy({ room_id: 'room-1', status: 'ended', actual_end_date: '2023-06-01' }),
      makeTenancy({ room_id: 'room-1', status: 'active', start_date: '2024-01-01' }),
    ];
    const result = detectVoidRooms(rooms, tenancies, [], PROPERTIES);
    expect(result).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Part 2: void-calculator.ts module tests (new module)
// ══════════════════════════════════════════════════════════════════════

import {
  calculateVoidDays,
  calculateVoidCost,
  calculatePortfolioVoidRate,
  calculatePortfolioVoidSummary,
  estimateAnnualVoidCost,
  type VoidPeriod,
  type MonthlyHoldingCosts,
} from '../void-calculator';

describe('void-calculator: calculateVoidDays', () => {
  it('days between two dates', () => { expect(calculateVoidDays('2024-01-01', '2024-01-31')).toBe(30); });
  it('same date = 0', () => { expect(calculateVoidDays('2024-01-01', '2024-01-01')).toBe(0); });
  it('null end uses reference date', () => { expect(calculateVoidDays('2024-01-01', null, '2024-02-01')).toBe(31); });
  it('invalid start = 0', () => { expect(calculateVoidDays('not-a-date', '2024-01-31')).toBe(0); });
  it('end before start = 0', () => { expect(calculateVoidDays('2024-02-01', '2024-01-01')).toBe(0); });
  it('leap year', () => { expect(calculateVoidDays('2024-02-01', '2024-03-01')).toBe(29); });
});

describe('void-calculator: calculateVoidCost', () => {
  const voidPeriod: VoidPeriod = { propertyId: 'p1', startDate: '2024-01-01', endDate: '2024-04-01', monthlyRent: 1_000 };

  it('calculates lost rent', () => {
    const r = calculateVoidCost(voidPeriod);
    expect(r.lostRent).toBeGreaterThan(2_900);
    expect(r.lostRent).toBeLessThan(3_100);
  });

  it('includes holding costs', () => {
    const h: MonthlyHoldingCosts = { councilTax: 150, insurance: 50, mortgage: 800, utilities: 100, other: 0 };
    const r = calculateVoidCost(voidPeriod, h);
    expect(r.holdingCosts).toBeGreaterThan(0);
    expect(r.totalCost).toBeGreaterThan(r.lostRent);
  });

  it('active void when endDate null', () => {
    const r = calculateVoidCost({ ...voidPeriod, endDate: null }, undefined, '2024-04-01');
    expect(r.isActive).toBe(true);
  });

  it('closed void when endDate exists', () => {
    expect(calculateVoidCost(voidPeriod).isActive).toBe(false);
  });

  it('zero rent', () => {
    expect(calculateVoidCost({ ...voidPeriod, monthlyRent: 0 }).lostRent).toBe(0);
  });

  it('negative rent clamped', () => {
    expect(calculateVoidCost({ ...voidPeriod, monthlyRent: -500 }).lostRent).toBe(0);
  });

  it('includes roomId', () => {
    const r = calculateVoidCost({ ...voidPeriod, roomId: 'room-3' });
    expect(r.roomId).toBe('room-3');
  });
});

describe('void-calculator: calculatePortfolioVoidRate', () => {
  it('percentage', () => { expect(calculatePortfolioVoidRate(20, 4)).toBe(20); });
  it('zero rooms = 0', () => { expect(calculatePortfolioVoidRate(0, 5)).toBe(0); });
  it('zero void = 0', () => { expect(calculatePortfolioVoidRate(20, 0)).toBe(0); });
  it('negative void = 0', () => { expect(calculatePortfolioVoidRate(20, -3)).toBe(0); });
  it('all void = 100', () => { expect(calculatePortfolioVoidRate(10, 10)).toBe(100); });
  it('rounds to 2dp', () => { expect(calculatePortfolioVoidRate(3, 1)).toBeCloseTo(33.33, 2); });
});

describe('void-calculator: calculatePortfolioVoidSummary', () => {
  const vps: VoidPeriod[] = [
    { propertyId: 'p1', startDate: '2024-01-01', endDate: null, monthlyRent: 1_000 },
    { propertyId: 'p2', startDate: '2024-02-01', endDate: '2024-03-01', monthlyRent: 800 },
    { propertyId: 'p1', roomId: 'r2', startDate: '2024-01-15', endDate: null, monthlyRent: 600 },
  ];

  it('unique properties', () => {
    const s = calculatePortfolioVoidSummary(vps, 10, 20, undefined, '2024-04-01');
    expect(s.propertiesWithVoids).toBe(2);
  });

  it('active void rooms', () => {
    const s = calculatePortfolioVoidSummary(vps, 10, 20, undefined, '2024-04-01');
    expect(s.voidRooms).toBe(2);
  });

  it('empty array', () => {
    const s = calculatePortfolioVoidSummary([], 10, 20);
    expect(s.totalVoidCost).toBe(0);
    expect(s.averageVoidDays).toBe(0);
  });
});

describe('void-calculator: estimateAnnualVoidCost', () => {
  it('10% void rate, £1k/mo', () => { expect(estimateAnnualVoidCost(1_000, 10)).toBeCloseTo(1_200, 0); });
  it('includes holding costs', () => { expect(estimateAnnualVoidCost(1_000, 10, 500)).toBeCloseTo(1_800, 0); });
  it('zero void rate', () => { expect(estimateAnnualVoidCost(1_000, 0)).toBe(0); });
  it('100% void rate', () => { expect(estimateAnnualVoidCost(1_000, 100)).toBe(12_000); });
  it('clamps above 100%', () => { expect(estimateAnnualVoidCost(1_000, 150)).toBe(12_000); });
  it('negative rent', () => { expect(estimateAnnualVoidCost(-500, 10)).toBe(0); });
});
