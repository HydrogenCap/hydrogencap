import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Per-test state flipped in beforeEach.
let matrix: Array<Record<string, unknown>> | null;
let score: Record<string, number> | null;
let isLoading = false;

vi.mock('@/hooks/useComplianceV2', () => ({
  useComplianceMatrix: () => ({ data: matrix, isLoading }),
  usePortfolioComplianceScoreV2: () => ({ data: score }),
  useRefreshComplianceStatuses: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('@/components/lettings/TenancyChecklist', () => ({
  TenancyChecklistSummaryCard: () => <div data-testid="tenancy-checklist" />,
}));

// Stubbed so tests can check which view mode the page rendered.
vi.mock('@/components/compliance-v2/ComplianceMatrixGrid', () => ({
  ComplianceMatrixGrid: ({ rows }: { rows: unknown[] }) => (
    <div data-testid="matrix-grid" data-rows={rows.length} />
  ),
}));

vi.mock('@/components/compliance-v2/ComplianceCalendarView', () => ({
  ComplianceCalendarView: ({ rows }: { rows: unknown[] }) => (
    <div data-testid="calendar-view" data-rows={rows.length} />
  ),
}));

vi.mock('@/components/compliance-v2/ComplianceDetailModal', () => ({
  ComplianceDetailModal: () => null,
}));

vi.mock('@/components/compliance-v2/UploadComplianceDocModal', () => ({
  UploadComplianceDocModal: () => null,
}));

import ComplianceV2 from '../ComplianceV2';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ComplianceV2 />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ComplianceV2 page', () => {
  beforeEach(() => {
    matrix = [];
    score = null;
    isLoading = false;
  });

  it('renders the page title and sub-title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Compliance Dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/Portfolio-wide compliance monitoring/i)).toBeInTheDocument();
  });

  it('shows 0% compliance score when the rollup hook returns null', () => {
    renderPage();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows the score and rolled-up "needs attention" count from the hook', () => {
    score = {
      compliance_score_pct: 85,
      total_expiring_soon: 2,
      total_critical: 1,
      total_expired: 3,
      total_missing: 4,
    };
    renderPage();
    expect(screen.getByText('85%')).toBeInTheDocument();
    // 2 + 1 + 3 + 4 = 10
    expect(screen.getByText('10')).toBeInTheDocument();
    // Overdue = expired + missing = 3 + 4 = 7
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows the next-expiry message when nothing is upcoming', () => {
    matrix = [];
    renderPage();
    expect(screen.getByText(/No upcoming expiries/i)).toBeInTheDocument();
  });

  it('shows the next upcoming expiry (nearest required row with days_remaining > 0)', () => {
    matrix = [
      { property_id: 'p1', document_type: 'gas_safety', is_required: true, days_remaining: 45, property_address: '10 High St', org_id: 'org-1' },
      { property_id: 'p2', document_type: 'eicr', is_required: true, days_remaining: 15, property_address: '5 Low Rd', org_id: 'org-1' },
      { property_id: 'p3', document_type: 'epc', is_required: true, days_remaining: -2, property_address: 'past', org_id: 'org-1' }, // excluded: non-positive
      { property_id: 'p4', document_type: 'epc', is_required: false, days_remaining: 1, property_address: 'not required', org_id: 'org-1' }, // excluded: not required
    ];
    renderPage();
    expect(screen.getByText(/15d/)).toBeInTheDocument();
    expect(screen.getByText('5 Low Rd')).toBeInTheDocument();
  });

  it('defaults to matrix view and forwards matrix rows to the grid', () => {
    matrix = [
      { property_id: 'p1', document_type: 'gas_safety', is_required: true, days_remaining: 30, property_address: 'x', org_id: 'org-1' },
      { property_id: 'p2', document_type: 'eicr', is_required: true, days_remaining: 50, property_address: 'y', org_id: 'org-1' },
    ];
    renderPage();
    const grid = screen.getByTestId('matrix-grid');
    expect(grid).toBeInTheDocument();
    expect(grid.dataset.rows).toBe('2');
    expect(screen.queryByTestId('calendar-view')).not.toBeInTheDocument();
  });

  it('switches to calendar view when the Calendar toggle is clicked', () => {
    matrix = [{ property_id: 'p1', document_type: 'gas_safety', is_required: true, days_remaining: 10, property_address: 'x', org_id: 'org-1' }];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Calendar/i }));
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
    expect(screen.queryByTestId('matrix-grid')).not.toBeInTheDocument();
  });

  it('shows a single full-height skeleton in place of the content when loading', () => {
    isLoading = true;
    matrix = null;
    renderPage();
    // When loading the grid/calendar should not be shown
    expect(screen.queryByTestId('matrix-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calendar-view')).not.toBeInTheDocument();
  });
});
