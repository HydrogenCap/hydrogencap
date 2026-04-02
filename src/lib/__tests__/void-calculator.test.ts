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
