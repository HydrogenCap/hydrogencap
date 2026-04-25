/**
 * Regression tests for useCreateTasksFromArrearsRisk.
 *
 * The arrears prediction model returns a risk_score / risk_level per
 * tenant. This hook turns the critical/high-risk subset into rows in
 * the generic `tasks` table (category='arrears'), deduping against any
 * active task already linked to the same prediction via
 * source_wizard_id so re-running the model + re-clicking the button
 * doesn't create duplicates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderAppHook } from '@/test/renderHook';
import { createMockSupabase, type MockSupabase, type QueryState } from './supabaseMock';
import type { ArrearsPrediction } from '@/hooks/useArrearsPredictions';

let mock: MockSupabase;
let existingActivePredictionIds: string[] = [];

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mock; },
  get supabaseAny() { return mock; },
}));

vi.mock('@/hooks/useUserOrg', () => ({
  fetchUserOrgId: vi.fn(async () => 'org-1'),
  useUserOrg: () => ({ data: 'org-1' }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

beforeEach(() => {
  existingActivePredictionIds = [];
  mock = createMockSupabase(({ table, op }) => {
    if (table === 'tasks' && op === 'select') {
      return {
        data: existingActivePredictionIds.map((id) => ({ source_wizard_id: id })),
        error: null,
      };
    }
    if (table === 'tasks' && op === 'insert') {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
});

const pred = (overrides: Partial<ArrearsPrediction> = {}): ArrearsPrediction => ({
  id: 'pred-1',
  org_id: 'org-1',
  tenant_id: 't-1',
  property_id: 'p-1',
  room_id: null,
  risk_score: 0.85,
  risk_level: 'critical',
  contributing_factors: [
    { factor: 'Late payments last 3 months', weight: 5 },
    { factor: 'High debt-to-income', weight: 4 },
  ],
  recommended_actions: ['Schedule call', 'Issue formal arrears notice'],
  prediction_period: '2026-04',
  model_version: 'v1',
  created_at: '2026-04-25T00:00:00Z',
  ...overrides,
});

describe('useCreateTasksFromArrearsRisk', () => {
  it('creates one task per critical / high prediction with full context in the description', async () => {
    const { useCreateTasksFromArrearsRisk } = await import('@/hooks/useArrearsPredictions');
    const { result } = renderAppHook(() => useCreateTasksFromArrearsRisk());

    let outcome: { created: number; skipped: number; total: number } | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        predictions: [
          pred({ id: 'pred-crit', risk_level: 'critical', risk_score: 0.92 }),
          pred({ id: 'pred-high', risk_level: 'high', risk_score: 0.78, property_id: 'p-2' }),
        ],
      });
    });

    expect(outcome).toEqual({ created: 2, skipped: 0, total: 2 });

    const insertCall = mock.__calls.find(
      (c: QueryState) => c.table === 'tasks' && c.op === 'insert'
    );
    const inserted = insertCall?.payload as Array<Record<string, unknown>>;
    expect(inserted).toHaveLength(2);

    const crit = inserted.find((t) => t.source_wizard_id === 'pred-crit');
    expect(crit?.org_id).toBe('org-1');
    expect(crit?.created_by).toBe('user-1');
    expect(crit?.category).toBe('arrears');
    expect(crit?.priority).toBe('critical');
    expect(crit?.status).toBe('open');
    expect(crit?.source).toBe('arrears-prediction');
    expect(crit?.title).toBe('Contact tenant — high arrears risk');
    expect(String(crit?.description)).toContain('92%');
    expect(String(crit?.description)).toContain('Late payments last 3 months');
    expect(String(crit?.description)).toContain('Schedule call');

    const high = inserted.find((t) => t.source_wizard_id === 'pred-high');
    expect(high?.priority).toBe('high');
    expect(high?.property_id).toBe('p-2');
  });

  it('skips medium and low risk predictions', async () => {
    const { useCreateTasksFromArrearsRisk } = await import('@/hooks/useArrearsPredictions');
    const { result } = renderAppHook(() => useCreateTasksFromArrearsRisk());

    let outcome: { created: number; skipped: number; total: number } | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        predictions: [
          pred({ id: 'pred-med', risk_level: 'medium' }),
          pred({ id: 'pred-low', risk_level: 'low' }),
        ],
      });
    });

    expect(outcome).toEqual({ created: 0, skipped: 0, total: 0 });
    const insertCall = mock.__calls.find(
      (c: QueryState) => c.table === 'tasks' && c.op === 'insert'
    );
    expect(insertCall).toBeUndefined();
  });

  it('skips predictions whose source_wizard_id already has an active task', async () => {
    existingActivePredictionIds = ['pred-existing'];

    const { useCreateTasksFromArrearsRisk } = await import('@/hooks/useArrearsPredictions');
    const { result } = renderAppHook(() => useCreateTasksFromArrearsRisk());

    let outcome: { created: number; skipped: number; total: number } | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        predictions: [
          pred({ id: 'pred-existing', risk_level: 'critical' }),
          pred({ id: 'pred-new', risk_level: 'critical' }),
        ],
      });
    });

    expect(outcome).toEqual({ created: 1, skipped: 1, total: 2 });

    const insertCall = mock.__calls.find(
      (c: QueryState) => c.table === 'tasks' && c.op === 'insert'
    );
    const inserted = insertCall?.payload as Array<Record<string, unknown>>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0].source_wizard_id).toBe('pred-new');
  });

  it('returns zero results without an insert when every high-risk prediction already has a task', async () => {
    existingActivePredictionIds = ['pred-1', 'pred-2'];

    const { useCreateTasksFromArrearsRisk } = await import('@/hooks/useArrearsPredictions');
    const { result } = renderAppHook(() => useCreateTasksFromArrearsRisk());

    let outcome: { created: number; skipped: number; total: number } | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        predictions: [
          pred({ id: 'pred-1', risk_level: 'critical' }),
          pred({ id: 'pred-2', risk_level: 'high' }),
        ],
      });
    });

    expect(outcome).toEqual({ created: 0, skipped: 2, total: 2 });
    const insertCall = mock.__calls.find(
      (c: QueryState) => c.table === 'tasks' && c.op === 'insert'
    );
    expect(insertCall).toBeUndefined();
  });
});
