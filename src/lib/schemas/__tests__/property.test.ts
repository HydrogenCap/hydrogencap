import { describe, it, expect } from 'vitest';
import {
  propertySchema,
  createPropertySchema,
  updatePropertySchema,
  validateProperty,
  validatePropertyCreate,
  validatePropertyUpdate,
} from '../property';

const validBase = {
  address_line: '14 Oak Street',
  postcode: 'GL50 1HG',
};

describe('propertySchema', () => {
  it('accepts valid property data with required fields', () => {
    const result = propertySchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('accepts full valid property data', () => {
    const result = propertySchema.safeParse({
      ...validBase,
      city: 'Cheltenham',
      county: 'Gloucestershire',
      current_value_gbp: 250000,
      purchase_price_gbp: 200000,
      purchase_date: '2022-03-15',
      beds: 3,
      bathrooms: 2,
      square_feet: 1200,
      epc_rating: 'C',
      tenure: 'Freehold',
      asset_category: 'Single Let',
      lifecycle_type: 'core_rental',
      occupancy_status: 'Occupied',
    });
    expect(result.success).toBe(true);
  });

  it('defaults lifecycle_type to development', () => {
    const result = propertySchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lifecycle_type).toBe('development');
    }
  });

  it('normalises postcode to uppercase', () => {
    const result = propertySchema.safeParse({
      ...validBase,
      postcode: 'gl50 1hg',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.postcode).toBe('GL50 1HG');
    }
  });

  // Address validation
  it('rejects address shorter than 5 characters', () => {
    const result = propertySchema.safeParse({ ...validBase, address_line: 'Hi' });
    expect(result.success).toBe(false);
  });

  it('rejects address longer than 200 characters', () => {
    const result = propertySchema.safeParse({
      ...validBase,
      address_line: 'A'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  // Postcode validation
  it('rejects non-UK postcode', () => {
    const result = propertySchema.safeParse({ ...validBase, postcode: '12345' });
    expect(result.success).toBe(false);
  });

  it('rejects empty postcode', () => {
    const result = propertySchema.safeParse({ ...validBase, postcode: '' });
    expect(result.success).toBe(false);
  });

  it('accepts various valid UK postcode formats', () => {
    const postcodes = ['SW1A 1AA', 'EC2A 1NT', 'W1A 0AX', 'M1 1AE', 'B33 8TH', 'CR2 6XH'];
    for (const postcode of postcodes) {
      const result = propertySchema.safeParse({ ...validBase, postcode });
      expect(result.success).toBe(true);
    }
  });

  // Property value boundaries
  it('rejects property value below 10,000', () => {
    const result = propertySchema.safeParse({ ...validBase, current_value_gbp: 9999 });
    expect(result.success).toBe(false);
  });

  it('rejects property value above 100M', () => {
    const result = propertySchema.safeParse({ ...validBase, current_value_gbp: 100000001 });
    expect(result.success).toBe(false);
  });

  it('accepts property value at boundaries', () => {
    expect(propertySchema.safeParse({ ...validBase, current_value_gbp: 10000 }).success).toBe(true);
    expect(propertySchema.safeParse({ ...validBase, current_value_gbp: 100000000 }).success).toBe(true);
  });

  it('accepts null/undefined optional fields', () => {
    const result = propertySchema.safeParse({
      ...validBase,
      city: null,
      county: null,
      current_value_gbp: null,
      beds: null,
      epc_rating: null,
    });
    expect(result.success).toBe(true);
  });

  // Beds validation
  it('rejects negative beds', () => {
    const result = propertySchema.safeParse({ ...validBase, beds: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer beds', () => {
    const result = propertySchema.safeParse({ ...validBase, beds: 2.5 });
    expect(result.success).toBe(false);
  });

  it('rejects beds above 50', () => {
    const result = propertySchema.safeParse({ ...validBase, beds: 51 });
    expect(result.success).toBe(false);
  });

  // Enum validations
  it('rejects invalid EPC rating', () => {
    const result = propertySchema.safeParse({ ...validBase, epc_rating: 'H' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid tenure type', () => {
    const result = propertySchema.safeParse({ ...validBase, tenure: 'Rented' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid asset category', () => {
    const result = propertySchema.safeParse({ ...validBase, asset_category: 'Studio' });
    expect(result.success).toBe(false);
  });

  // Date validation
  it('rejects invalid purchase date', () => {
    const result = propertySchema.safeParse({ ...validBase, purchase_date: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('accepts valid purchase date', () => {
    const result = propertySchema.safeParse({ ...validBase, purchase_date: '2023-01-15' });
    expect(result.success).toBe(true);
  });
});

describe('createPropertySchema', () => {
  it('requires address_line and postcode', () => {
    const result = createPropertySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts valid create data', () => {
    const result = createPropertySchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });
});

describe('updatePropertySchema', () => {
  it('allows all fields to be optional', () => {
    const result = updatePropertySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('still validates field constraints when present', () => {
    const result = updatePropertySchema.safeParse({ beds: -1 });
    expect(result.success).toBe(false);
  });
});

describe('validateProperty helper', () => {
  it('returns success for valid data', () => {
    const result = validateProperty(validBase);
    expect(result.success).toBe(true);
  });

  it('returns error for invalid data', () => {
    const result = validateProperty({ address_line: 'Hi' });
    expect(result.success).toBe(false);
  });
});

describe('validatePropertyCreate helper', () => {
  it('returns success for valid create data', () => {
    expect(validatePropertyCreate(validBase).success).toBe(true);
  });
});

describe('validatePropertyUpdate helper', () => {
  it('returns success for empty update', () => {
    expect(validatePropertyUpdate({}).success).toBe(true);
  });
});
