import { describe, it, expect } from 'vitest';
import {
  complianceItemSchema,
  createComplianceItemSchema,
  updateComplianceItemSchema,
  complianceDocumentSchema,
  validateComplianceItem,
  validateComplianceItemCreate,
  validateComplianceDocument,
  validateExpiryDate,
} from '../compliance';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const validComplianceItem = {
  compliance_type: 'Gas Safety Certificate (CP12)',
  property_id: VALID_UUID,
};

describe('complianceItemSchema', () => {
  it('accepts valid compliance item with required fields', () => {
    const result = complianceItemSchema.safeParse(validComplianceItem);
    expect(result.success).toBe(true);
  });

  it('accepts full compliance item', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      issue_date: '2024-06-15',
      expiry_date: '2025-06-15',
      notes: 'Annual inspection completed',
      responsible_party: 'Gas Safe Engineer Ltd',
      is_required: true,
      reminder_days: [90, 60, 30, 14, 7],
    });
    expect(result.success).toBe(true);
  });

  // Required fields
  it('rejects empty compliance_type', () => {
    const result = complianceItemSchema.safeParse({
      compliance_type: '',
      property_id: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid property_id UUID', () => {
    const result = complianceItemSchema.safeParse({
      compliance_type: 'EPC',
      property_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  // Date validation
  it('rejects invalid issue_date', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      issue_date: 'invalid-date',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid expiry_date', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      expiry_date: '32/13/2025',
    });
    expect(result.success).toBe(false);
  });

  it('accepts null dates', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      issue_date: null,
      expiry_date: null,
    });
    expect(result.success).toBe(true);
  });

  // String length limits
  it('rejects notes exceeding 2000 characters', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      notes: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects responsible_party exceeding 200 characters', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      responsible_party: 'A'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('rejects exclusion_reason exceeding 500 characters', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      exclusion_reason: 'B'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  // Reminder days validation
  it('accepts valid reminder_days array', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      reminder_days: [30, 14, 7],
    });
    expect(result.success).toBe(true);
  });

  it('rejects reminder_days with value below 1', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      reminder_days: [0],
    });
    expect(result.success).toBe(false);
  });

  it('rejects reminder_days with value above 365', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      reminder_days: [366],
    });
    expect(result.success).toBe(false);
  });

  it('rejects reminder_days with non-integer', () => {
    const result = complianceItemSchema.safeParse({
      ...validComplianceItem,
      reminder_days: [30.5],
    });
    expect(result.success).toBe(false);
  });
});

describe('createComplianceItemSchema', () => {
  it('requires compliance_type and property_id', () => {
    const result = createComplianceItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts valid create data', () => {
    const result = createComplianceItemSchema.safeParse(validComplianceItem);
    expect(result.success).toBe(true);
  });
});

describe('updateComplianceItemSchema', () => {
  it('allows all fields to be optional', () => {
    const result = updateComplianceItemSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('complianceDocumentSchema', () => {
  const validDoc = {
    compliance_item_id: VALID_UUID,
    file_url: 'https://storage.example.com/docs/gas-cert.pdf',
    original_file_name: 'gas-safety-2024.pdf',
  };

  it('accepts valid compliance document', () => {
    const result = complianceDocumentSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
  });

  it('defaults is_current to true', () => {
    const result = complianceDocumentSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_current).toBe(true);
    }
  });

  it('rejects invalid compliance_item_id UUID', () => {
    const result = complianceDocumentSchema.safeParse({
      ...validDoc,
      compliance_item_id: 'bad-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid file_url', () => {
    const result = complianceDocumentSchema.safeParse({
      ...validDoc,
      file_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty original_file_name', () => {
    const result = complianceDocumentSchema.safeParse({
      ...validDoc,
      original_file_name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects original_file_name exceeding 500 characters', () => {
    const result = complianceDocumentSchema.safeParse({
      ...validDoc,
      original_file_name: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer version_number', () => {
    const result = complianceDocumentSchema.safeParse({
      ...validDoc,
      version_number: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects version_number below 1', () => {
    const result = complianceDocumentSchema.safeParse({
      ...validDoc,
      version_number: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('validateComplianceItem helper', () => {
  it('returns success for valid data', () => {
    expect(validateComplianceItem(validComplianceItem).success).toBe(true);
  });
});

describe('validateComplianceItemCreate helper', () => {
  it('returns error when missing required fields', () => {
    expect(validateComplianceItemCreate({}).success).toBe(false);
  });
});

describe('validateComplianceDocument helper', () => {
  it('returns success for valid document', () => {
    expect(validateComplianceDocument({
      compliance_item_id: VALID_UUID,
      file_url: 'https://example.com/file.pdf',
      original_file_name: 'file.pdf',
    }).success).toBe(true);
  });
});

describe('validateExpiryDate', () => {
  it('returns valid when both dates are null', () => {
    expect(validateExpiryDate(null, null)).toEqual({ valid: true });
  });

  it('returns valid when issue_date is null', () => {
    expect(validateExpiryDate(null, '2025-06-15')).toEqual({ valid: true });
  });

  it('returns valid when expiry is after issue', () => {
    expect(validateExpiryDate('2024-06-15', '2025-06-15')).toEqual({ valid: true });
  });

  it('returns error when expiry is before issue', () => {
    const result = validateExpiryDate('2025-06-15', '2024-06-15');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('after issue date');
  });

  it('returns error when expiry equals issue', () => {
    const result = validateExpiryDate('2024-06-15', '2024-06-15');
    expect(result.valid).toBe(false);
  });
});
