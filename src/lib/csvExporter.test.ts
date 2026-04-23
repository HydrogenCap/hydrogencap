import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { propertiesToExportable, generateCSV, downloadCSV } from './csvExporter';
import type { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';

function property(overrides: Partial<PropertyWithFinancials> = {}): PropertyWithFinancials {
  return {
    id: 'p1',
    address_line: '10 High Street',
    address_line2: null,
    area_name: null,
    postcode: 'OX1 1AA',
    property_type: 'single_let',
    beds: 3,
    bathrooms: 1,
    current_value_gbp: 300_000,
    purchase_price_gbp: 250_000,
    ownership_entity: 'Acme Ltd',
    ownership_percent: 100,
    epc_rating: 'C',
    notes: null,
    loans: [],
    income: [],
    costs: [],
    tenancies: [],
    ...overrides,
  } as unknown as PropertyWithFinancials;
}

describe('propertiesToExportable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an empty array when no properties are supplied', () => {
    expect(propertiesToExportable([])).toEqual([]);
  });

  it('maps core property fields without loan/income data', () => {
    const [row] = propertiesToExportable([property({ id: 'abc', address_line: 'x', postcode: 'OX1' })]);
    expect(row.id).toBe('abc');
    expect(row.address_line).toBe('x');
    expect(row.postcode).toBe('OX1');
    expect(row.mortgage_balance_gbp).toBeNull();
    expect(row.lender).toBeNull();
    expect(row.annual_rent_gbp).toBeNull();
  });

  it('pulls the first loan\'s fields into the flat row', () => {
    const [row] = propertiesToExportable([property({
      loans: [{
        current_mortgage_balance_gbp: 150_000,
        lender: 'MegaBank',
        interest_rate_percent: 4.25,
        mortgage_payment_gbp: 750,
        fixed_rate_expires: '2027-06-01',
      } as PropertyWithFinancials['loans'][0]],
    })]);
    expect(row.mortgage_balance_gbp).toBe(150_000);
    expect(row.lender).toBe('MegaBank');
    expect(row.interest_rate_percent).toBe(4.25);
    expect(row.mortgage_payment_gbp).toBe(750);
    expect(row.fixed_rate_expires).toBe('2027-06-01');
  });

  it('prefers the current-year income row when present', () => {
    const [row] = propertiesToExportable([property({
      income: [
        { year: 2024, annual_rent_gbp: 11_000 } as PropertyWithFinancials['income'][0],
        { year: 2025, annual_rent_gbp: 13_500 } as PropertyWithFinancials['income'][0],
      ],
    })]);
    expect(row.annual_rent_gbp).toBe(13_500);
  });

  it('falls back to the first income row when no current-year row exists', () => {
    const [row] = propertiesToExportable([property({
      income: [
        { year: 2023, annual_rent_gbp: 9_000 } as PropertyWithFinancials['income'][0],
      ],
    })]);
    expect(row.annual_rent_gbp).toBe(9_000);
  });

  it('converts numeric-ish fields via Number() so string input works', () => {
    const [row] = propertiesToExportable([property({
      current_value_gbp: '350000' as unknown as number,
      purchase_price_gbp: '280000' as unknown as number,
    })]);
    expect(row.current_value_gbp).toBe(350_000);
    expect(row.purchase_price_gbp).toBe(280_000);
  });
});

describe('generateCSV', () => {
  it('generates a header row with all 20 columns', () => {
    const csv = generateCSV([]);
    const [header] = csv.split('\n');
    expect(header.split(',')).toHaveLength(20);
    expect(header).toContain('Property ID');
    expect(header).toContain('Address');
    expect(header).toContain('EPC Rating');
    expect(header).toContain('Annual Rent (£)');
  });

  it('returns only the header when there are no properties', () => {
    const csv = generateCSV([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
  });

  it('writes one row per property', () => {
    const csv = generateCSV([
      property({ id: 'p1', address_line: '10 High St' }),
      property({ id: 'p2', address_line: '5 Low Rd' }),
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toMatch(/^p1,/);
    expect(lines[2]).toMatch(/^p2,/);
  });

  it('escapes comma-containing values by wrapping in quotes', () => {
    const csv = generateCSV([property({ address_line: '5, Commercial Road' })]);
    expect(csv).toContain('"5, Commercial Road"');
  });

  it('escapes embedded double-quotes by doubling them', () => {
    const csv = generateCSV([property({ notes: 'Had a chat with "Bob" about the drains' })]);
    expect(csv).toContain('"Had a chat with ""Bob"" about the drains"');
  });

  it('escapes newlines in a quoted field', () => {
    const csv = generateCSV([property({ notes: 'Line one\nLine two' })]);
    // The whole cell is quoted because it contains a newline.
    expect(csv).toContain('"Line one\nLine two"');
  });

  it('writes empty strings for null values', () => {
    const csv = generateCSV([property({ beds: null, bathrooms: null, ownership_entity: null })]);
    const dataRow = csv.split('\n')[1];
    // Expect at least a couple of back-to-back empty commas from the nulls.
    expect(dataRow).toMatch(/,,/);
  });

  it('serialises a numeric field as a bare number (no thousand separator)', () => {
    const csv = generateCSV([property({ current_value_gbp: 1_234_567 })]);
    expect(csv).toContain('1234567');
  });
});

describe('downloadCSV', () => {
  beforeEach(() => {
    // jsdom doesn't implement URL.createObjectURL by default.
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a blob, triggers a download, and revokes the URL', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const clickSpy = vi.fn();
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(((node: Node) => node) as typeof document.body.appendChild);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(((node: Node) => node) as typeof document.body.removeChild);
    const origCreate = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const link = origCreate('a') as HTMLAnchorElement;
        link.click = clickSpy;
        return link;
      }
      return origCreate(tag);
    });

    downloadCSV([property({})], 'test.csv');

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake');
  });

  it('uses "properties.csv" as the default filename', () => {
    let capturedHref: string | undefined;
    let capturedDownload: string | undefined;
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const link = origCreate('a') as HTMLAnchorElement;
        Object.defineProperty(link, 'href', { set: (v: string) => { capturedHref = v; } });
        Object.defineProperty(link, 'download', { set: (v: string) => { capturedDownload = v; } });
        link.click = vi.fn();
        return link;
      }
      return origCreate(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(((node: Node) => node) as typeof document.body.appendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(((node: Node) => node) as typeof document.body.removeChild);

    downloadCSV([property({})]);

    expect(capturedHref).toBe('blob:fake');
    expect(capturedDownload).toBe('properties.csv');
  });
});
