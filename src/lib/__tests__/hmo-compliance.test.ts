import { describe, it, expect } from 'vitest';
import {
  checkHMOCompliance,
  isHMOProperty,
  HMO_ROOM_MINIMUMS,
  HMO_AMENITY_RATIOS,
  type RoomData,
  type PropertyData,
} from '../hmo-compliance';

function makeRoom(overrides: Partial<RoomData> = {}): RoomData {
  return {
    id: 'room-1',
    room_name: 'Room 1',
    size_sqm: 10,
    occupancy_type: 'single',
    amenity_type: 'bedroom',
    room_type: 'single',
    is_lettable: true,
    ...overrides,
  };
}

function makeProperty(overrides: Partial<PropertyData> = {}): PropertyData {
  return { id: 'prop-1', property_type: 'hmo_licensed', ...overrides };
}

describe('Room size checks', () => {
  it('marks a single room above minimum as compliant', () => {
    const rooms = [makeRoom({ size_sqm: 7.0, occupancy_type: 'single' })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].isCompliant).toBe(true);
    expect(result.roomResults[0].shortfall).toBe(0);
  });

  it('marks a single room exactly at minimum (6.51) as compliant', () => {
    const rooms = [makeRoom({ size_sqm: HMO_ROOM_MINIMUMS.single_adult, occupancy_type: 'single' })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].isCompliant).toBe(true);
  });

  it('marks a single room below minimum as non-compliant', () => {
    const rooms = [makeRoom({ size_sqm: 6.0, occupancy_type: 'single' })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].isCompliant).toBe(false);
    expect(result.roomResults[0].shortfall).toBeCloseTo(0.51, 2);
  });

  it('marks a double room above minimum (10.22) as compliant', () => {
    const rooms = [makeRoom({ size_sqm: 12.0, occupancy_type: 'double' })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].isCompliant).toBe(true);
  });

  it('marks a double room exactly at minimum as compliant', () => {
    const rooms = [makeRoom({ size_sqm: HMO_ROOM_MINIMUMS.double_adult, occupancy_type: 'double' })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].isCompliant).toBe(true);
  });

  it('marks a double room below minimum as non-compliant', () => {
    const rooms = [makeRoom({ size_sqm: 9.0, occupancy_type: 'double' })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].isCompliant).toBe(false);
  });

  it('marks a child room above minimum (4.64) as compliant', () => {
    const rooms = [makeRoom({ size_sqm: 5.0, occupancy_type: 'child' })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].isCompliant).toBe(true);
  });

  it('marks a child room exactly at minimum as compliant', () => {
    const rooms = [makeRoom({ size_sqm: HMO_ROOM_MINIMUMS.child_under_10, occupancy_type: 'child' })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].isCompliant).toBe(true);
  });

  it('marks a child room below minimum as non-compliant', () => {
    const rooms = [makeRoom({ size_sqm: 4.0, occupancy_type: 'child' })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].isCompliant).toBe(false);
    expect(result.roomResults[0].shortfall).toBeCloseTo(0.64, 2);
  });

  it('handles null size_sqm as non-compliant', () => {
    const rooms = [makeRoom({ size_sqm: null })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].isCompliant).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('Amenity ratios', () => {
  it('requires 1 bathroom per 5 occupants', () => {
    // 5 single bedrooms = 5 occupants → need 1 bathroom
    const bedrooms = Array.from({ length: 5 }, (_, i) =>
      makeRoom({ id: `bed-${i}`, room_name: `Bed ${i}`, occupancy_type: 'single', amenity_type: 'bedroom' })
    );
    const bathrooms = [makeRoom({ id: 'bath-1', room_name: 'Bath', amenity_type: 'bathroom', is_lettable: false })];
    const result = checkHMOCompliance(makeProperty(), [...bedrooms, ...bathrooms]);
    expect(result.amenityResults.bathroomsRequired).toBe(1);
    expect(result.amenityResults.bathroomCompliant).toBe(true);
  });

  it('fails when bathrooms are insufficient', () => {
    // 6 occupants → need 2 bathrooms, provide 1
    const bedrooms = Array.from({ length: 6 }, (_, i) =>
      makeRoom({ id: `bed-${i}`, room_name: `Bed ${i}`, occupancy_type: 'single', amenity_type: 'bedroom' })
    );
    const bathrooms = [makeRoom({ id: 'bath-1', room_name: 'Bath', amenity_type: 'bathroom', is_lettable: false })];
    const result = checkHMOCompliance(makeProperty(), [...bedrooms, ...bathrooms]);
    expect(result.amenityResults.bathroomsRequired).toBe(2);
    expect(result.amenityResults.bathroomCompliant).toBe(false);
  });

  it('requires 1 kitchen per 7 occupants', () => {
    // 7 occupants → 1 kitchen
    const bedrooms = Array.from({ length: 7 }, (_, i) =>
      makeRoom({ id: `bed-${i}`, room_name: `Bed ${i}`, occupancy_type: 'single', amenity_type: 'bedroom' })
    );
    const kitchens = [makeRoom({ id: 'kit-1', room_name: 'Kitchen', amenity_type: 'kitchen', is_lettable: false })];
    const bathrooms = [
      makeRoom({ id: 'bath-1', room_name: 'Bath 1', amenity_type: 'bathroom', is_lettable: false }),
      makeRoom({ id: 'bath-2', room_name: 'Bath 2', amenity_type: 'bathroom', is_lettable: false }),
    ];
    const toilets = [
      makeRoom({ id: 'toilet-1', room_name: 'Toilet 1', amenity_type: 'toilet', is_lettable: false }),
      makeRoom({ id: 'toilet-2', room_name: 'Toilet 2', amenity_type: 'toilet', is_lettable: false }),
    ];
    const result = checkHMOCompliance(makeProperty(), [...bedrooms, ...kitchens, ...bathrooms, ...toilets]);
    expect(result.amenityResults.kitchensRequired).toBe(1);
    expect(result.amenityResults.kitchenCompliant).toBe(true);
  });

  it('counts double rooms as 2 occupants for amenity calculation', () => {
    // 3 double bedrooms = 6 occupants → need 2 bathrooms
    const bedrooms = Array.from({ length: 3 }, (_, i) =>
      makeRoom({ id: `bed-${i}`, room_name: `Bed ${i}`, occupancy_type: 'double', amenity_type: 'bedroom' })
    );
    const result = checkHMOCompliance(makeProperty(), bedrooms);
    expect(result.totalOccupants).toBe(6);
    expect(result.amenityResults.bathroomsRequired).toBe(2);
  });
});

describe('Overall compliance', () => {
  it('returns overallCompliant true when all rooms and amenities pass', () => {
    const rooms = [
      makeRoom({ id: 'bed-1', room_name: 'Bed 1', size_sqm: 7, occupancy_type: 'single', amenity_type: 'bedroom' }),
      makeRoom({ id: 'bath-1', room_name: 'Bath', amenity_type: 'bathroom', is_lettable: false }),
      makeRoom({ id: 'kit-1', room_name: 'Kitchen', amenity_type: 'kitchen', is_lettable: false }),
      makeRoom({ id: 'toilet-1', room_name: 'Toilet', amenity_type: 'toilet', is_lettable: false }),
    ];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.overallCompliant).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('returns overallCompliant false when a room fails', () => {
    const rooms = [
      makeRoom({ id: 'bed-1', room_name: 'Bed 1', size_sqm: 5.0, occupancy_type: 'single', amenity_type: 'bedroom' }),
      makeRoom({ id: 'bath-1', room_name: 'Bath', amenity_type: 'bathroom', is_lettable: false }),
      makeRoom({ id: 'kit-1', room_name: 'Kitchen', amenity_type: 'kitchen', is_lettable: false }),
      makeRoom({ id: 'toilet-1', room_name: 'Toilet', amenity_type: 'toilet', is_lettable: false }),
    ];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.overallCompliant).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('returns overallCompliant false when amenities fail', () => {
    // 6 bedrooms but only 1 bathroom
    const bedrooms = Array.from({ length: 6 }, (_, i) =>
      makeRoom({ id: `bed-${i}`, room_name: `Bed ${i}`, size_sqm: 7, occupancy_type: 'single', amenity_type: 'bedroom' })
    );
    const rooms = [
      ...bedrooms,
      makeRoom({ id: 'bath-1', room_name: 'Bath', amenity_type: 'bathroom', is_lettable: false }),
      makeRoom({ id: 'kit-1', room_name: 'Kitchen', amenity_type: 'kitchen', is_lettable: false }),
      makeRoom({ id: 'toilet-1', room_name: 'Toilet', amenity_type: 'toilet', is_lettable: false }),
    ];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.overallCompliant).toBe(false);
  });

  it('always includes licence conditions', () => {
    const result = checkHMOCompliance(makeProperty(), []);
    expect(result.licenceConditions.length).toBeGreaterThan(0);
  });

  it('infers occupancy from room_type when occupancy_type is null', () => {
    const rooms = [makeRoom({ occupancy_type: null, room_type: 'double', size_sqm: 11 })];
    const result = checkHMOCompliance(makeProperty(), rooms);
    expect(result.roomResults[0].occupancy).toBe('double');
    expect(result.totalOccupants).toBe(2);
  });
});

describe('isHMOProperty', () => {
  it('returns true for hmo_licensed', () => {
    expect(isHMOProperty('hmo_licensed')).toBe(true);
  });

  it('returns true for hmo_mandatory', () => {
    expect(isHMOProperty('hmo_mandatory')).toBe(true);
  });

  it('returns false for standard properties', () => {
    expect(isHMOProperty('standard')).toBe(false);
    expect(isHMOProperty('buy_to_let')).toBe(false);
  });
});
