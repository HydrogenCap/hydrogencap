/**
 * Regression tests for useComplianceIntake — V1 mirror behaviour.
 *
 * useAcceptComplianceDocument writes the canonical V2 row, then mirrors
 * the issue/expiry dates into the legacy V1 `compliance_items` table so
 * Property Detail, Compliance Calendar and Go-Live Checklist stay in
 * sync without a separate manual entry.
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

let existingV1Item: { id: string; expiry_date: string | null } | null = null;

beforeEach(() => {
  existingV1Item = null;

  mock = createMockSupabase(({ table, op, filters }) => {
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
    if (table === 'compliance_items' && op === 'select') {
      const propEq = (filters.property_id as { eq: string } | undefined)?.eq;
      const typeEq = (filters.compliance_type as { eq: string } | undefined)?.eq;
      if (propEq && typeEq && existingV1Item) {
        return { data: existingV1Item, error: null };
      }
      return { data: null, error: null };
    }
    if (table === 'compliance_items' && (op === 'insert' || op === 'update')) {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
});

describe('useAcceptComplianceDocument — V1 mirror', () => {
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

  it('inserts a new compliance_items row when none exists for that property + type', async () => {
    existingV1Item = null;

    const { useAcceptComplianceDocument } = await import('@/hooks/useComplianceIntake');
    const { result } = renderAppHook(() => useAcceptComplianceDocument());

    await act(async () => {
      await result.current.mutateAsync(baseParams);
    });

    const v1Insert = mock.__calls.find(
      (c: QueryState) => c.table === 'compliance_items' && c.op === 'insert'
    );
    expect(v1Insert).toBeDefined();
    const payload = v1Insert?.payload as Record<string, unknown>;
    expect(payload.org_id).toBe('org-1');
    expect(payload.property_id).toBe('p1');
    expect(payload.compliance_type).toBe('Gas Safety Certificate (CP12)');
    expect(payload.issue_date).toBe('2025-04-01');
    expect(payload.expiry_date).toBe('2026-04-01');
    expect(payload.is_required).toBe(true);
    expect(payload.is_manually_excluded).toBe(false);
  });

  it('updates an existing compliance_items row and clears renewal / reminder state', async () => {
    existingV1Item = { id: 'item-existing', expiry_date: '2024-04-01' };

    const { useAcceptComplianceDocument } = await import('@/hooks/useComplianceIntake');
    const { result } = renderAppHook(() => useAcceptComplianceDocument());

    await act(async () => {
      await result.current.mutateAsync(baseParams);
    });

    const v1Update = mock.__calls.find(
      (c: QueryState) => c.table === 'compliance_items' && c.op === 'update'
    );
    expect(v1Update).toBeDefined();
    const payload = v1Update?.payload as Record<string, unknown>;
    expect(payload.expiry_date).toBe('2026-04-01');
    expect(payload.renewal_status).toBeNull();
    expect(payload.last_reminder_sent_at).toBeNull();
    expect(payload.reminder_count).toBe(0);

    // Filter targets the existing row by id
    const idEq = (v1Update?.filters.id as { eq: string } | undefined)?.eq;
    expect(idEq).toBe('item-existing');
  });
});
