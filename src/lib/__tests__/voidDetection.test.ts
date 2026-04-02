import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectVoidRooms, type DetectedVoid } from '../voidDetection';

// Fix today to a known date for deterministic tests
const TODAY = '2025-06-15';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

const PROP = { id: 'prop-1', address_line_1: '10 Test Road', postcode: 'SW1A 1AA' };

function room(overrides = {}) {
  return {
    id: 'room-1',
    property_id: 'prop-1',
    room_name: 'Room A',
    is_lettable: true,
    occupancy_status: null,
    current_rent_pcm: 800,
    ...overrides,
  };
}

describe('detectVoidRooms', () => {
  it('returns empty array when no rooms', () => {
    expect(detectVoidRooms([], [], [], [PROP])).toEqual([]);
  });

  it('skips non-lettable rooms', () => {
    const rooms = [room({ is_lettable: false })];
    expect(detectVoidRooms(rooms, [], [], [PROP])).toEqual([]);
  });

  it('detects void room with no tenancy and no existing void', () => {
    const rooms = [room()];
    const result = detectVoidRooms(rooms, [], [], [PROP]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      roomId: 'room-1',
      roomName: 'Room A',
      propertyId: 'prop-1',
      propertyAddress: '10 Test Road, SW1A 1AA',
      currentRentPcm: 800,
    });
  });

  it('excludes room with active tenancy', () => {
    const rooms = [room()];
    const tenancies = [{
      room_id: 'room-1',
      status: 'active',
      start_date: '2025-01-01',
      actual_end_date: null,
    }];
    expect(detectVoidRooms(rooms, tenancies, [], [PROP])).toEqual([]);
  });

  it('excludes room with periodic tenancy', () => {
    const rooms = [room()];
    const tenancies = [{
      room_id: 'room-1',
      status: 'periodic',
      start_date: '2024-06-01',
      actual_end_date: null,
    }];
    expect(detectVoidRooms(rooms, tenancies, [], [PROP])).toEqual([]);
  });

  it('excludes room with notice_served tenancy', () => {
    const rooms = [room()];
    const tenancies = [{
      room_id: 'room-1',
      status: 'notice_served',
      start_date: '2024-01-01',
      actual_end_date: '2025-12-01',
    }];
    expect(detectVoidRooms(rooms, tenancies, [], [PROP])).toEqual([]);
  });

  it('includes room whose tenancy has ended', () => {
    const rooms = [room()];
    const tenancies = [{
      room_id: 'room-1',
      status: 'active',
      start_date: '2024-01-01',
      actual_end_date: '2025-05-01', // ended before today
    }];
    expect(detectVoidRooms(rooms, tenancies, [], [PROP])).toHaveLength(1);
  });

  it('excludes room with existing open void (room-level)', () => {
    const rooms = [room()];
    const voids = [{ property_id: 'prop-1', room_id: 'room-1', end_date: null }];
    expect(detectVoidRooms(rooms, [], voids, [PROP])).toEqual([]);
  });

  it('excludes room with existing open void (property-level)', () => {
    const rooms = [room()];
    const voids = [{ property_id: 'prop-1', room_id: null, end_date: null }];
    expect(detectVoidRooms(rooms, [], voids, [PROP])).toEqual([]);
  });

  it('includes room when void is closed (has end_date)', () => {
    const rooms = [room()];
    const voids = [{ property_id: 'prop-1', room_id: 'room-1', end_date: '2025-03-01' }];
    expect(detectVoidRooms(rooms, [], voids, [PROP])).toHaveLength(1);
  });

  it('detects multiple void rooms', () => {
    const rooms = [
      room({ id: 'r1', room_name: 'Room 1' }),
      room({ id: 'r2', room_name: 'Room 2' }),
      room({ id: 'r3', room_name: 'Room 3', is_lettable: false }),
    ];
    const result = detectVoidRooms(rooms, [], [], [PROP]);
    expect(result).toHaveLength(2);
  });

  it('handles unknown property gracefully', () => {
    const rooms = [room({ property_id: 'unknown-prop' })];
    const result = detectVoidRooms(rooms, [], [], [PROP]);
    expect(result).toHaveLength(1);
    expect(result[0].propertyAddress).toBe('Unknown');
  });

  it('handles null current_rent_pcm', () => {
    const rooms = [room({ current_rent_pcm: null })];
    const result = detectVoidRooms(rooms, [], [], [PROP]);
    expect(result[0].currentRentPcm).toBeNull();
  });
});
