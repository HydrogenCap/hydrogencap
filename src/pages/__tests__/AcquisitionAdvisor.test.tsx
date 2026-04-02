import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useAcquisitionAnalysis', () => ({
  useAcquisitionAnalyses: () => ({ data: null, isLoading: false }),
  useRunAcquisitionAnalysis: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

import AcquisitionAdvisor from '../AcquisitionAdvisor';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AcquisitionAdvisor />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AcquisitionAdvisor page', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByText('Acquisition Advisor')).toBeInTheDocument();
  });

  it('renders page description', () => {
    renderPage();
    expect(screen.getByText(/AI-powered analysis/)).toBeInTheDocument();
  });

  it('renders the form card with Analyse Property heading', () => {
    renderPage();
    expect(screen.getByText('Analyse Property')).toBeInTheDocument();
  });

  it('renders Address input', () => {
    renderPage();
    expect(screen.getByLabelText('Address *')).toBeInTheDocument();
  });

  it('renders Postcode input', () => {
    renderPage();
    expect(screen.getByLabelText('Postcode')).toBeInTheDocument();
  });

  it('renders Asking Price input', () => {
    renderPage();
    expect(screen.getByLabelText('Asking Price')).toBeInTheDocument();
  });

  it('renders Estimated Monthly Rent input', () => {
    renderPage();
    expect(screen.getByLabelText('Est. Monthly Rent')).toBeInTheDocument();
  });

  it('renders Bedrooms input', () => {
    renderPage();
    expect(screen.getByLabelText('Bedrooms')).toBeInTheDocument();
  });

  it('renders Notes textarea', () => {
    renderPage();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('renders Analyse submit button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Analyse/i })).toBeInTheDocument();
  });

  it('shows Past Analyses section', () => {
    renderPage();
    expect(screen.getByText('Past Analyses')).toBeInTheDocument();
  });

  it('shows empty analysis state', () => {
    renderPage();
    expect(screen.getByText('No analysis selected')).toBeInTheDocument();
  });

  it('shows no past analyses message', () => {
    renderPage();
    expect(screen.getByText(/No analyses yet/)).toBeInTheDocument();
  });
});
