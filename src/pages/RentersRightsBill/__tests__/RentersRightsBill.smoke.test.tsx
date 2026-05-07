import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/useAppSettings', () => ({
  useAppSettings: () => ({ data: {}, isLoading: false }),
  useUpdateAppSetting: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/components/rrb/RRBReadinessTable', () => ({
  RRBReadinessTable: () => <div>RRB Readiness Table</div>,
}));

import RentersRightsBill from '../index';

describe('RentersRightsBill (smoke)', () => {
  it('renders header and key cards', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <RentersRightsBill />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: /Renters' Rights Bill/i })).toBeInTheDocument();
    expect(screen.getByText(/Key Provisions/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaab's Law/i)).toBeInTheDocument();
    expect(screen.getByText(/Decent Homes Standard/i)).toBeInTheDocument();
  });
});
