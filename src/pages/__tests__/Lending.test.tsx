import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Per-test state.
let debtSummary: unknown[] = [];
let facilities: Array<Record<string, unknown>> = [];
let alerts: Array<Record<string, unknown>> = [];
let applications: Array<Record<string, unknown>> = [];
let loadingSummary = false;
let loadingFacilities = false;
let loadingAlerts = false;

vi.mock('@/hooks/useLoanFacilities', () => ({
  usePortfolioDebtSummary: () => ({ data: debtSummary, isLoading: loadingSummary }),
  useAllLoanFacilities: () => ({ data: facilities, isLoading: loadingFacilities }),
  useLoanAlerts: () => ({ data: alerts, isLoading: loadingAlerts }),
  // The page imports these formatters from the same module. Re-implement in
  // the mock so assertions against rendered totals are deterministic.
  fmtGBP: (v: number | null | undefined) =>
    v == null
      ? '—'
      : `£${Math.round(v).toLocaleString('en-GB')}`,
  fmtGBPCompact: (v: number | null | undefined) => {
    if (v == null) return '—';
    if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`;
    if (v >= 1_000) return `£${(v / 1_000).toFixed(0)}k`;
    return `£${v}`;
  },
  fmtDate: (d: string | null) => d ?? '—',
  getLtvColor: () => '',
  getFacilityTypeInfo: () => ({ label: '', color: '' }),
  getCovenantStatus: () => 'ok',
}));

vi.mock('@/hooks/useLenders', () => ({
  LENDER_TYPES: [{ value: 'high_street', label: 'High Street' }],
}));

vi.mock('@/hooks/useRefinanceWorkflow', () => ({
  useMortgageApplications: () => ({ data: applications }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('@/components/lending/RateExpiryDashboard', () => ({
  RateExpiryDashboard: () => <div data-testid="rate-expiry-dashboard" />,
}));
vi.mock('@/components/lending/ApplicationTracker', () => ({
  ApplicationTracker: () => <div data-testid="application-tracker" />,
}));
vi.mock('@/components/lending/LoanStressTest', () => ({
  LoanStressTest: () => <div data-testid="loan-stress-test" />,
}));
vi.mock('@/components/lending/RefinanceComparison', () => ({
  RefinanceComparison: ({ facility }: { facility: { id: string } | null }) => (
    <div data-testid="refinance-comparison" data-facility-id={facility?.id ?? ''} />
  ),
}));

import Lending from '../Lending';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Lending />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeFacility(overrides: Record<string, unknown>) {
  return {
    id: 'f1',
    status: 'active',
    current_balance: 100_000,
    interest_rate: 5,
    monthly_payment: 500,
    rate_type: 'fixed',
    ...overrides,
  };
}

describe('Lending page', () => {
  beforeEach(() => {
    debtSummary = [];
    facilities = [];
    alerts = [];
    applications = [];
    loadingSummary = false;
    loadingFacilities = false;
    loadingAlerts = false;
  });

  it('renders the page title once data loads', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Lending', level: 1 })).toBeInTheDocument();
  });

  it('shows a skeleton while any of the three data hooks are loading', () => {
    loadingFacilities = true;
    renderPage();
    expect(screen.queryByRole('heading', { name: 'Lending' })).not.toBeInTheDocument();
  });

  it('computes totals across active facilities only', () => {
    facilities = [
      makeFacility({ id: 'f1', status: 'active', current_balance: 100_000, interest_rate: 5, monthly_payment: 500, rate_type: 'fixed' }),
      makeFacility({ id: 'f2', status: 'active', current_balance: 200_000, interest_rate: 6, monthly_payment: 1_000, rate_type: 'variable' }),
      makeFacility({ id: 'f3', status: 'redeemed', current_balance: 999_999, interest_rate: 99, monthly_payment: 9999, rate_type: 'fixed' }), // excluded
    ];
    renderPage();
    // Total debt card: £300k (redeemed facility excluded). Format is compact "£300k".
    const totalCard = screen.getByText('Total Debt').parentElement!;
    expect(within(totalCard).getByText(/£300k/)).toBeInTheDocument();
    // Weighted rate = (5*100k + 6*200k) / 300k = 1700/300 = 5.67%
    const rateCard = screen.getByText('Weighted Avg Rate').parentElement!;
    expect(within(rateCard).getByText('5.67%')).toBeInTheDocument();
  });

  it('computes fixed vs variable split correctly', () => {
    facilities = [
      makeFacility({ id: 'f1', current_balance: 300_000, rate_type: 'fixed' }),
      makeFacility({ id: 'f2', current_balance: 100_000, rate_type: 'variable' }),
    ];
    renderPage();
    // 75% fixed / 25% variable
    expect(screen.getByText(/75%/)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });

  it('shows zero weighted rate when there is no debt', () => {
    facilities = [];
    renderPage();
    const rateCard = screen.getByText('Weighted Avg Rate').parentElement!;
    expect(within(rateCard).getByText('0.00%')).toBeInTheDocument();
  });

  it('renders all 4 tab triggers', () => {
    renderPage();
    for (const name of ['Portfolio Debt', 'Rate Expiries', 'Applications', 'Stress Test']) {
      expect(screen.getByRole('tab', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
  });

  it('shows an active-applications count badge on the Applications tab', () => {
    applications = [
      { id: 'a1', status: 'in_progress' },
      { id: 'a2', status: 'submitted' },
      { id: 'a3', status: 'completed' }, // excluded
      { id: 'a4', status: 'withdrawn' }, // excluded
    ];
    renderPage();
    const appsTab = screen.getByRole('tab', { name: /Applications/i });
    expect(within(appsTab).getByText('2')).toBeInTheDocument();
  });

  it('hides the active-applications badge when there are none', () => {
    applications = [{ id: 'a1', status: 'completed' }];
    renderPage();
    const appsTab = screen.getByRole('tab', { name: /Applications/i });
    // Only the label should be present, no numeric badge.
    expect(within(appsTab).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('defaults to the Portfolio Debt tab', () => {
    renderPage();
    expect(screen.queryByTestId('rate-expiry-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-stress-test')).not.toBeInTheDocument();
  });

  it('switches to the Rate Expiries tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Rate Expiries/i }));
    expect(screen.getByTestId('rate-expiry-dashboard')).toBeInTheDocument();
  });

  it('switches to the Applications tab and renders a tracker per application', async () => {
    applications = [{ id: 'a1', status: 'in_progress' }];
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Applications/i }));
    expect(screen.getByTestId('application-tracker')).toBeInTheDocument();
  });

  it('Applications tab shows the empty state when there are none', async () => {
    applications = [];
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Applications/i }));
    expect(screen.getByText(/No mortgage applications/i)).toBeInTheDocument();
    expect(screen.queryByTestId('application-tracker')).not.toBeInTheDocument();
  });

  it('switches to the Stress Test tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Stress Test/i }));
    expect(screen.getByTestId('loan-stress-test')).toBeInTheDocument();
  });
});
