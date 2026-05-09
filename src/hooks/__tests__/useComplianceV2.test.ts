/**
 * Regression tests for useComplianceV2.
 *
 * Locks in the core business rules:
 *   - status is derived from expiry_date (valid / expiring_soon / critical / expired)
 *   - creating a doc marks any existing current doc as superseded
 *   - creating a doc auto-closes any matching open compliance_task
 *   - toggle requirement clears override_reason when marking required
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderAppHook } from '@/test/renderHook';
import { createMockSupabase, type MockSupabase } from './supabaseMock';

let mock: MockSupabase;

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mock;
  },
  get supabaseAny() { return mock; },
}));

vi.mock('@/lib/storagePaths', () => ({
  extractStoragePath: (_bucket: string, url: string | null) => url,
  createSignedStorageUrl: vi.fn(),
}));

// existingCurrentDoc is flipped per-test to exercise supersede branching.
let existingCurrentDoc: { id: string } | null = null;
// openTask is flipped per-test to exercise auto-close branching.
let openTask: { id: string } | null = null;

beforeEach(() => {
  existingCurrentDoc = null;
  openTask = null;

  mock = createMockSupabase(({ table, op, filters }) => {
    if (table === 'compliance_documents_v2' && op === 'select') {
      // The "existing current doc" lookup in useCreateComplianceDocV2
      const isCurrent = filters.is_current as { eq: boolean } | undefined;
      if (isCurrent) return { data: existingCurrentDoc, error: null };
      return { data: [], error: null };
    }
    if (table === 'compliance_documents_v2' && (op === 'insert' || op === 'update')) {
      return {
        data: { id: 'doc-new', ...((mock.__lastCall()?.payload as object) ?? {}) },
        error: null,
      };
    }
    if (table === 'compliance_tasks' && op === 'select') {
      return { data: openTask, error: null };
    }
    if (table === 'compliance_tasks' && op === 'update') {
      return { data: null, error: null };
    }
    if (table === 'compliance_requirements' && op === 'update') {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
});

describe('useCreateComplianceDocV2 - status derivation', () => {
  it('flags a past expiry_date as "expired"', async () => {
    const { useCreateComplianceDocV2 } = await import('@/hooks/useComplianceV2');
    const { result } = renderAppHook(() => useCreateComplianceDocV2());

    await act(async () => {
      await result.current.mutateAsync({
        org_id: 'org-1',
        property_id: 'p1',
        document_type: 'gas_safety' as never,
        issue_date: '2024-01-01',
        expiry_date: '2024-06-01', // definitely in the past
      });
    });

    const insertCall = mock.__calls.find((c) => c.op === 'insert' && c.table === 'compliance_documents_v2');
    expect((insertCall?.payload as { status?: string })?.status).toBe('expired');
  });

  it('flags an expiry 20 days away as "critical"', async () => {
    const { useCreateComplianceDocV2 } = await import('@/hooks/useComplianceV2');
    const { result } = renderAppHook(() => useCreateComplianceDocV2());

    const in20Days = new Date();
    in20Days.setDate(in20Days.getDate() + 20);

    await act(async () => {
      await result.current.mutateAsync({
        org_id: 'org-1',
        property_id: 'p1',
        document_type: 'gas_safety' as never,
        issue_date: '2025-06-01',
        expiry_date: in20Days.toISOString().slice(0, 10),
      });
    });

    const insertCall = mock.__calls.find((c) => c.op === 'insert' && c.table === 'compliance_documents_v2');
    expect((insertCall?.payload as { status?: string })?.status).toBe('critical');
  });

  it('flags an expiry 60 days away as "expiring_soon"', async () => {
    const { useCreateComplianceDocV2 } = await import('@/hooks/useComplianceV2');
    const { result } = renderAppHook(() => useCreateComplianceDocV2());

    const in60Days = new Date();
    in60Days.setDate(in60Days.getDate() + 60);

    await act(async () => {
      await result.current.mutateAsync({
        org_id: 'org-1',
        property_id: 'p1',
        document_type: 'eicr' as never,
        issue_date: '2025-06-01',
        expiry_date: in60Days.toISOString().slice(0, 10),
      });
    });

    const insertCall = mock.__calls.find((c) => c.op === 'insert' && c.table === 'compliance_documents_v2');
    expect((insertCall?.payload as { status?: string })?.status).toBe('expiring_soon');
  });
});

describe('useCreateComplianceDocV2 - supersede existing', () => {
  it('marks an existing current doc as is_current=false before inserting', async () => {
    existingCurrentDoc = { id: 'old-doc-id' };
    const { useCreateComplianceDocV2 } = await import('@/hooks/useComplianceV2');
    const { result } = renderAppHook(() => useCreateComplianceDocV2());

    await act(async () => {
      await result.current.mutateAsync({
        org_id: 'org-1',
        property_id: 'p1',
        document_type: 'gas_safety' as never,
        issue_date: '2025-06-01',
      });
    });

    const updateCall = mock.__calls.find(
      (c) => c.op === 'update' && c.table === 'compliance_documents_v2',
    );
    expect(updateCall).toBeDefined();
    expect(updateCall?.filters.id).toEqual({ eq: 'old-doc-id' });
    expect((updateCall?.payload as { is_current?: boolean })?.is_current).toBe(false);

    const insertCall = mock.__calls.find(
      (c) => c.op === 'insert' && c.table === 'compliance_documents_v2',
    );
    expect((insertCall?.payload as { supersedes_id?: string })?.supersedes_id).toBe('old-doc-id');
  });
});

describe('useCreateComplianceDocV2 - auto-close open task', () => {
  it('completes a matching open compliance_task', async () => {
    openTask = { id: 'task-1' };
    const { useCreateComplianceDocV2 } = await import('@/hooks/useComplianceV2');
    const { result } = renderAppHook(() => useCreateComplianceDocV2());

    await act(async () => {
      await result.current.mutateAsync({
        org_id: 'org-1',
        property_id: 'p1',
        document_type: 'gas_safety' as never,
        issue_date: '2025-06-01',
      });
    });

    const taskUpdate = mock.__calls.find(
      (c) => c.op === 'update' && c.table === 'compliance_tasks',
    );
    expect(taskUpdate).toBeDefined();
    expect(taskUpdate?.filters.id).toEqual({ eq: 'task-1' });
    expect((taskUpdate?.payload as { status?: string })?.status).toBe('completed');
  });
});

describe('useToggleRequirementV2', () => {
  it('clears override_reason when marking as required', async () => {
    const { useToggleRequirementV2 } = await import('@/hooks/useComplianceV2');
    const { result } = renderAppHook(() => useToggleRequirementV2());

    await act(async () => {
      await result.current.mutateAsync({
        requirementId: 'req-1',
        isRequired: true,
        overrideReason: 'should be ignored because isRequired=true',
      });
    });

    const call = mock.__calls.find(
      (c) => c.op === 'update' && c.table === 'compliance_requirements',
    );
    expect((call?.payload as { is_required?: boolean })?.is_required).toBe(true);
    expect((call?.payload as { override_reason?: string | null })?.override_reason).toBeNull();
  });

  it('persists override_reason when marking as not required', async () => {
    const { useToggleRequirementV2 } = await import('@/hooks/useComplianceV2');
    const { result } = renderAppHook(() => useToggleRequirementV2());

    await act(async () => {
      await result.current.mutateAsync({
        requirementId: 'req-1',
        isRequired: false,
        overrideReason: 'listed building exempt',
      });
    });

    const call = mock.__calls.find(
      (c) => c.op === 'update' && c.table === 'compliance_requirements',
    );
    expect((call?.payload as { override_reason?: string })?.override_reason).toBe(
      'listed building exempt',
    );
  });
});

describe('useRefreshComplianceStatuses', () => {
  it('invokes the refresh_compliance_statuses_v2 RPC', async () => {
    const { useRefreshComplianceStatuses } = await import('@/hooks/useComplianceV2');
    const { result } = renderAppHook(() => useRefreshComplianceStatuses());

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mock.rpc).toHaveBeenCalledWith('refresh_compliance_statuses_v2');
  });
});
