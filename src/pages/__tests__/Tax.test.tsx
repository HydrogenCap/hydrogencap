import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useTaxData', () => ({
  useTaxSummary: () => ({ data: null, isLoading: false }),
  useTaxExpenses: () => ({ data: null }),
  useAddTaxExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTaxExpense: () => ({ mutate: vi.fn() }),
  useTaxSettings: () => ({
    data: { marginalTaxRate: 0.40 as const, corporationTaxRate: 0.25 },
  }),
  useUpdateTaxSettings: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/useOrganization', () => ({
  useOrganization: () => ({ data: { id: 'org-1', name: 'Test Org' } }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('@/components/tax/MtdItsaCard', () => ({
  MtdItsaCard: () => <div data-testid="mtd-card">MTD</div>,
}));

vi.mock('@/lib/accountingTypes', () => ({
  getCurrentTaxYear: () => '2025/26',
  getRecentTaxYears: () => ['2025/26', '2024/25', '2023/24', '2022/23', '2021/22'],
}));

import Tax from '../Tax';

function renderTax() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Tax />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Tax page', () => {
  it('renders page title', () => {
    renderTax();
    expect(screen.getByText('Tax & Section 24')).toBeInTheDocument();
  });

  it('renders tax year selector', () => {
    renderTax();
    expect(screen.getByText('2025/26')).toBeInTheDocument();
  });

  it('renders export button', () => {
    renderTax();
    expect(screen.getByText('Export SA105')).toBeInTheDocument();
  });

  it('renders disclaimer', () => {
    renderTax();
    expect(screen.getByText(/estimate only/)).toBeInTheDocument();
  });

  it('renders tax settings card', () => {
    renderTax();
    expect(screen.getByText('Tax Settings')).toBeInTheDocument();
    expect(screen.getByText('Marginal Tax Rate')).toBeInTheDocument();
    expect(screen.getByText('Corporation Tax Rate')).toBeInTheDocument();
  });

  it('shows no data message when summary is null', () => {
    renderTax();
    expect(screen.getByText('No data for this tax year')).toBeInTheDocument();
  });

  it('renders MTD ITSA card', () => {
    renderTax();
    expect(screen.getByTestId('mtd-card')).toBeInTheDocument();
  });
});
