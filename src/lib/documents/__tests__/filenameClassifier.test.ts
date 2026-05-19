import { describe, it, expect } from 'vitest';
import { extractDateFromFilename, classifyFilename } from '../filenameClassifier';

describe('extractDateFromFilename', () => {
  it('parses ISO dates with various separators', () => {
    expect(extractDateFromFilename('EICR_2025-03-15.pdf')).toBe('2025-03-15');
    expect(extractDateFromFilename('gas_2024_11_02.pdf')).toBe('2024-11-02');
    expect(extractDateFromFilename('epc.2023.07.04.pdf')).toBe('2023-07-04');
  });
  it('parses UK day-first dates', () => {
    expect(extractDateFromFilename('Gas-Cert-15-03-2025.pdf')).toBe('2025-03-15');
    expect(extractDateFromFilename('EICR 02/11/2024.pdf')).toBe('2024-11-02');
  });
  it('parses month-name dates', () => {
    expect(extractDateFromFilename('EICR-15-Mar-2025.pdf')).toBe('2025-03-15');
    expect(extractDateFromFilename('Gas 1 Jan 2024.pdf')).toBe('2024-01-01');
  });
  it('falls back to month-year', () => {
    expect(extractDateFromFilename('EPC Mar-2025.pdf')).toBe('2025-03-01');
  });
  it('rejects implausible years and noise', () => {
    expect(extractDateFromFilename('cert-1234.pdf')).toBeNull();
    expect(extractDateFromFilename('no-date-here.pdf')).toBeNull();
    expect(extractDateFromFilename('')).toBeNull();
  });
});

describe('classifyFilename (sanity)', () => {
  it('still matches known categories', () => {
    expect(classifyFilename('gas-safety-cp12.pdf').category).toBe('gas_safety_certificate');
    expect(classifyFilename('EICR_2025-03-15.pdf').category).toBe('electrical_certificate');
    expect(classifyFilename('random.pdf').category).toBeNull();
  });
});
