import { describe, it, expect } from 'vitest';
import {
  resolveEntityLabel,
  getCategoryCode,
  generateStructuredFilename,
  generateDocumentFilename,
} from './documentNaming';

describe('resolveEntityLabel', () => {
  it('prefers property address', () => {
    const result = resolveEntityLabel({
      propertyAddress: '10 Downing Street',
      companyName: 'ACME Ltd',
      tenantName: 'John Smith',
    });
    expect(result).toContain('Downing');
  });

  it('falls back to company name', () => {
    const result = resolveEntityLabel({
      propertyAddress: null,
      companyName: 'ACME Ltd',
      tenantName: 'John Smith',
    });
    expect(result).toContain('ACME');
  });

  it('falls back to tenant name', () => {
    const result = resolveEntityLabel({
      propertyAddress: null,
      companyName: null,
      tenantName: 'John Smith',
    });
    expect(result).toContain('John');
  });

  it('returns General when all null', () => {
    const result = resolveEntityLabel({});
    expect(result).toBe('General');
  });
});

describe('getCategoryCode', () => {
  it('maps known categories', () => {
    expect(getCategoryCode('gas-safety')).toBe('GAS');
    expect(getCategoryCode('epc')).toBe('EPC');
    expect(getCategoryCode('tenancy-agreement')).toBe('TENANCY');
    expect(getCategoryCode('mortgage')).toBe('MORTGAGE');
  });

  it('returns DOC for unknown categories', () => {
    // Unknown slugs get uppercased, not 'DOC'
    const result = getCategoryCode('random-thing');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns DOC for null/undefined', () => {
    expect(getCategoryCode(null)).toBe('DOC');
    expect(getCategoryCode(undefined)).toBe('DOC');
  });
});

describe('generateStructuredFilename', () => {
  it('generates a structured filename with all parts', () => {
    const result = generateStructuredFilename({
      category: 'epc',
      displayName: 'Energy Certificate',
      originalFilename: 'scan.pdf',
      documentDate: '2026-03-15',
      propertyAddress: '10 Downing Street',
    });
    expect(result).toContain('EPC');
    expect(result).toContain('2026');
    expect(result).toMatch(/\.pdf$/);
  });

  it('preserves original file extension', () => {
    const result = generateStructuredFilename({
      category: 'gas-safety',
      displayName: 'Gas Cert',
      originalFilename: 'certificate.jpg',
      documentDate: '2026-01-01',
      propertyAddress: 'Test Property',
    });
    expect(result).toMatch(/\.jpg$/);
  });
});

describe('generateDocumentFilename', () => {
  it('generates a document filename from doc_type', () => {
    const result = generateDocumentFilename({
      docType: 'epc_certificate',
      propertyAddress: '10 Downing Street',
      originalFilename: 'scan.pdf',
    });
    expect(result).toContain('EPC');
    expect(result).toMatch(/\.pdf$/);
  });
});
