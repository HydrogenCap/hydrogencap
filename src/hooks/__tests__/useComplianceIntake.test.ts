/**
 * Regression tests for useComplianceIntake — §0b Ship A invariant.
 *
 * After §0b Ship A (kill double-writers), useAcceptComplianceDocument MUST
 * NOT write to the V1 `compliance_items` or `compliance_documents` tables.
 * Only V2 (`compliance_documents_v2`) writes are permitted.
 *
 * The previous test asserted V1 mirror behaviour — that mirror has been
 * removed. This file now asserts the inverse invariant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderAppHook } from '@/test/renderHook';
import { createMockSupabase, type MockSupabase, type QueryState } from './supabaseMock';

let mock: MockSupabase;

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mock;
  },
  get supabaseAny() {
    return mock;
  },
}));

vi.mock('@/lib/storagePaths', () => ({
  extractStoragePath: () => null,
  createSignedStorageUrl: vi.fn(),
}));

vi.mock('@/hooks/useUserOrg', () => ({
  fetchUserOrgId: vi.fn(async () => 'org-1'),
}));

beforeEach(() => {
  mock = createMockSupabase(({ table, op }) => {
    if (table === 'compliance_documents_v2' && op === 'select') {
      return { data: null, error: null };
    }
    if (table === 'compliance_documents_v2' && op === 'insert') {
      return { data: { id: 'v2-doc-1' }, error: null };
    }
    if (table === 'compliance_documents_v2' && op === 'update') {
      return { data: null, error: null };
    }
    if (table === 'documents' && op === 'select') {
      return {
        data: {
          extracted_certifier_name: null,
          extracted_certifier_company: null,
          extracted_reference_number: null,
        },
        error: null,
      };
    }
    if (table === 'documents' && op === 'update') {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
});

describe('useAcceptComplianceDocument — §0b Ship A invariant (no V1 writes)', () => {
  const baseParams = {
    documentId: 'inbox-doc-1',
    docType: 'gas_safety_certificate',
    propertyId: 'p1',
    propertyAddress: '5 Oak Lane',
    issueDate: '2025-04-01',
    expiryDate: '2026-04-01',
    originalFilename: 'gas-cert.pdf',
    fileUrl: 'documents/inbox/gas-cert.pdf',
    wasEdited: false,
    originalAiSuggestions: undefined,
  };

  it('does NOT write to compliance_items (V1) during intake', async () => {
    const { useAcceptComplianceDocument } = await import('@/hooks/useComplianceIntake');
    const { result } = renderAppHook(() => useAcceptComplianceDocument());

    await act(async () => {
      await result.current.mutateAsync(baseParams);
    });

    const v1ItemWrites = mock.__calls.filter(
      (c: QueryState) =>
        c.table === 'compliance_items' &&
        (c.op === 'insert' || c.op === 'update' || c.op === 'upsert' || c.op === 'delete'),
    );
    expect(v1ItemWrites).toEqual([]);
  });

  it('does NOT write to compliance_documents (V1) during intake', async () => {
    const { useAcceptComplianceDocument } = await import('@/hooks/useComplianceIntake');
    const { result } = renderAppHook(() => useAcceptComplianceDocument());

    await act(async () => {
      await result.current.mutateAsync(baseParams);
    });

    const v1DocWrites = mock.__calls.filter(
      (c: QueryState) =>
        c.table === 'compliance_documents' &&
        (c.op === 'insert' || c.op === 'update' || c.op === 'upsert' || c.op === 'delete'),
    );
    expect(v1DocWrites).toEqual([]);
  });

  it('still writes the V2 compliance_documents_v2 record', async () => {
    const { useAcceptComplianceDocument } = await import('@/hooks/useComplianceIntake');
    const { result } = renderAppHook(() => useAcceptComplianceDocument());

    await act(async () => {
      await result.current.mutateAsync(baseParams);
    });

    const v2Insert = mock.__calls.find(
      (c: QueryState) => c.table === 'compliance_documents_v2' && c.op === 'insert',
    );
    expect(v2Insert).toBeDefined();
  });
});
