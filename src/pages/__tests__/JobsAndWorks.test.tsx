import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let jobCounts: { total: number; draft: number } | undefined;
let maintenanceStats: { open: number } | undefined;
let woCounts: { awaitingApproval: number; inProgress: number } | undefined;
let activeJobsData: { items: unknown[] } | undefined;

vi.mock('@/hooks/useContractorJobs', () => ({
  useJobCounts: () => ({ data: jobCounts }),
  useContractorJobs: () => ({ data: activeJobsData }),
}));
vi.mock('@/hooks/useMaintenanceRequests', () => ({
  useMaintenanceStats: () => maintenanceStats,
}));
vi.mock('@/hooks/useWorkOrders', () => ({
  useWorkOrderCounts: () => ({ data: woCounts }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('@/components/jobs-works/JobsTab', () => ({
  default: () => <div data-testid="jobs-tab" />,
}));
vi.mock('@/components/jobs-works/MaintenanceTab', () => ({
  default: () => <div data-testid="maintenance-tab" />,
}));
vi.mock('@/components/jobs-works/WorkOrdersTab', () => ({
  default: () => <div data-testid="work-orders-tab" />,
}));
vi.mock('@/components/jobs-works/SLATracker', () => ({
  SLATracker: ({ jobs }: { jobs: unknown[] }) => <div data-testid="sla-tracker" data-count={jobs.length} />,
}));
vi.mock('@/components/jobs-works/QuoteComparison', () => ({
  QuoteComparison: () => <div data-testid="quote-comparison" />,
}));
vi.mock('@/components/jobs-works/JobEvidenceGallery', () => ({
  JobEvidenceGallery: () => <div data-testid="job-evidence-gallery" />,
}));
vi.mock('@/components/contractors/RateContractorDialog', () => ({
  RateContractorDialog: () => null,
}));

import JobsAndWorks from '../JobsAndWorks';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <JobsAndWorks />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('JobsAndWorks page', () => {
  beforeEach(() => {
    jobCounts = { total: 0, draft: 0 };
    maintenanceStats = { open: 0 };
    woCounts = { awaitingApproval: 0, inProgress: 0 };
    activeJobsData = { items: [] };
  });

  it('renders the page heading and description', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Jobs & Works/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Manage contractor jobs, maintenance requests/i)).toBeInTheDocument();
  });

  it('renders all 3 tab triggers', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /Jobs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Maintenance/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Work Orders/i })).toBeInTheDocument();
  });

  it('defaults to the Jobs tab', () => {
    renderPage();
    expect(screen.getByTestId('jobs-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('maintenance-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('work-orders-tab')).not.toBeInTheDocument();
  });

  it('shows the active-jobs count badge excluding drafts', () => {
    jobCounts = { total: 8, draft: 3 };
    renderPage();
    const jobsTab = screen.getByRole('tab', { name: /Jobs/i });
    // activeJobCount = 8 - 3 = 5
    expect(within(jobsTab).getByText('5')).toBeInTheDocument();
  });

  it('hides the Jobs badge when activeJobCount is zero', () => {
    jobCounts = { total: 2, draft: 2 }; // all drafts → active = 0
    renderPage();
    const jobsTab = screen.getByRole('tab', { name: /Jobs/i });
    expect(within(jobsTab).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('shows open-maintenance count on the Maintenance tab', () => {
    maintenanceStats = { open: 4 };
    renderPage();
    const maintTab = screen.getByRole('tab', { name: /Maintenance/i });
    expect(within(maintTab).getByText('4')).toBeInTheDocument();
  });

  it('hides the Maintenance badge when no open items', () => {
    maintenanceStats = { open: 0 };
    renderPage();
    const maintTab = screen.getByRole('tab', { name: /Maintenance/i });
    expect(within(maintTab).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('shows work-order count on the Work Orders tab = awaitingApproval + inProgress', () => {
    woCounts = { awaitingApproval: 3, inProgress: 5 };
    renderPage();
    const woTab = screen.getByRole('tab', { name: /Work Orders/i });
    expect(within(woTab).getByText('8')).toBeInTheDocument();
  });

  it('hides the Work Orders badge when zero', () => {
    woCounts = { awaitingApproval: 0, inProgress: 0 };
    renderPage();
    const woTab = screen.getByRole('tab', { name: /Work Orders/i });
    expect(within(woTab).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('switches to the Maintenance tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Maintenance/i }));
    expect(screen.getByTestId('maintenance-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('jobs-tab')).not.toBeInTheDocument();
  });

  it('switches to the Work Orders tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Work Orders/i }));
    expect(screen.getByTestId('work-orders-tab')).toBeInTheDocument();
  });

  it('forwards activeJobsData to the SLA tracker sidebar', () => {
    activeJobsData = { items: [{ id: 'j1' }, { id: 'j2' }, { id: 'j3' }] };
    renderPage();
    const tracker = screen.getByTestId('sla-tracker');
    expect(tracker.dataset.count).toBe('3');
  });

  it('handles missing job/maintenance/WO counts without crashing', () => {
    jobCounts = undefined;
    maintenanceStats = undefined;
    woCounts = undefined;
    activeJobsData = undefined;
    renderPage();
    // Heading still renders; all badges absent.
    expect(screen.getByRole('heading', { name: /Jobs & Works/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('sla-tracker').dataset.count).toBe('0');
  });
});
