/**
 * Regression tests for useCreateTasksFromAIAnalysis.
 *
 * The AI compliance checker returns requirements with status / priority
 * for a property. This hook turns the actionable subset (missing /
 * expired / expiring_soon required items) into compliance_tasks rows,
 * skipping any document_type that already has an active task so re-runs
 * don't pile up duplicates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderAppHook } from '@/test/renderHook';
import { createMockSupabase, type MockSupabase, type QueryState } from './supabaseMock';
import type { AIComplianceRequirement } from '@/hooks/useAIComplianceChecker';

let mock: MockSupabase;
let existingActiveDocTypes: string[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mock; },
  get supabaseAny() { return mock; },
}));

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { id: 'org-1' } }),
}));

beforeEach(() => {
  existingActiveDocTypes = [];
  mock = createMockSupabase(({ table, op }) => {
    if (table === 'compliance_tasks' && op === 'select') {
      // The duplicate-detection lookup
      return {
        data: existingActiveDocTypes.map((dt) => ({ document_type: dt })),
        error: null,
      };
    }
    if (table === 'compliance_tasks' && op === 'insert') {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
});

const req = (overrides: Partial<AIComplianceRequirement> = {}): AIComplianceRequirement => ({
  type: 'Gas Safety Certificate (CP12)',
  required: true,
  reason: 'Property has gas supply',
  status: 'missing',
  priority: 'high',
  recommendation: 'Book a Gas Safe engineer',
  ...overrides,
});

describe('useCreateTasksFromAIAnalysis', () => {
  it('creates one task per actionable requirement when no duplicates exist', async () => {
    existingActiveDocTypes = [];

    const { useCreateTasksFromAIAnalysis } = await import('@/hooks/useComplianceTasks');
    const { result } = renderAppHook(() => useCreateTasksFromAIAnalysis());

    let outcome: { created: number; skipped: number; total: number } | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        propertyId: 'p1',
        requirements: [
          req({ type: 'Gas Safety Certificate (CP12)', status: 'missing', priority: 'high' }),
          req({ type: 'EICR', status: 'expired', priority: 'high' }),
          req({ type: 'EPC', status: 'expiring_soon', priority: 'medium' }),
        ],
      });
    });

    expect(outcome).toEqual({ created: 3, skipped: 0, total: 3 });

    const insertCall = mock.__calls.find(
      (c: QueryState) => c.table === 'compliance_tasks' && c.op === 'insert'
    );
    expect(insertCall).toBeDefined();
    const inserted = insertCall?.payload as Array<Record<string, unknown>>;
    expect(inserted).toHaveLength(3);

    const gas = inserted.find((t) => t.document_type === 'Gas Safety Certificate (CP12)');
    expect(gas?.task_type).toBe('missing_document');
    expect(gas?.priority).toBe('high');
    expect(gas?.title).toBe('Upload Gas Safety Certificate (CP12)');
    expect(gas?.description).toBe('Book a Gas Safe engineer');
    expect(gas?.status).toBe('open');
    expect(gas?.org_id).toBe('org-1');
    expect(gas?.property_id).toBe('p1');
    expect(gas?.source).toBe('auto');

    const eicr = inserted.find((t) => t.document_type === 'EICR');
    expect(eicr?.task_type).toBe('expired');
    expect(eicr?.title).toBe('Renew expired EICR');

    const epc = inserted.find((t) => t.document_type === 'EPC');
    expect(epc?.task_type).toBe('renewal_due');
    expect(epc?.priority).toBe('medium');
    expect(epc?.title).toBe('Renew EPC');
  });

  it('skips requirements that already have an active task on the same document_type', async () => {
    existingActiveDocTypes = ['Gas Safety Certificate (CP12)'];

    const { useCreateTasksFromAIAnalysis } = await import('@/hooks/useComplianceTasks');
    const { result } = renderAppHook(() => useCreateTasksFromAIAnalysis());

    let outcome: { created: number; skipped: number; total: number } | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        propertyId: 'p1',
        requirements: [
          req({ type: 'Gas Safety Certificate (CP12)', status: 'missing' }),
          req({ type: 'EICR', status: 'missing' }),
        ],
      });
    });

    expect(outcome).toEqual({ created: 1, skipped: 1, total: 2 });

    const insertCall = mock.__calls.find(
      (c: QueryState) => c.table === 'compliance_tasks' && c.op === 'insert'
    );
    const inserted = insertCall?.payload as Array<Record<string, unknown>>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0].document_type).toBe('EICR');
  });

  it('ignores requirements that are valid, not_required, or marked not required', async () => {
    const { useCreateTasksFromAIAnalysis } = await import('@/hooks/useComplianceTasks');
    const { result } = renderAppHook(() => useCreateTasksFromAIAnalysis());

    let outcome: { created: number; skipped: number; total: number } | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        propertyId: 'p1',
        requirements: [
          req({ type: 'EPC', status: 'valid' }),
          req({ type: 'PAT Testing', status: 'not_required' }),
          req({ type: 'Optional Inspection', status: 'missing', required: false }),
        ],
      });
    });

    expect(outcome).toEqual({ created: 0, skipped: 0, total: 0 });
    const insertCall = mock.__calls.find(
      (c: QueryState) => c.table === 'compliance_tasks' && c.op === 'insert'
    );
    expect(insertCall).toBeUndefined();
  });

  it('returns zero results without an insert when every actionable item already has a task', async () => {
    existingActiveDocTypes = ['Gas Safety Certificate (CP12)', 'EICR'];

    const { useCreateTasksFromAIAnalysis } = await import('@/hooks/useComplianceTasks');
    const { result } = renderAppHook(() => useCreateTasksFromAIAnalysis());

    let outcome: { created: number; skipped: number; total: number } | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        propertyId: 'p1',
        requirements: [
          req({ type: 'Gas Safety Certificate (CP12)', status: 'missing' }),
          req({ type: 'EICR', status: 'expired' }),
        ],
      });
    });

    expect(outcome).toEqual({ created: 0, skipped: 2, total: 2 });
    const insertCall = mock.__calls.find(
      (c: QueryState) => c.table === 'compliance_tasks' && c.op === 'insert'
    );
    expect(insertCall).toBeUndefined();
  });
});
