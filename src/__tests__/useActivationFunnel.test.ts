import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

import { fetchActivationFunnel } from '@/hooks/useActivationFunnel';

describe('useActivationFunnel — fetchActivationFunnel', () => {
  beforeEach(() => invokeMock.mockReset());

  it('invokes admin-stats with activation_funnel action and returns shaped data', async () => {
    const fixture = {
      total_orgs: 4,
      first_property: { count: 3, median_hours: 24, p75_hours: 72 },
      first_cert: { count: 2, median_hours: 96, p75_hours: 240 },
      first_payment: { count: 1, median_hours: 168, p75_hours: 168 },
      funnel: { signed_up: 4, has_property: 3, has_cert: 2, has_payment: 1 },
    };
    invokeMock.mockResolvedValueOnce({ data: fixture, error: null });

    const result = await fetchActivationFunnel();
    expect(invokeMock).toHaveBeenCalledWith('admin-stats', {
      body: { action: 'activation_funnel' },
    });
    expect(result).toEqual(fixture);
    expect(result.first_property.count).toBe(3);
    expect(result.funnel.has_payment).toBe(1);
  });

  it('throws when edge function returns an error', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('forbidden') });
    await expect(fetchActivationFunnel()).rejects.toThrow('forbidden');
  });

  it('handles empty/zero state without throwing', async () => {
    const empty = {
      total_orgs: 0,
      first_property: { count: 0, median_hours: null, p75_hours: null },
      first_cert: { count: 0, median_hours: null, p75_hours: null },
      first_payment: { count: 0, median_hours: null, p75_hours: null },
      funnel: { signed_up: 0, has_property: 0, has_cert: 0, has_payment: 0 },
    };
    invokeMock.mockResolvedValueOnce({ data: empty, error: null });
    const result = await fetchActivationFunnel();
    expect(result.total_orgs).toBe(0);
    expect(result.first_property.median_hours).toBeNull();
  });
});
