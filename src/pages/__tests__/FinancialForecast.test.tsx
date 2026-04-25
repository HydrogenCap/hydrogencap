import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Polyfill ResizeObserver for Radix UI Tabs
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

vi.mock('@/hooks/useFinancialForecasts', () => ({
  useFinancialForecasts: () => ({ data: null, isLoading: false }),
  useForecastDetail: () => ({ data: null }),
  useRunForecast: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('@/components/finance/ForecastChart', () => ({
  ForecastChart: () => <div data-testid="forecast-chart">Chart</div>,
}));

vi.mock('@/components/finance/StressTestPanel', () => ({
  StressTestPanel: () => <div data-testid="stress-panel">Stress Test</div>,
}));

vi.mock('@/integrations/supabase/client', () => {
  const client = { from: () => ({ delete: () => ({ eq: () => ({ error: null }) }) }) };
  return { supabase: client, supabaseAny: client };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import FinancialForecast from '../FinancialForecast';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FinancialForecast />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FinancialForecast page', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByText('Financial Forecast')).toBeInTheDocument();
  });

  it('renders page description', () => {
    renderPage();
    expect(screen.getByText(/AI-powered cashflow projections/)).toBeInTheDocument();
  });

  it('renders Cashflow Projection tab', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /Cashflow Projection/i })).toBeInTheDocument();
  });

  it('renders Stress Test tab', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /Stress Test/i })).toBeInTheDocument();
  });

  it('renders Saved Forecasts tab', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /Saved Forecasts/i })).toBeInTheDocument();
  });

  it('renders projection assumptions form in default tab', () => {
    renderPage();
    expect(screen.getByText('Projection Assumptions')).toBeInTheDocument();
  });

  it('renders rent growth slider', () => {
    renderPage();
    expect(screen.getByText('Rent Growth')).toBeInTheDocument();
  });

  it('renders void rate slider', () => {
    renderPage();
    expect(screen.getByText('Void Rate')).toBeInTheDocument();
  });

  it('renders horizon buttons', () => {
    renderPage();
    expect(screen.getByRole('button', { name: '1yr' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2yr' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5yr' })).toBeInTheDocument();
  });

  it('renders Run Projection button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Run Projection' })).toBeInTheDocument();
  });
});
