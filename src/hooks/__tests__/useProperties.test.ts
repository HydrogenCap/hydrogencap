import { describe, it, expect, vi } from 'vitest';
import { renderAppHook } from '@/test/renderHook';
import { waitFor } from '@testing-library/react';

// Mock useAuth to return a fake user
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@hydrogencap.com', email_confirmed_at: '2025-01-01' },
    session: { access_token: 'fake-token' },
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock activity loggers to avoid side effects
vi.mock('@/hooks/useActivityLog', () => ({
  ActivityLoggers: {
    propertyCreated: vi.fn(),
    valuationChanged: vi.fn(),
    rateChanged: vi.fn(),
    mortgageUpdated: vi.fn(),
    incomeUpdated: vi.fn(),
    costsUpdated: vi.fn(),
  },
}));

describe('useProperties', () => {
  it('fetches properties list', async () => {
    const { useProperties } = await import('@/hooks/useProperties');
    const { result } = renderAppHook(() => useProperties());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].address_line).toBe('10 High Street');
    expect(result.current.data?.[1].address_line).toBe('5 Low Road');
  });

  it('returns properties with financial sub-arrays', async () => {
    const { useProperties } = await import('@/hooks/useProperties');
    const { result } = renderAppHook(() => useProperties());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const prop = result.current.data?.[0];
    expect(prop?.loans).toBeDefined();
    expect(prop?.income).toBeDefined();
    expect(prop?.costs).toBeDefined();
    expect(prop?.tenancies).toBeDefined();
  });
});
