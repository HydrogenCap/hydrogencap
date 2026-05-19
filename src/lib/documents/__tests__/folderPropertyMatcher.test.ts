import { describe, it, expect } from 'vitest';
import { matchPropertyFromFolder, folderSegmentsOf } from '../folderPropertyMatcher';

const PROPS = [
  { id: 'p1', address_line_1: '12 Acacia Avenue', postcode: 'SW1A 1AA' },
  { id: 'p2', address_line_1: 'Flat 4 Marlborough Road', postcode: 'E1 6AN' },
  { id: 'p3', address_line_1: 'The Old Mill', postcode: 'BS1 4DG' },
];

describe('folderSegmentsOf', () => {
  it('returns empty for flat files', () => {
    expect(folderSegmentsOf('EICR.pdf')).toBe('');
    expect(folderSegmentsOf('')).toBe('');
  });
  it('returns folder portion', () => {
    expect(folderSegmentsOf('12 Acacia Avenue/EICR.pdf')).toBe('12 Acacia Avenue');
    expect(folderSegmentsOf('a/b/EICR.pdf')).toBe('a b');
  });
});

describe('matchPropertyFromFolder', () => {
  it('matches by postcode in folder name', () => {
    expect(matchPropertyFromFolder('Random Folder SW1A 1AA/EICR.pdf', PROPS)).toBe('p1');
    expect(matchPropertyFromFolder('Marlborough E1 6AN/EPC.pdf', PROPS)).toBe('p2');
  });
  it('matches by full address substring', () => {
    expect(matchPropertyFromFolder('12 Acacia Avenue/Gas.pdf', PROPS)).toBe('p1');
    expect(matchPropertyFromFolder('Flat 4 Marlborough Road/AST.pdf', PROPS)).toBe('p2');
  });
  it('matches by partial folder inside address', () => {
    // "Acacia" is short → only matches if it appears in address_line_1.
    expect(matchPropertyFromFolder('Acacia/EICR.pdf', PROPS)).toBe('p1');
  });
  it('returns null for flat drops or unknown folders', () => {
    expect(matchPropertyFromFolder('EICR.pdf', PROPS)).toBeNull();
    expect(matchPropertyFromFolder('Totally Unknown/EICR.pdf', PROPS)).toBeNull();
  });
  it('handles empty properties list', () => {
    expect(matchPropertyFromFolder('12 Acacia Avenue/x.pdf', [])).toBeNull();
  });
});
