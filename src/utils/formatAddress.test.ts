import { describe, it, expect } from 'vitest';
import { formatPropertyAddress } from './formatAddress';

describe('formatPropertyAddress', () => {
  it('combines address and city', () => {
    expect(formatPropertyAddress('10 High Street', 'Oxford')).toBe('10 High Street, Oxford');
  });

  it('avoids duplicating city when already in address', () => {
    expect(formatPropertyAddress('10 High Street, Oxford', 'Oxford')).toBe('10 High Street, Oxford');
  });

  it('handles case-insensitive deduplication', () => {
    expect(formatPropertyAddress('10 High Street, OXFORD', 'Oxford')).toBe('10 High Street, OXFORD');
  });

  it('returns just address when city is null', () => {
    expect(formatPropertyAddress('10 High Street', null)).toBe('10 High Street');
  });

  it('returns just city when address is null', () => {
    expect(formatPropertyAddress(null, 'Oxford')).toBe('Oxford');
  });

  it('returns empty string when both are null', () => {
    expect(formatPropertyAddress(null, null)).toBe('');
  });

  it('handles undefined values', () => {
    expect(formatPropertyAddress(undefined, undefined)).toBe('');
  });
});
