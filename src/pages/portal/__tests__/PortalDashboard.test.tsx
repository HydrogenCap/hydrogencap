import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Per-test state read by the mocked hooks.
let canViewFinancials = true;
let isLoading = false;
let properties: Array<Record<string, unknown>> | undefined;
let loansByProperty: Map<string, Array<Record<string, unknown>>> = new Map();
let performanceByProperty: Map<string, Record<string, unknown>> = new Map();

vi.mock('@/hooks/useShareholderSession', () => ({
  useShareholderSession: () => ({
    canViewFinancials,
    orgId: 'org-1',
    isShareholderUser: true,
  }),
}));

vi.mock('@/hooks/useShareholderPortfolioData', () => ({
  useShareholderPortfolioData: () => ({
    properties,
    loansByProperty,
    performanceByProperty,
    isLoading,
  }),
}));

// Skip the real supabase client — PortalDashboard does a direct
// useQuery(...) for distributions. Returning undefined from the hook path is
// fine because we don't mount the TanStack Query provider with any data.
vi.mock('@/integrations/supabase/client', () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }),
  };
  return { supabase: client, supabaseAny: client };
});

vi.mock('@/components/portal/PortalLayout', () => ({
  PortalLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="portal-layout">{children}</div>,
}));

vi.mock('@/components/common/LoadingState', () => ({
  LoadingState: ({ text }: { text: string }) => <div data-testid="loading-state">{text}</div>,
}));

import PortalDashboard from '../PortalDashboard';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PortalDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeProperty(overrides: Record<string, unknown>) {
  return {
    id: 'p1',
    address_line_1: '10 High St',
    city: 'Oxford',
    postcode: 'OX1 1AA',
    current_valuation: 300_000,
    entity_id: 'ent-1',
    entity_name: 'Acme Ltd',
    ...overrides,
  };
}

describe('PortalDashboard', () => {
  beforeEach(() => {
    canViewFinancials = true;
    isLoading = false;
    properties = [];
    loansByProperty = new Map();
    performanceByProperty = new Map();
  });

  it('renders the header and subtitle', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Portfolio Overview/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/read-only investor portal/i)).toBeInTheDocument();
  });

  it('shows the loading state while shareholder data is loading', () => {
    isLoading = true;
    properties = undefined;
    renderPage();
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    expect(screen.getByText('Loading portfolio...')).toBeInTheDocument();
  });

  it('shows zero property count when there are no properties', () => {
    renderPage();
    const card = screen.getByText('Properties').closest('div')!.parentElement!;
    expect(within(card).getByText('0')).toBeInTheDocument();
  });

  it('shows the property count when properties exist', () => {
    properties = [
      makeProperty({ id: 'p1' }),
      makeProperty({ id: 'p2' }),
      makeProperty({ id: 'p3' }),
    ];
    renderPage();
    const propCard = screen.getByText('Properties').closest('div')!.parentElement!;
    expect(within(propCard).getByText('3')).toBeInTheDocument();
  });

  it('renders financial KPI cards when canViewFinancials is true', () => {
    canViewFinancials = true;
    properties = [makeProperty({})];
    renderPage();
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Total Equity')).toBeInTheDocument();
    expect(screen.getByText('Average LTV')).toBeInTheDocument();
    expect(screen.getByText('Annual Rent')).toBeInTheDocument();
  });

  it('hides financial KPI cards when canViewFinancials is false', () => {
    canViewFinancials = false;
    properties = [makeProperty({})];
    renderPage();
    // Property count card still present
    expect(screen.getByText('Properties')).toBeInTheDocument();
    // But none of the financial cards render
    expect(screen.queryByText('Portfolio Value')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Equity')).not.toBeInTheDocument();
    expect(screen.queryByText('Average LTV')).not.toBeInTheDocument();
    expect(screen.queryByText('Annual Rent')).not.toBeInTheDocument();
  });
});
