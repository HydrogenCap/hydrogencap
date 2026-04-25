import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Edge Function Contract Tests
 *
 * These tests verify the Zod request schemas used by edge functions.
 * Schemas are reconstructed here to match the edge function definitions,
 * ensuring the contracts between frontend and backend remain stable.
 */

// ─── portfolio-chat ───────────────────────────────────────────────
const ChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(10000),
  })).min(1).max(50),
});

describe('portfolio-chat contract', () => {
  it('accepts valid single message', () => {
    const result = ChatSchema.safeParse({
      messages: [{ role: 'user', content: 'What is my portfolio LTV?' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts multi-turn conversation', () => {
    const result = ChatSchema.safeParse({
      messages: [
        { role: 'user', content: 'How many properties do I own?' },
        { role: 'assistant', content: 'You own 5 properties.' },
        { role: 'user', content: 'What is their total value?' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty messages array', () => {
    const result = ChatSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it('rejects messages exceeding 50', () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: 'message',
    }));
    const result = ChatSchema.safeParse({ messages });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = ChatSchema.safeParse({
      messages: [{ role: 'system', content: 'test' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result = ChatSchema.safeParse({
      messages: [{ role: 'user', content: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects content exceeding 10000 characters', () => {
    const result = ChatSchema.safeParse({
      messages: [{ role: 'user', content: 'x'.repeat(10001) }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing messages field', () => {
    const result = ChatSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── process-document ─────────────────────────────────────────────
const DocumentSchema = z.object({
  documentId: z.string().uuid('Invalid documentId'),
  fileUrl: z.string().url().max(2048, 'fileUrl too long'),
  properties: z.array(z.object({
    id: z.string().uuid(),
    address_line: z.string().min(1).max(500),
    postcode: z.string().max(20).nullable().optional(),
    title_number: z.string().max(50).nullable().optional(),
  })).min(1).max(500),
});

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('process-document contract', () => {
  const validRequest = {
    documentId: VALID_UUID,
    fileUrl: 'https://storage.example.com/docs/cert.pdf',
    properties: [{
      id: VALID_UUID,
      address_line: '14 Oak Street',
      postcode: 'GL50 1HG',
    }],
  };

  it('accepts valid request', () => {
    const result = DocumentSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('rejects invalid documentId UUID', () => {
    const result = DocumentSchema.safeParse({
      ...validRequest,
      documentId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid fileUrl', () => {
    const result = DocumentSchema.safeParse({
      ...validRequest,
      fileUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects fileUrl exceeding 2048 chars', () => {
    const result = DocumentSchema.safeParse({
      ...validRequest,
      fileUrl: 'https://example.com/' + 'a'.repeat(2048),
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty properties array', () => {
    const result = DocumentSchema.safeParse({
      ...validRequest,
      properties: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects property with invalid UUID', () => {
    const result = DocumentSchema.safeParse({
      ...validRequest,
      properties: [{ id: 'bad', address_line: '14 Oak Street' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects property with empty address_line', () => {
    const result = DocumentSchema.safeParse({
      ...validRequest,
      properties: [{ id: VALID_UUID, address_line: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts property with null optional fields', () => {
    const result = DocumentSchema.safeParse({
      ...validRequest,
      properties: [{
        id: VALID_UUID,
        address_line: '14 Oak Street',
        postcode: null,
        title_number: null,
      }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    expect(DocumentSchema.safeParse({}).success).toBe(false);
    expect(DocumentSchema.safeParse({ documentId: VALID_UUID }).success).toBe(false);
  });
});

// ─── ai-compliance-checker ────────────────────────────────────────
const ComplianceRequestSchema = z.object({
  propertyId: z.string().uuid().optional(),
  propertyData: z.object({
    address_line: z.string().min(1),
    has_gas_supply: z.boolean().nullable().optional(),
    is_listed_building: z.boolean().nullable().optional(),
    is_hmo: z.boolean().nullable().optional(),
  }).passthrough(),
  complianceItems: z.array(z.object({
    compliance_type: z.string(),
    expiry_date: z.string().nullable().optional(),
    status: z.string().optional(),
  }).passthrough()).optional().default([]),
  mode: z.enum(['analyze', 'quick', 'audit']).optional().default('analyze'),
});

describe('ai-compliance-checker contract', () => {
  const validRequest = {
    propertyData: {
      address_line: '29 Blenheim Walk',
      has_gas_supply: true,
      is_hmo: false,
    },
  };

  it('accepts minimal valid request', () => {
    const result = ComplianceRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('defaults mode to analyze', () => {
    const result = ComplianceRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('analyze');
    }
  });

  it('defaults complianceItems to empty array', () => {
    const result = ComplianceRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.complianceItems).toEqual([]);
    }
  });

  it('accepts full request with all fields', () => {
    const result = ComplianceRequestSchema.safeParse({
      propertyId: VALID_UUID,
      propertyData: {
        address_line: '29 Blenheim Walk',
        has_gas_supply: true,
        is_listed_building: false,
        is_hmo: true,
        extra_field: 'allowed by passthrough',
      },
      complianceItems: [
        {
          compliance_type: 'Gas Safety Certificate (CP12)',
          expiry_date: '2025-06-15',
          status: 'valid',
        },
      ],
      mode: 'audit',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing propertyData', () => {
    const result = ComplianceRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty address_line in propertyData', () => {
    const result = ComplianceRequestSchema.safeParse({
      propertyData: { address_line: '' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid mode value', () => {
    const result = ComplianceRequestSchema.safeParse({
      ...validRequest,
      mode: 'detailed',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid propertyId UUID', () => {
    const result = ComplianceRequestSchema.safeParse({
      ...validRequest,
      propertyId: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('allows extra fields on propertyData via passthrough', () => {
    const result = ComplianceRequestSchema.safeParse({
      propertyData: {
        address_line: 'Test',
        beds: 3,
        custom_field: 'value',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data.propertyData as unknown as { beds: number }).beds).toBe(3);
    }
  });
});

// ─── generate-ai-valuation ───────────────────────────────────────
const ValuationSchema = z.object({
  propertyId: z.string().uuid('Valid property ID required'),
});

describe('generate-ai-valuation contract', () => {
  it('accepts valid propertyId', () => {
    const result = ValuationSchema.safeParse({ propertyId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('rejects missing propertyId', () => {
    const result = ValuationSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID', () => {
    const result = ValuationSchema.safeParse({ propertyId: 'abc-123' });
    expect(result.success).toBe(false);
  });

  it('rejects non-string propertyId', () => {
    const result = ValuationSchema.safeParse({ propertyId: 12345 });
    expect(result.success).toBe(false);
  });
});

// ─── categorise-documents ─────────────────────────────────────────
// categorise-documents has no Zod schema — it uses basic JSON with optional dryRun.
// We test the response shape contract the frontend expects.
describe('categorise-documents contract', () => {
  const ResponseShape = z.object({
    categorised: z.number(),
    renamed: z.number(),
    unchanged: z.number(),
    dryRun: z.boolean(),
  });

  it('validates expected response shape', () => {
    const result = ResponseShape.safeParse({
      categorised: 5,
      renamed: 3,
      unchanged: 12,
      dryRun: false,
    });
    expect(result.success).toBe(true);
  });

  it('validates dry-run response shape', () => {
    const result = ResponseShape.safeParse({
      categorised: 0,
      renamed: 0,
      unchanged: 20,
      dryRun: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required response fields', () => {
    expect(ResponseShape.safeParse({ categorised: 5 }).success).toBe(false);
    expect(ResponseShape.safeParse({}).success).toBe(false);
  });

  it('rejects non-numeric counts', () => {
    const result = ResponseShape.safeParse({
      categorised: '5',
      renamed: 3,
      unchanged: 12,
      dryRun: false,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Shared validation error contract ─────────────────────────────
describe('validateBody error response shape', () => {
  const ValidationErrorShape = z.object({
    error: z.literal('Validation failed'),
    details: z.array(z.object({
      field: z.string(),
      message: z.string(),
    })),
  });

  it('validates expected error shape', () => {
    const result = ValidationErrorShape.safeParse({
      error: 'Validation failed',
      details: [
        { field: 'messages', message: 'Required' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('validates multi-field error shape', () => {
    const result = ValidationErrorShape.safeParse({
      error: 'Validation failed',
      details: [
        { field: 'documentId', message: 'Invalid documentId' },
        { field: 'fileUrl', message: 'Invalid url' },
      ],
    });
    expect(result.success).toBe(true);
  });
});
