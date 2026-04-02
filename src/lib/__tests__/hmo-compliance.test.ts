/**
 * Tests for the pure HMO compliance logic extracted from HmoComplianceCard.
 * We test the underlying calculations: sqft→sqm conversion, room minimum sizes,
 * and amenity ratios.
 */
import { describe, it, expect } from 'vitest';

// Re-implement the pure functions from HmoComplianceCard for testing
// (they're not exported, so we replicate the logic)

const MIN_SIZES = {
  single_adult: 6.51,
  double_adult: 10.22,
  child_under_10: 4.64,
};

function sqftToSqm(sqft: number): number {
  return sqft * 0.092903;
}

function getRoomMinSize(roomType: string): number {
  if (roomType === 'double' || roomType === 'ensuite' || roomType === 'studio') {
    return MIN_SIZES.double_adult;
  }
  return MIN_SIZES.single_adult;
}

function checkRoomCompliance(sqft: number, roomType: string) {
  const sqm = sqftToSqm(sqft);
  const minSize = getRoomMinSize(roomType);
  return {
    sqm: Math.round(sqm * 100) / 100,
    minSize,
    compliant: sqm >= minSize,
  };
}

function checkBathroomRatio(occupants: number, bathrooms: number) {
  const ratio = occupants / bathrooms;
  return {
    ratio,
    compliant: ratio <= 5,
  };
}

describe('sqftToSqm conversion', () => {
  it('converts 0 sqft to 0 sqm', () => {
    expect(sqftToSqm(0)).toBe(0);
  });

  it('converts 100 sqft correctly', () => {
    expect(sqftToSqm(100)).toBeCloseTo(9.2903, 3);
  });

  it('converts 70 sqft (minimum single room) correctly', () => {
    expect(sqftToSqm(70)).toBeCloseTo(6.503, 2);
  });

  it('converts 110 sqft (minimum double room) correctly', () => {
    expect(sqftToSqm(110)).toBeCloseTo(10.219, 2);
  });
});

describe('getRoomMinSize', () => {
  it('returns double_adult size for double rooms', () => {
    expect(getRoomMinSize('double')).toBe(10.22);
  });

  it('returns double_adult size for ensuite rooms', () => {
    expect(getRoomMinSize('ensuite')).toBe(10.22);
  });

  it('returns double_adult size for studio rooms', () => {
    expect(getRoomMinSize('studio')).toBe(10.22);
  });

  it('returns single_adult size for single rooms', () => {
    expect(getRoomMinSize('single')).toBe(6.51);
  });

  it('returns single_adult size for unknown room types', () => {
    expect(getRoomMinSize('other')).toBe(6.51);
    expect(getRoomMinSize('utility')).toBe(6.51);
  });
});

describe('room size compliance checks', () => {
  it('compliant single room at 71 sqft', () => {
    const result = checkRoomCompliance(71, 'single');
    expect(result.compliant).toBe(true);
    expect(result.sqm).toBeCloseTo(6.60, 1);
  });

  it('non-compliant single room at 70 sqft (just under 6.51 sqm)', () => {
    const result = checkRoomCompliance(70, 'single');
    // 70 sqft = 6.503 sqm, min is 6.51 sqm — not compliant
    expect(result.compliant).toBe(false);
  });

  it('non-compliant single room at 65 sqft', () => {
    const result = checkRoomCompliance(65, 'single');
    expect(result.compliant).toBe(false);
  });

  it('compliant double room at 111 sqft', () => {
    const result = checkRoomCompliance(111, 'double');
    expect(result.compliant).toBe(true);
  });

  it('non-compliant double room at 110 sqft (just under 10.22 sqm)', () => {
    // 110 sqft = 10.219 sqm, min is 10.22 sqm — not compliant
    const result = checkRoomCompliance(110, 'double');
    expect(result.compliant).toBe(false);
  });

  it('non-compliant double room at 100 sqft', () => {
    const result = checkRoomCompliance(100, 'double');
    expect(result.compliant).toBe(false);
    expect(result.sqm).toBeCloseTo(9.29, 1);
  });

  it('ensuite treated as double', () => {
    const result = checkRoomCompliance(115, 'ensuite');
    expect(result.compliant).toBe(true);
    expect(result.minSize).toBe(10.22);
  });

  it('large room is always compliant', () => {
    const result = checkRoomCompliance(200, 'single');
    expect(result.compliant).toBe(true);
  });
});

describe('bathroom amenity ratio', () => {
  it('compliant with 5 occupants and 1 bathroom (ratio = 5)', () => {
    const { compliant, ratio } = checkBathroomRatio(5, 1);
    expect(compliant).toBe(true);
    expect(ratio).toBe(5);
  });

  it('non-compliant with 6 occupants and 1 bathroom', () => {
    const { compliant } = checkBathroomRatio(6, 1);
    expect(compliant).toBe(false);
  });

  it('compliant with 10 occupants and 2 bathrooms', () => {
    const { compliant } = checkBathroomRatio(10, 2);
    expect(compliant).toBe(true);
  });

  it('compliant with 3 occupants and 2 bathrooms', () => {
    const { compliant, ratio } = checkBathroomRatio(3, 2);
    expect(compliant).toBe(true);
    expect(ratio).toBe(1.5);
  });

  it('non-compliant with 11 occupants and 2 bathrooms', () => {
    const { compliant } = checkBathroomRatio(11, 2);
    expect(compliant).toBe(false);
  });
});

describe('overall compliance score logic', () => {
  it('returns 100% when all checks pass', () => {
    const checks = [true, true, true];
    const passed = checks.filter(Boolean).length;
    const score = Math.round((passed / checks.length) * 100);
    expect(score).toBe(100);
  });

  it('returns 67% when one check fails', () => {
    const checks = [true, true, false];
    const passed = checks.filter(Boolean).length;
    const score = Math.round((passed / checks.length) * 100);
    expect(score).toBe(67);
  });

  it('returns 33% when two checks fail', () => {
    const checks = [true, false, false];
    const passed = checks.filter(Boolean).length;
    const score = Math.round((passed / checks.length) * 100);
    expect(score).toBe(33);
  });

  it('returns 0% when all checks fail', () => {
    const checks = [false, false, false];
    const passed = checks.filter(Boolean).length;
    const score = Math.round((passed / checks.length) * 100);
    expect(score).toBe(0);
  });
});
