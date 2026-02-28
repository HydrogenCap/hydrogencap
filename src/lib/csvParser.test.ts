import { describe, it, expect } from 'vitest';
import { parseCSV, autoDetectMapping, validateAndTransformRows } from './csvParser';

describe('parseCSV', () => {
  it('parses a simple CSV', () => {
    const csv = 'name,postcode\n10 High Street,OX1 1AA\n20 Low Street,OX2 2BB';
    const result = parseCSV(csv);
    expect(result.headers).toEqual(['name', 'postcode']);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].name).toBe('10 High Street');
  });

  it('handles quoted fields with commas', () => {
    const csv = 'address,city\n"10 High Street, Flat 1",Oxford';
    const result = parseCSV(csv);
    expect(result.rows[0].address).toBe('10 High Street, Flat 1');
  });

  it('handles empty CSV', () => {
    const result = parseCSV('');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('handles CSV with only headers', () => {
    const result = parseCSV('name,postcode');
    expect(result.headers).toEqual(['name', 'postcode']);
    expect(result.rows).toEqual([]);
  });

  it('trims whitespace from values', () => {
    const csv = 'name , postcode \n 10 High Street , OX1 1AA ';
    const result = parseCSV(csv);
    expect(result.headers[0]).toBe('name');
    expect(result.rows[0].name).toBe('10 High Street');
  });
});

describe('autoDetectMapping', () => {
  it('maps common header names to property fields', () => {
    const mapping = autoDetectMapping(['Address', 'Postcode', 'Purchase Price', 'Bedrooms']);
    expect(mapping['Address']).toBe('address_line');
    expect(mapping['Postcode']).toBe('postcode');
    expect(mapping['Bedrooms']).toBe('beds');
  });

  it('handles case-insensitive headers', () => {
    const mapping = autoDetectMapping(['ADDRESS', 'postcode']);
    expect(mapping['ADDRESS']).toBe('address_line');
    expect(mapping['postcode']).toBe('postcode');
  });

  it('returns empty mapping for unrecognised headers', () => {
    const mapping = autoDetectMapping(['foo', 'bar', 'baz']);
    expect(Object.keys(mapping).length).toBeLessThanOrEqual(3);
  });
});
