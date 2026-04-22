import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Per-test state.
let liveData: Record<string, unknown> | undefined;
let liveLoading = false;
let monthlySummary: Array<Record<string, number | string | null>> | undefined;
let summaryLoading = false;
let propertyPerf: Array<Record<string, unknown>> | undefined;
let perfLoading = false;
let entitySummary: Array<Record<string, unknown>> | undefined;
let entityLoading = false;

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('@/hooks/usePortfolioFinancials', () => ({
  usePortfolioFinancials: () => ({ data: liveData, isLoading: liveLoading }),
}));

vi.mock('@/hooks/useFinancialSnapshots', () => ({
  usePortfolioMonthlySummary: () => ({ data: monthlySummary, isLoading: summaryLoading }),
  usePropertyAnnualPerformance: () => ({ data: propertyPerf, isLoading: perfLoading }),
  useEntityFinancialSummary: () => ({ data: entitySummary, isLoading: entityLoading }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

// Stub all Financials subcomponents — the page test only verifies wiring,
// not internal component rendering (those have their own tests).
vi.mock('@/components/financials/PortfolioKPIRow', () => ({
  PortfolioKPIRow: () => <div data-testid="kpi-row" />,
}));
vi.mock('@/components/financials/PortfolioTrendChart', () => ({
  PortfolioTrendChart: () => <div data-testid="trend-chart" />,
}));
vi.mock('@/components/financials/PortfolioCostBreakdown', () => ({
  PortfolioCostBreakdown: () => <div data-testid="cost-breakdown" />,
}));
vi.mock('@/components/financials/LivePropertyTable', () => ({
  LivePropertyTable: () => <div data-testid="live-property-table" />,
}));
vi.mock('@/components/financials/PortfolioQuickStats', () => ({
  PortfolioQuickStats: () => <div data-testid="portfolio-quick-stats" />,
}));
vi.mock('@/components/financials/FinancialStatsBar', () => ({
  FinancialStatsBar: ({ trailing12NOI }: { trailing12NOI: number }) => (
    <div data-testid="financial-stats-bar" data-trailing-noi={trailing12NOI} />
  ),
}));
vi.mock('@/components/financials/NOITrendChart', () => ({
  NOITrendChart: () => <div data-testid="noi-trend" />,
}));
vi.mock('@/components/financials/CostBreakdownChart', () => ({
  CostBreakdownChart: () => <div data-testid="cost-breakdown-chart" />,
}));
vi.mock('@/components/financials/PropertyPerformanceTable', () => ({
  PropertyPerformanceTable: () => <div data-testid="property-performance-table" />,
}));
vi.mock('@/components/financials/EntitySummaryTable', () => ({
  EntitySummaryTable: () => <div data-testid="entity-summary-table" />,
}));
vi.mock('@/components/financials/SnapshotEntryModal', () => ({
  SnapshotEntryModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="snapshot-modal-open" /> : null,
}));

import Financials from '../Financials';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Financials />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Financials page', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    liveData = {
      monthlyTrend: [],
      costBreakdown: [],
      properties: [],
    };
    liveLoading = false;
    monthlySummary = [];
    summaryLoading = false;
    propertyPerf = [];
    perfLoading = false;
    entitySummary = [];
    entityLoading = false;
  });

  it('renders the header, description, and primary buttons', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Financials/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Record Monthly Figures/i })).toBeInTheDocument();
  });

  it('shows a full-page skeleton while both live and snapshot hooks are loading', () => {
    liveData = undefined;
    liveLoading = true;
    monthlySummary = undefined;
    summaryLoading = true;
    renderPage();
    // Top-level header should not render during loading
    expect(screen.queryByRole('heading', { name: /Financials/i })).not.toBeInTheDocument();
    // Skeletons render instead of tabs
    expect(screen.queryByRole('tab', { name: /Live/i })).not.toBeInTheDocument();
  });

  it('defaults to the Live P&L tab and renders live widgets when data exists', () => {
    renderPage();
    expect(screen.getByTestId('kpi-row')).toBeInTheDocument();
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
    expect(screen.getByTestId('cost-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('live-property-table')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-quick-stats')).toBeInTheDocument();
  });

  it('shows empty-state card when liveData is null and not loading', () => {
    liveData = undefined;
    liveLoading = false;
    renderPage();
    expect(screen.getByText(/No property data yet/i)).toBeInTheDocument();
  });

  it('switches to the Manual Snapshots tab and renders snapshot widgets', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Manual Snapshots/i }));
    expect(screen.getByTestId('financial-stats-bar')).toBeInTheDocument();
    expect(screen.getByTestId('noi-trend')).toBeInTheDocument();
    expect(screen.getByTestId('cost-breakdown-chart')).toBeInTheDocument();
    expect(screen.getByTestId('property-performance-table')).toBeInTheDocument();
  });

  it('passes trailing-12-month NOI (sum of total_noi) to the stats bar', async () => {
    const user = userEvent.setup();
    monthlySummary = [
      { snapshot_month: '2026-03-01', total_noi: 1_000 },
      { snapshot_month: '2026-02-01', total_noi: 2_500 },
      { snapshot_month: '2026-01-01', total_noi: 1_500 },
      { snapshot_month: '2025-12-01', total_noi: null }, // coerced to 0
    ];
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Manual Snapshots/i }));
    const bar = screen.getByTestId('financial-stats-bar');
    expect(bar.dataset.trailingNoi).toBe('5000');
  });

  it('navigates to /accounting when Export Data is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Export Data/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/accounting');
  });

  it('opens the snapshot-entry modal when Record Monthly Figures is clicked', () => {
    renderPage();
    expect(screen.queryByTestId('snapshot-modal-open')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Record Monthly Figures/i }));
    expect(screen.getByTestId('snapshot-modal-open')).toBeInTheDocument();
  });
});
