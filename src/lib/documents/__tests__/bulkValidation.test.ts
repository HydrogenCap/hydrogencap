import { describe, it, expect } from 'vitest';
import { validateItem, validateBatch, summariseIssues } from '../bulkValidation';
import type { QueueItem } from '@/hooks/useBulkDocumentUpload';

function makeItem(over: Partial<QueueItem> = {}): QueueItem {
  return {
    id: over.id ?? 'i1',
    file: over.file ?? (new File(['x'], over.file?.name ?? 'EICR.pdf', { type: 'application/pdf' })),
    relativePath: '',
    thumbnailUrl: null,
    storagePath: 'org/inbox/x.pdf',
    documentId: 'doc1',
    status: over.status ?? 'done',
    error: over.error ?? null,
    filenameHint: over.filenameHint,
    classification: over.classification ?? {
      documentType: 'electrical_certificate',
      confidence: 0.9,
      category: 'electrical_certificate',
    },
    extraction: over.extraction ?? {
      address: '12 Acacia Ave',
      postcode: 'SW1A1AA',
      expiryDate: '2099-01-01',
      issueDate: '2025-01-01',
      certificateNumber: 'X',
      rating: null,
      fieldConfidences: {},
    },
    matchedPropertyId: over.matchedPropertyId ?? 'p1',
    selectedPropertyId: over.selectedPropertyId ?? null,
    retryCount: 0,
  } as QueueItem;
}

describe('validateItem', () => {
  it('returns critical for processing failure', () => {
    const issues = validateItem(makeItem({ status: 'error', error: 'Network down' }));
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('processing_failed');
    expect(issues[0].severity).toBe('critical');
  });

  it('flags missing property', () => {
    const issues = validateItem(makeItem({ matchedPropertyId: null, selectedPropertyId: null }));
    expect(issues.map((i) => i.code)).toContain('no_property');
  });

  it('flags category disagreement', () => {
    const item = makeItem({
      classification: { documentType: 'epc', confidence: 0.9, category: 'epc' },
      filenameHint: { category: 'electrical_certificate', confidence: 0.9, reason: 'match' },
    });
    expect(validateItem(item).map((i) => i.code)).toContain('category_disagreement');
  });

  it('flags low category confidence', () => {
    const item = makeItem({
      classification: { documentType: 'epc', confidence: 0.5, category: 'epc' },
    });
    expect(validateItem(item).map((i) => i.code)).toContain('low_category_confidence');
  });

  it('flags missing expiry for required cert categories', () => {
    const item = makeItem({
      extraction: {
        address: null, postcode: null, expiryDate: null, issueDate: null,
        certificateNumber: null, rating: null, fieldConfidences: {},
      },
    });
    expect(validateItem(item).map((i) => i.code)).toContain('missing_expiry');
  });

  it('flags expired certificate', () => {
    const item = makeItem({
      extraction: {
        address: null, postcode: null, expiryDate: '2000-01-01', issueDate: null,
        certificateNumber: null, rating: null, fieldConfidences: {},
      },
    });
    expect(validateItem(item).map((i) => i.code)).toContain('expired');
  });

  it('flags low field confidence', () => {
    const item = makeItem({
      extraction: {
        address: 'x', postcode: null, expiryDate: '2099-01-01', issueDate: null,
        certificateNumber: null, rating: null,
        fieldConfidences: { address: 0.4 },
      },
    });
    expect(validateItem(item).map((i) => i.code)).toContain('low_field_confidence');
  });

  it('returns nothing for clean items', () => {
    expect(validateItem(makeItem())).toHaveLength(0);
  });
});

describe('validateBatch', () => {
  it('flags duplicate filenames', () => {
    const a = makeItem({ id: 'a', file: new File(['x'], 'EICR.pdf') });
    const b = makeItem({ id: 'b', file: new File(['x'], 'EICR.pdf') });
    const codes = validateBatch([a, b]).map((i) => i.code);
    expect(codes.filter((c) => c === 'duplicate_filename')).toHaveLength(2);
  });
});

describe('summariseIssues', () => {
  it('counts by severity', () => {
    const s = summariseIssues([
      { itemId: '1', fileName: 'a', severity: 'critical', code: 'x', message: '' },
      { itemId: '2', fileName: 'b', severity: 'warning', code: 'x', message: '' },
      { itemId: '3', fileName: 'c', severity: 'warning', code: 'x', message: '' },
      { itemId: '4', fileName: 'd', severity: 'info', code: 'x', message: '' },
    ]);
    expect(s).toEqual({ critical: 1, warning: 2, info: 1, total: 4 });
  });
});
