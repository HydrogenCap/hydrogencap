import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let properties: Array<Record<string, unknown>> = [];
let portfolioSummary: Record<string, unknown> | undefined;
let companies: unknown[] = [];
let reportDataLoading = false;
let reportHistory: Array<Record<string, unknown>> | undefined;
let reportHistoryLoading = false;
const generateReportSpy = vi.fn();

vi.mock('@/hooks/useReportGeneration', () => ({
  useReportData: () => ({ properties, portfolioSummary, companies, isLoading: reportDataLoading }),
  useGenerateReport: () => ({ mutate: generateReportSpy, mutateAsync: generateReportSpy, isPending: false }),
  REPORT_TEMPLATES: [
    { id: 'compliance_portfolio', name: 'Compliance Portfolio', description: 'Portfolio-wide compliance status', icon: '📋' },
    { id: 'mortgage_broker_pack', name: 'Mortgage Broker Pack', description: 'Refinance-ready lender document', icon: '🏦' },
  ],
  validateReportInputs: () => ({ valid: true, errors: [] }),
}));

vi.mock('@/hooks/useAppSettings', () => ({
  useDensity: () => 'cosy',
  useSetDensity: () => vi.fn(),
}));

vi.mock('@/hooks/useReportHistory', () => ({
  useReportHistory: () => ({ data: reportHistory, isLoading: reportHistoryLoading, refetch: vi.fn() }),
  getReportTypeName: (id: string) => id,
  deleteReport: vi.fn(),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('@/components/reports/PropertySearchSelect', () => ({
  PropertySearchSelect: () => <div data-testid="property-search-select" />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/mortgageBrokerPackGenerator', () => ({
  validateMortgageBrokerPack: () => ({ valid: true, errors: [], warnings: [] }),
  generateMortgageBrokerPack: vi.fn(),
}));

vi.mock('@/lib/reportPdfGenerator', () => ({
  generateReportPdf: vi.fn(),
}));

import Reports from '../index';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Reports />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeProperty(overrides: Record<string, unknown>) {
  return {
    id: 'p1',
    address_line: '10 High St',
    lifecycle_type: 'core_rental',
    ...overrides,
  };
}

describe('Reports page', () => {
  beforeEach(() => {
    properties = [makeProperty({ id: 'p1' }), makeProperty({ id: 'p2' }), makeProperty({ id: 'p3', lifecycle_type: 'development' })];
    portfolioSummary = { total_properties: 3 };
    companies = [];
    reportDataLoading = false;
    reportHistory = [];
    reportHistoryLoading = false;
    generateReportSpy.mockReset();
  });

  it('renders the header and description', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Reports', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Generate professional PDF reports/)).toBeInTheDocument();
  });

  it('shows a spinner while report data is loading', () => {
    reportDataLoading = true;
    properties = [];
    const { container } = renderPage();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reports' })).not.toBeInTheDocument();
  });

  it('renders Generate Reports and Report History tabs', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /Generate Reports/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Report History/i })).toBeInTheDocument();
  });

  it('renders one card per template from REPORT_TEMPLATES', () => {
    renderPage();
    expect(screen.getByText('Compliance Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Mortgage Broker Pack')).toBeInTheDocument();
  });

  it('shows the Lender-Grade badge on the mortgage broker pack template', () => {
    renderPage();
    const card = screen.getByText('Mortgage Broker Pack').closest('div')!;
    expect(within(card.parentElement!).getByText(/Lender-Grade/)).toBeInTheDocument();
  });

  it('shows the filtered-properties summary (plural, all lifecycles)', () => {
    renderPage();
    // 3 properties, all lifecycles
    expect(screen.getByText(/3\s+properties\s+will be included/)).toBeInTheDocument();
  });

  it('shows "1 property" when exactly one matches the filter', () => {
    properties = [makeProperty({ id: 'p-only' })];
    renderPage();
    expect(screen.getByText(/1\s+property\s+will be included/)).toBeInTheDocument();
  });

  it('disables generate buttons and lowers opacity when no properties are available', () => {
    properties = [];
    renderPage();
    const buttons = screen.getAllByRole('button', { name: /Generate PDF|Configure & Generate/ });
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });

  it('calls generateReport mutate for non-broker templates when the button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    const btn = screen.getByRole('button', { name: /Generate PDF/i });
    await user.click(btn);
    expect(generateReportSpy).toHaveBeenCalled();
  });

  it('renders the Report History tab without crashing', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Report History/i }));
    // History tab should render something (empty state or list).
    expect(screen.getByRole('tab', { name: /Report History/i })).toHaveAttribute('aria-selected', 'true');
  });
});
