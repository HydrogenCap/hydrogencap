import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Stub all child components — page test only verifies the tab wiring.
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));
vi.mock('@/components/accounting/TransactionLedger', () => ({
  TransactionLedger: () => <div data-testid="ledger" />,
}));
vi.mock('@/components/accounting/BankReconciliation', () => ({
  BankReconciliation: () => <div data-testid="bank-reconciliation" />,
}));
vi.mock('@/components/accounting/ProfitAndLoss', () => ({
  ProfitAndLoss: () => <div data-testid="pnl" />,
}));
vi.mock('@/components/accounting/AccountingExport', () => ({
  AccountingExport: () => <div data-testid="accounting-export" />,
}));
vi.mock('@/components/accounting/ExportWizard', () => ({
  ExportWizard: () => <div data-testid="export-wizard" />,
}));
vi.mock('@/components/accounting/MappingsSection', () => ({
  MappingsSection: () => <div data-testid="mappings-section" />,
}));
vi.mock('@/components/accounting/ExportHistory', () => ({
  ExportHistory: () => <div data-testid="export-history" />,
}));

import Accounting from '../Accounting';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Accounting />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Accounting page', () => {
  it('renders the page heading and description', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Accounting', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Manage transactions, reconcile bank statements/i)).toBeInTheDocument();
  });

  it('renders all 6 tab triggers', () => {
    renderPage();
    for (const name of ['Ledger', 'Reconciliation', 'P&L', 'Export', 'Mappings', 'History']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
  });

  it('defaults to the Ledger tab', () => {
    renderPage();
    expect(screen.getByTestId('ledger')).toBeInTheDocument();
    expect(screen.queryByTestId('bank-reconciliation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pnl')).not.toBeInTheDocument();
  });

  it('switches to the Reconciliation tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Reconciliation' }));
    expect(screen.getByTestId('bank-reconciliation')).toBeInTheDocument();
    expect(screen.queryByTestId('ledger')).not.toBeInTheDocument();
  });

  it('switches to the P&L tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'P&L' }));
    expect(screen.getByTestId('pnl')).toBeInTheDocument();
  });

  it('renders both AccountingExport and the legacy ExportWizard in the Export tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Export' }));
    expect(screen.getByTestId('accounting-export')).toBeInTheDocument();
    expect(screen.getByTestId('export-wizard')).toBeInTheDocument();
    expect(screen.getByText(/Legacy Export Wizard/i)).toBeInTheDocument();
  });

  it('switches to the Mappings tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Mappings' }));
    expect(screen.getByTestId('mappings-section')).toBeInTheDocument();
  });

  it('switches to the History tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByTestId('export-history')).toBeInTheDocument();
  });
});
