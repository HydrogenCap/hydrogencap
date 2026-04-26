import { describe, it, expect } from 'vitest';
import { generatePassportPDF, slugifyAddress, type PassportPropertyData } from '../passport';

const sampleData: PassportPropertyData = {
  address_line_1: '12 Test Street',
  address_line_2: null,
  city: 'London',
  postcode: 'SW1A 1AA',
  property_type: 'HMO Licensed',
  bedrooms: 5,
  monthly_rent: 3200,
  current_valuation: 650000,
  owner_entity_name: 'Acme Holdings Ltd',
  cover_photo_data_url: null,
  compliance: [
    { type: 'Gas Safety', status: 'valid', expiry_date: '2026-12-01' },
    { type: 'EICR', status: 'expiring_soon', expiry_date: '2026-05-15' },
    { type: 'EPC', status: 'expired', expiry_date: '2025-01-01' },
  ],
  tenancies: [
    { tenant_name: 'Jane Doe', start_date: '2024-06-01', end_date: '2025-06-01', rent_pcm: 800 },
  ],
  financials: {
    gross_rent_annual: 38400,
    total_costs_annual: 12000,
    noi_annual: 26400,
    mortgage_balance: 320000,
    equity: 330000,
  },
  documents: [
    { name: 'Gas-Safety-2025.pdf', doc_type: 'Gas Safety', date: '2025-12-01' },
    { name: 'EPC-2024.pdf', doc_type: 'EPC', date: '2024-01-15' },
  ],
};

describe('generatePassportPDF', () => {
  it('returns a jsPDF instance with a non-empty blob output', () => {
    const doc = generatePassportPDF(sampleData);
    expect(doc).toBeDefined();

    const blob = doc.output('blob');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('produces multiple pages (cover + content)', () => {
    const doc = generatePassportPDF(sampleData);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it('handles empty compliance/tenancies/documents gracefully', () => {
    const doc = generatePassportPDF({
      ...sampleData,
      compliance: [],
      tenancies: [],
      documents: [],
    });
    const blob = doc.output('blob');
    expect(blob.size).toBeGreaterThan(500);
  });
});

describe('slugifyAddress', () => {
  it('lowercases and dasherises', () => {
    expect(slugifyAddress('12 Test Street, London')).toBe('12-test-street-london');
  });
  it('falls back to "property" for empty input', () => {
    expect(slugifyAddress('!!!')).toBe('property');
  });
});
