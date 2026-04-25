import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Per-test state.
let stats: Record<string, number> | undefined;
let statsLoading = false;
let policies: Array<Record<string, unknown>> | undefined;
let policiesLoading = false;
let expiring: Array<Record<string, unknown>> | undefined;
let expiringLoading = false;
let coverageGaps: Array<Record<string, unknown>> | undefined;

vi.mock('@/hooks/useInsuranceTracker', () => ({
  useInsuranceStats: () => ({ data: stats, isLoading: statsLoading }),
  useInsurancePolicies: () => ({ data: policies, isLoading: policiesLoading }),
  useExpiringPolicies: () => ({ data: expiring, isLoading: expiringLoading }),
  useCoverageGaps: () => ({ data: coverageGaps }),
  useCreatePolicy: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdatePolicy: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  TRACKER_POLICY_TYPES: [
    { value: 'buildings', label: 'Buildings' },
    { value: 'contents', label: 'Contents' },
  ],
  POLICY_STATUSES: [
    { value: 'active', label: 'Active' },
    { value: 'expired', label: 'Expired' },
  ],
}));

vi.mock('@/components/insurance', () => ({
  InsurancePolicyForm: () => null,
  CoverageMatrix: () => <div data-testid="coverage-matrix" />,
  ClaimsTracker: () => <div data-testid="claims-tracker" />,
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

import Insurance from '../Insurance';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Insurance />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Insurance page', () => {
  beforeEach(() => {
    stats = { totalAnnualPremiums: 0, activePoliciesCount: 0, expiringIn30Count: 0, openClaimsCount: 0 };
    statsLoading = false;
    policies = [];
    policiesLoading = false;
    expiring = [];
    expiringLoading = false;
    coverageGaps = [];
  });

  it('renders the header and subtitle', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Insurance', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Manage your property insurance portfolio/i)).toBeInTheDocument();
  });

  it('renders the four KPI cards', () => {
    renderPage();
    expect(screen.getByText('Total Annual Premiums')).toBeInTheDocument();
    expect(screen.getByText('Active Policies')).toBeInTheDocument();
    expect(screen.getByText('Expiring in 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Open Claims')).toBeInTheDocument();
  });

  it('shows "..." placeholders while stats load', () => {
    statsLoading = true;
    stats = undefined;
    renderPage();
    // Every KPI value is "..." during loading
    const placeholders = screen.getAllByText('...');
    expect(placeholders.length).toBe(4);
  });

  it('shows rollup values from the stats hook', () => {
    stats = {
      totalAnnualPremiums: 12_500,
      activePoliciesCount: 8,
      expiringIn30Count: 2,
      openClaimsCount: 1,
    };
    renderPage();
    // Premiums come through the formatGBP helper
    const premiumsCard = screen.getByText('Total Annual Premiums').closest('div')!.parentElement!;
    expect(within(premiumsCard).getByText(/£12,500/)).toBeInTheDocument();

    const activeCard = screen.getByText('Active Policies').closest('div')!.parentElement!;
    expect(within(activeCard).getByText('8')).toBeInTheDocument();

    const expiringCard = screen.getByText('Expiring in 30 Days').closest('div')!.parentElement!;
    expect(within(expiringCard).getByText('2')).toBeInTheDocument();

    const claimsCard = screen.getByText('Open Claims').closest('div')!.parentElement!;
    expect(within(claimsCard).getByText('1')).toBeInTheDocument();
  });

  it('hides the coverage-gaps alert when there are no gaps', () => {
    coverageGaps = [];
    renderPage();
    expect(screen.queryByText(/Coverage gaps detected/i)).not.toBeInTheDocument();
  });

  it('shows the coverage-gaps alert with property count and singular/plural wording', () => {
    coverageGaps = [{ address_line: '10 High St', hasGaps: true }];
    renderPage();
    expect(screen.getByText(/Coverage gaps detected/)).toBeInTheDocument();
    expect(screen.getByText(/1 property missing required insurance/)).toBeInTheDocument();
  });

  it('pluralises the coverage-gap wording for multiple properties', () => {
    coverageGaps = [
      { address_line: '10 High St', hasGaps: true },
      { address_line: '5 Low Rd', hasGaps: true },
    ];
    renderPage();
    expect(screen.getByText(/2 properties missing required insurance/)).toBeInTheDocument();
  });

  it('truncates the coverage-gap list to 3 with an "and N more" suffix', () => {
    coverageGaps = [
      { address_line: 'Addr 1', hasGaps: true },
      { address_line: 'Addr 2', hasGaps: true },
      { address_line: 'Addr 3', hasGaps: true },
      { address_line: 'Addr 4', hasGaps: true },
      { address_line: 'Addr 5', hasGaps: true },
    ];
    renderPage();
    expect(screen.getByText(/Addr 1, Addr 2, Addr 3 and 2 more/)).toBeInTheDocument();
  });

  it('excludes coverage-gaps entries where hasGaps is false', () => {
    coverageGaps = [
      { address_line: 'Has gap', hasGaps: true },
      { address_line: 'No gap', hasGaps: false },
    ];
    renderPage();
    expect(screen.getByText(/1 property missing required insurance/)).toBeInTheDocument();
    expect(screen.queryByText(/No gap/)).not.toBeInTheDocument();
  });

  it('renders all 4 tab triggers', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /Policies/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Coverage Matrix/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Claims/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Renewals/ })).toBeInTheDocument();
  });

  it('defaults to the Policies tab', () => {
    renderPage();
    expect(screen.queryByTestId('coverage-matrix')).not.toBeInTheDocument();
    expect(screen.queryByTestId('claims-tracker')).not.toBeInTheDocument();
  });

  it('switches to the Coverage Matrix tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Coverage Matrix/ }));
    expect(screen.getByTestId('coverage-matrix')).toBeInTheDocument();
  });

  it('switches to the Claims tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Claims/ }));
    expect(screen.getByTestId('claims-tracker')).toBeInTheDocument();
  });

  it('Renewals tab shows empty state when no policies are expiring', async () => {
    expiring = [];
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Renewals/ }));
    expect(screen.getByText(/No policies expiring in the next 90 days/)).toBeInTheDocument();
  });

  it('Renewals tab lists expiring policies with insurer + policy type', async () => {
    expiring = [
      {
        id: 'pol-1',
        end_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        insurer_name: 'Acme Insurance',
        policy_type: 'buildings',
        property: { address_line: '10 High St' },
        auto_renew: true,
        status: 'active',
      },
    ];
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Renewals/ }));
    expect(screen.getByText('10 High St')).toBeInTheDocument();
    expect(screen.getByText(/Acme Insurance/)).toBeInTheDocument();
    expect(screen.getByText(/Buildings/)).toBeInTheDocument();
    expect(screen.getByText('Auto-renew')).toBeInTheDocument();
  });
});
