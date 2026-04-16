/**
 * Regression tests for useCompaniesHouseV2.
 *
 * Covers the guardrails that must survive consolidation:
 *   - short queries never hit the edge function
 *   - the `companies-house` edge function is invoked with the correct action
 *   - officer cache responses are filtered to drop resigned officers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderAppHook } from '@/test/renderHook';
import { createMockSupabase, type MockSupabase } from './supabaseMock';

let mock: MockSupabase;

vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return mock;
  },
}));

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { id: 'org-1', name: 'Test Org' } }),
}));

beforeEach(() => {
  mock = createMockSupabase(() => ({ data: null, error: null }));
});

describe('useCompaniesHouseV2 - searchCompanies', () => {
  it('returns [] without calling the edge function for short queries', async () => {
    const { useCompaniesHouseV2 } = await import('@/hooks/useCompaniesHouseV2');
    const { result } = renderAppHook(() => useCompaniesHouseV2());

    let results: unknown[] = [];
    await act(async () => {
      results = await result.current.searchCompanies('a');
    });

    expect(results).toEqual([]);
    expect(mock.functions.invoke).not.toHaveBeenCalled();
  });

  it('invokes companies-house with action=search for queries >= 2 chars', async () => {
    mock.functions.invoke.mockResolvedValueOnce({
      data: { companies: [{ company_number: '00001', company_name: 'Acme', company_status: 'active', date_of_creation: '2020-01-01', address_snippet: 'Oxford' }] },
      error: null,
    });

    const { useCompaniesHouseV2 } = await import('@/hooks/useCompaniesHouseV2');
    const { result } = renderAppHook(() => useCompaniesHouseV2());

    let results: unknown[] = [];
    await act(async () => {
      results = await result.current.searchCompanies('acme');
    });

    expect(mock.functions.invoke).toHaveBeenCalledWith('companies-house', {
      body: { action: 'search', search_query: 'acme' },
    });
    expect(results).toHaveLength(1);
  });

  it('fetchProfile invokes companies-house with action=profile', async () => {
    mock.functions.invoke.mockResolvedValueOnce({
      data: { data: { company_name: 'Acme', company_number: '00001' }, cached: true, fetched_at: '2025-06-01' },
      error: null,
    });

    const { useCompaniesHouseV2 } = await import('@/hooks/useCompaniesHouseV2');
    const { result } = renderAppHook(() => useCompaniesHouseV2());

    await act(async () => {
      await result.current.fetchProfile('00001', 'ent-1');
    });

    expect(mock.functions.invoke).toHaveBeenCalledWith('companies-house', {
      body: { action: 'profile', company_number: '00001', entity_id: 'ent-1' },
    });
  });
});

describe('useCHOfficers', () => {
  it('filters out resigned officers from cached response_data', async () => {
    mock = createMockSupabase(({ table, op }) => {
      if (table === 'companies_house_cache' && op === 'select') {
        return {
          data: {
            response_data: {
              items: [
                { name: 'Alice', officer_role: 'director', appointed_on: '2020-01-01' },
                { name: 'Bob', officer_role: 'director', appointed_on: '2019-01-01', resigned_on: '2023-06-01' },
                { name: 'Carol', officer_role: 'secretary', appointed_on: '2021-01-01' },
              ],
            },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const { useCHOfficers } = await import('@/hooks/useCompaniesHouseV2');
    const { result } = renderAppHook(() => useCHOfficers('ent-1', '00001'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.map((o) => o.name)).toEqual(['Alice', 'Carol']);
  });

  it('returns [] when the cache is empty', async () => {
    mock = createMockSupabase(() => ({ data: null, error: null }));

    const { useCHOfficers } = await import('@/hooks/useCompaniesHouseV2');
    const { result } = renderAppHook(() => useCHOfficers('ent-1', '00001'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('does not fire when entityId or companyNumber is missing', async () => {
    const { useCHOfficers } = await import('@/hooks/useCompaniesHouseV2');
    const { result } = renderAppHook(() => useCHOfficers('ent-1', null));
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCHFilingHistory', () => {
  it('returns cached filing_history items', async () => {
    mock = createMockSupabase(({ table, op }) => {
      if (table === 'companies_house_cache' && op === 'select') {
        return {
          data: {
            response_data: {
              items: [
                { date: '2025-06-01', description: 'Confirmation statement', type: 'CS01', category: 'confirmation-statement' },
              ],
            },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const { useCHFilingHistory } = await import('@/hooks/useCompaniesHouseV2');
    const { result } = renderAppHook(() => useCHFilingHistory('ent-1', '00001'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].type).toBe('CS01');
  });
});
