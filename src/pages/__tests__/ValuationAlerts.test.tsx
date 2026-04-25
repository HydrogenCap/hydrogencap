import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let alerts: Array<Record<string, unknown>> = [];
let isLoading = false;
const dismissMutate = vi.fn();
let useValuationAlertsIncludeDismissed: boolean | undefined;

vi.mock('@/hooks/useValuationAlerts', () => ({
  useValuationAlerts: (includeDismissed: boolean) => {
    useValuationAlertsIncludeDismissed = includeDismissed;
    return { data: alerts, isLoading };
  },
  useDismissValuationAlert: () => ({ mutate: dismissMutate, isPending: false }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

import ValuationAlerts from '../ValuationAlerts';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ValuationAlerts />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function alert(overrides: Record<string, unknown>) {
  return {
    id: 'a1',
    alert_type: 'value_increase',
    property_id: 'p1',
    property_address: '10 High Street, Oxford',
    title: 'Property value has increased',
    message: 'Value estimate up by 10%',
    recorded_value_gbp: 300_000,
    estimated_value_gbp: 330_000,
    change_percent: 10,
    is_dismissed: false,
    created_at: '2025-06-15T00:00:00Z',
    ...overrides,
  };
}

describe('ValuationAlerts page', () => {
  beforeEach(() => {
    alerts = [];
    isLoading = false;
    useValuationAlertsIncludeDismissed = undefined;
    dismissMutate.mockReset();
  });

  it('renders the page heading and description', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Valuation Alerts/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Property value changes and refinancing triggers/i)).toBeInTheDocument();
  });

  it('defaults to the Active filter and passes includeDismissed=false to the hook', () => {
    renderPage();
    expect(useValuationAlertsIncludeDismissed).toBe(false);
  });

  it('switches to All filter and passes includeDismissed=true', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(useValuationAlertsIncludeDismissed).toBe(true);
  });

  it('shows skeletons while loading', () => {
    isLoading = true;
    alerts = [];
    const { container } = renderPage();
    // Three skeletons expected.
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('shows the empty state when the filtered list is empty', () => {
    alerts = [];
    renderPage();
    expect(screen.getByText(/No valuation alerts/)).toBeInTheDocument();
    expect(screen.getByText(/Your portfolio is stable/)).toBeInTheDocument();
  });

  it('under Active filter, hides dismissed alerts', () => {
    alerts = [
      alert({ id: 'a1', is_dismissed: false }),
      alert({ id: 'a2', is_dismissed: true, title: 'Already dismissed' }),
    ];
    renderPage();
    expect(screen.getByText('Property value has increased')).toBeInTheDocument();
    expect(screen.queryByText('Already dismissed')).not.toBeInTheDocument();
  });

  it('under All filter, shows dismissed alerts with Dismiss button hidden', async () => {
    alerts = [
      alert({ id: 'a1', is_dismissed: false }),
      alert({ id: 'a2', is_dismissed: true, title: 'Already dismissed' }),
    ];
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'All' }));
    // Both visible now.
    expect(screen.getByText('Property value has increased')).toBeInTheDocument();
    expect(screen.getByText('Already dismissed')).toBeInTheDocument();
    // Only one Dismiss button (for the non-dismissed alert).
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(1);
  });

  it('renders the recorded and estimated values', () => {
    alerts = [alert({ recorded_value_gbp: 300_000, estimated_value_gbp: 350_000 })];
    renderPage();
    expect(screen.getByText(/Was: £300,000/)).toBeInTheDocument();
    expect(screen.getByText(/Now: £350,000/)).toBeInTheDocument();
  });

  it('shows a positive change_percent with a leading +', () => {
    alerts = [alert({ change_percent: 12.5 })];
    renderPage();
    expect(screen.getByText(/\+12\.5%/)).toBeInTheDocument();
  });

  it('shows a negative change_percent without a leading +', () => {
    alerts = [alert({ change_percent: -7.2, alert_type: 'value_decrease' })];
    renderPage();
    expect(screen.getByText(/-7\.2%/)).toBeInTheDocument();
  });

  it('omits the change-percent span when change_percent is null', () => {
    // The coloured span renders text like "+12.5%" or "-7.2%" — match the
    // signed-decimal-with-trailing-% pattern, which the alert's message text
    // does NOT contain here.
    alerts = [alert({ change_percent: null, message: 'stable value — no change detected' })];
    renderPage();
    expect(screen.queryByText(/^[+-]?\d+(\.\d+)?%$/)).not.toBeInTheDocument();
  });

  it('renders the alert-type badge for known types', () => {
    alerts = [
      alert({ id: 'a1', alert_type: 'value_increase' }),
      alert({ id: 'a2', alert_type: 'value_decrease', title: 'Value dropped' }),
      alert({ id: 'a3', alert_type: 'refinance_opportunity', title: 'Time to refi' }),
    ];
    renderPage();
    expect(screen.getByText('Value Up')).toBeInTheDocument();
    expect(screen.getByText('Value Down')).toBeInTheDocument();
    expect(screen.getByText('Refi Opportunity')).toBeInTheDocument();
  });

  it('falls back to the raw alert_type as label for unknown types', () => {
    alerts = [alert({ alert_type: 'some_future_type' })];
    renderPage();
    expect(screen.getByText('some_future_type')).toBeInTheDocument();
  });

  it('links the property address to /properties-v2/:id', () => {
    alerts = [alert({ property_id: 'p-xyz', property_address: '5 Low Rd' })];
    renderPage();
    const link = screen.getByRole('link', { name: '5 Low Rd' });
    expect(link.getAttribute('href')).toBe('/properties-v2/p-xyz');
  });

  it('calls dismiss.mutate(alert.id) when Dismiss is clicked', () => {
    alerts = [alert({ id: 'a-click' })];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(dismissMutate).toHaveBeenCalledWith('a-click');
  });
});
