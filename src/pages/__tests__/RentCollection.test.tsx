import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let scheduleItems: unknown[] | undefined;
const navigateSpy = vi.fn();
const exportCsvSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('@/hooks/useRentCollection', () => ({
  useRentSchedule: () => ({ data: scheduleItems ? { items: scheduleItems } : undefined }),
}));

vi.mock('@/lib/rentCsvExporter', () => ({
  exportRentRollCSV: (rows: unknown[]) => exportCsvSpy(rows),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('@/components/rent/RentDashboardStrip', () => ({
  RentDashboardStrip: () => <div data-testid="rent-dashboard-strip" />,
}));
vi.mock('@/components/rent/RentRollTable', () => ({
  RentRollTable: ({ month }: { month: string }) => <div data-testid="rent-roll-table" data-month={month} />,
}));
vi.mock('@/components/rent/ArrearsTracker', () => ({
  ArrearsTracker: () => <div data-testid="arrears-tracker" />,
}));
vi.mock('@/components/rent/ArrearsRiskPanel', () => ({
  ArrearsRiskPanel: () => <div data-testid="arrears-risk-panel" />,
}));
vi.mock('@/components/rent/RentCalendar', () => ({
  RentCalendar: () => <div data-testid="rent-calendar" />,
}));
vi.mock('@/components/rent/PaymentHistoryList', () => ({
  PaymentHistoryList: () => <div data-testid="payment-history" />,
}));
vi.mock('@/components/rent/BankStatementImportDialog', () => ({
  BankStatementImportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="import-dialog-open" /> : null,
}));

import RentCollection from '../RentCollection';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RentCollection />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RentCollection page', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    exportCsvSpy.mockReset();
    scheduleItems = undefined;
  });

  it('renders the page title and description', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Rent Collection/i })).toBeInTheDocument();
    expect(screen.getByText(/Track rent payments, arrears, and collection performance/i)).toBeInTheDocument();
  });

  it('defaults to the rent-roll tab and passes the current month (YYYY-MM) to the table', () => {
    renderPage();
    const table = screen.getByTestId('rent-roll-table');
    expect(table).toBeInTheDocument();
    expect(table.dataset.month).toMatch(/^\d{4}-\d{2}$/);
    expect(screen.getByTestId('rent-dashboard-strip')).toBeInTheDocument();
  });

  it('does not show Export Rent Roll button when no schedule has loaded', () => {
    scheduleItems = undefined;
    renderPage();
    expect(screen.queryByRole('button', { name: /Export Rent Roll/i })).not.toBeInTheDocument();
  });

  it('shows Export Rent Roll button and calls exporter with schedule items', () => {
    scheduleItems = [{ tenant_id: 't1', amount_due: 1000 }];
    renderPage();
    const btn = screen.getByRole('button', { name: /Export Rent Roll/i });
    fireEvent.click(btn);
    expect(exportCsvSpy).toHaveBeenCalledWith(scheduleItems);
  });

  it('opens the bank import dialog when Import Statement is clicked', () => {
    renderPage();
    expect(screen.queryByTestId('import-dialog-open')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Import Statement/i }));
    expect(screen.getByTestId('import-dialog-open')).toBeInTheDocument();
  });

  it('navigates to /rent/reconciliation when the Reconciliation button is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Reconciliation/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/rent/reconciliation');
  });

  it('switches to the Arrears tab and renders arrears components', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Arrears/i }));
    expect(screen.getByTestId('arrears-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('arrears-risk-panel')).toBeInTheDocument();
  });

  it('switches to the Calendar tab and renders the calendar component', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Calendar/i }));
    expect(screen.getByTestId('rent-calendar')).toBeInTheDocument();
  });

  it('switches to the History tab and renders the payment history list', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: /History/i }));
    expect(screen.getByTestId('payment-history')).toBeInTheDocument();
  });
});
