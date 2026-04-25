import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let projects: Array<Record<string, unknown>> | undefined;
let isLoading = false;
const navigateSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('@/hooks/useCapexAll', () => ({
  useAllCapexProjects: () => ({ data: projects, isLoading }),
  useCreateCapexProjectFull: () => ({ mutateAsync: vi.fn(), isPending: false }),
  CAPEX_TEMPLATES: [],
}));

vi.mock('@/hooks/useCapex', () => ({
  useAddCapexLineItem: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({ data: [], isLoading: false }),
  };
});

vi.mock('@/hooks/useUserOrg', () => ({
  fetchUserOrgId: vi.fn(async () => 'org-1'),
}));

vi.mock('@/integrations/supabase/client', () => {
  const client = { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }) };
  return { supabase: client, supabaseAny: client };
});

import CapExPage from '../CapEx';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CapExPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeProject(overrides: Record<string, unknown>) {
  return {
    id: 'c1',
    name: 'Kitchen refurb',
    status: 'in_progress',
    budget_gbp: 10_000,
    line_items: [],
    properties: { address_line_1: '10 High St' },
    ...overrides,
  };
}

describe('CapEx page', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    projects = [];
    isLoading = false;
  });

  it('renders the header and New Project CTA', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Capital Expenditure/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Project/i })).toBeInTheDocument();
  });

  it('shows "Loading…" while projects are loading', () => {
    projects = undefined;
    isLoading = true;
    renderPage();
    expect(screen.getByText(/Loading…/)).toBeInTheDocument();
  });

  it('shows "No active projects" when the list is empty', () => {
    projects = [];
    renderPage();
    expect(screen.getByText(/No active projects/)).toBeInTheDocument();
  });

  it('separates active from completed projects by status', () => {
    projects = [
      makeProject({ id: 'c1', status: 'in_progress' }),
      makeProject({ id: 'c2', status: 'planned' }),
      makeProject({ id: 'c3', status: 'complete' }),
      makeProject({ id: 'c4', status: 'completed' }),
      makeProject({ id: 'c5', status: 'cancelled' }), // not active, not in completed card
    ];
    renderPage();
    // "Active Projects" appears twice — once as a KPI label (inside a
    // text-muted-foreground label) and once as the card title. Pick the KPI
    // label so `.parentElement` is the KPI card content.
    const kpiLabel = screen.getAllByText('Active Projects')
      .find((el) => el.className.includes('text-muted-foreground'))!;
    expect(within(kpiLabel.parentElement!).getByText('2')).toBeInTheDocument();
    // Completed card header shows "Completed Projects (2)"
    expect(screen.getByText(/Completed Projects \(2\)/)).toBeInTheDocument();
  });

  it('sums total budget and total spent across active projects only', () => {
    projects = [
      makeProject({ id: 'c1', status: 'in_progress', budget_gbp: 10_000, line_items: [{ actual_gbp: 4_000 }, { actual_gbp: 1_000 }] }),
      makeProject({ id: 'c2', status: 'planned', budget_gbp: 5_000, line_items: [{ actual_gbp: 500 }] }),
      makeProject({ id: 'c3', status: 'completed', budget_gbp: 999_999, line_items: [{ actual_gbp: 999_999 }] }), // excluded
    ];
    renderPage();
    // Total Budget = 15,000; Total Spent = 5,500; Remaining = 9,500
    const budgetCard = screen.getByText('Total Budget').parentElement!;
    expect(within(budgetCard).getByText(/£15,000/)).toBeInTheDocument();
    const spentCard = screen.getByText('Total Spent').parentElement!;
    expect(within(spentCard).getByText(/£5,500/)).toBeInTheDocument();
    const remainingCard = screen.getByText('Remaining').parentElement!;
    expect(within(remainingCard).getByText(/£9,500/)).toBeInTheDocument();
  });

  it('colours the Remaining KPI as destructive when negative', () => {
    projects = [
      makeProject({ id: 'c1', status: 'in_progress', budget_gbp: 1_000, line_items: [{ actual_gbp: 1_500 }] }),
    ];
    renderPage();
    const remainingCard = screen.getByText('Remaining').parentElement!;
    const value = within(remainingCard).getByText(/-£500/);
    // The div has className='text-destructive' appended — check a parent has the class.
    expect(value.className).toMatch(/destructive/);
  });

  it('renders an active-project row with property address, budget, and spent', () => {
    projects = [
      makeProject({ id: 'c1', status: 'in_progress', budget_gbp: 10_000, line_items: [{ actual_gbp: 4_000 }], properties: { address_line_1: '5 Low Rd' } }),
    ];
    renderPage();
    expect(screen.getByText('5 Low Rd')).toBeInTheDocument();
    expect(screen.getByText('Kitchen refurb')).toBeInTheDocument();
    // Row total of spent = 4000
    const row = screen.getByText('Kitchen refurb').closest('tr')!;
    expect(within(row).getByText(/£10,000/)).toBeInTheDocument();
    expect(within(row).getByText(/£4,000/)).toBeInTheDocument();
  });

  it('flags rows where spent exceeds budget in destructive styling', () => {
    projects = [
      makeProject({ id: 'c1', status: 'in_progress', budget_gbp: 5_000, line_items: [{ actual_gbp: 7_500 }], name: 'Overbudget job' }),
    ];
    renderPage();
    // £7,500 appears in both the KPI summary and the row. Scope by row.
    const row = screen.getByText('Overbudget job').closest('tr')!;
    const spentCell = within(row).getByText(/£7,500/);
    expect(spentCell.className).toMatch(/destructive/);
  });

  it('navigates to /capex/:id when an active project row is clicked', () => {
    projects = [makeProject({ id: 'c-click', status: 'in_progress' })];
    renderPage();
    const row = screen.getByText('Kitchen refurb').closest('tr')!;
    fireEvent.click(row);
    expect(navigateSpy).toHaveBeenCalledWith('/capex/c-click');
  });

  it('shows the completed-projects panel only when there are completed projects', () => {
    projects = [makeProject({ id: 'c1', status: 'in_progress' })];
    renderPage();
    expect(screen.queryByText(/Completed Projects/)).not.toBeInTheDocument();
  });

  it('reveals completed-project detail when expanded', async () => {
    projects = [
      makeProject({ id: 'c1', status: 'in_progress' }),
      makeProject({ id: 'c2', status: 'completed', name: 'Bathroom reno', budget_gbp: 8_000, line_items: [{ actual_gbp: 7_500 }] }),
    ];
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText(/Completed Projects \(1\)/));
    expect(screen.getByText('Bathroom reno')).toBeInTheDocument();
    // Variance = 8000 - 7500 = +500 (under budget → green).
    expect(screen.getByText(/\+£500/)).toBeInTheDocument();
  });

  it('shows a negative variance with destructive styling when spend exceeds budget', async () => {
    projects = [
      makeProject({ id: 'c1', status: 'in_progress' }),
      makeProject({ id: 'c2', status: 'completed', name: 'Roof', budget_gbp: 5_000, line_items: [{ actual_gbp: 6_200 }] }),
    ];
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText(/Completed Projects \(1\)/));
    // Variance = -£1,200
    const variance = screen.getByText(/-£1,200/);
    expect(variance.className).toMatch(/destructive/);
  });
});
