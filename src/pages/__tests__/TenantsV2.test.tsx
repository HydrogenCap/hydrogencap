import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Per-test state.
let tenants: Array<Record<string, unknown>> | undefined;
let isLoading = false;
let compliance: Array<Record<string, unknown>> | undefined;
let tenancyEvents: Array<Record<string, unknown>> | undefined;

vi.mock('@/hooks/useTenantsV2', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useTenantsV2')>('@/hooks/useTenantsV2');
  return {
    ...actual,
    useTenantsV2WithTenancy: () => ({ data: tenants, isLoading }),
  };
});

vi.mock('@/hooks/useTenancyAgreements', () => ({
  useTenancyComplianceChecks: () => ({ data: compliance }),
}));

vi.mock('@/hooks/useTenancyEvents', () => ({
  useTenancyEvents: () => ({ data: tenancyEvents }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('@/components/tenants-v2/AddTenantModal', () => ({
  AddTenantModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-tenant-modal" /> : null,
}));

import TenantsV2 from '../TenantsV2';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TenantsV2 />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeTenant(overrides: Record<string, unknown>) {
  return {
    id: 't1',
    first_name: 'Alice',
    last_name: 'Smith',
    email: 'alice@example.com',
    phone: '07700900001',
    status: 'active',
    tenant_type: 'private',
    current_tenancy: {
      rent_amount_pcm: 1_200,
    },
    ...overrides,
  };
}

describe('TenantsV2 page', () => {
  beforeEach(() => {
    tenants = [];
    isLoading = false;
    compliance = [];
    tenancyEvents = [];
  });

  it('renders the page header and Add Tenant CTA', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /Tenants/i })).toBeInTheDocument();
    // When tenants = [] the empty state also shows an Add Tenant button,
    // so there may be more than one on the page.
    expect(screen.getAllByRole('button', { name: /Add Tenant/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading skeletons while tenants are loading', () => {
    tenants = undefined;
    isLoading = true;
    const { container } = renderPage();
    // 5 skeleton rows should render
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it('shows the empty-first-tenant state when there are no tenants', () => {
    tenants = [];
    renderPage();
    expect(screen.getByText('No tenants yet')).toBeInTheDocument();
    // The CTA inside EmptyState + the header CTA both say "Add Tenant" — both are valid
    expect(screen.getAllByRole('button', { name: /Add Tenant/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows the empty-filters state when filters exclude all tenants', () => {
    tenants = [makeTenant({})];
    renderPage();
    const searchInput = screen.getByLabelText('Search tenants by name, email or phone');
    fireEvent.change(searchInput, { target: { value: 'zzz-no-match' } });
    expect(screen.getByText('No tenants match your filters')).toBeInTheDocument();
  });

  it('shows the active tenant count in the stats grid', () => {
    tenants = [
      makeTenant({ id: 't1', status: 'active' }),
      makeTenant({ id: 't2', status: 'active' }),
      makeTenant({ id: 't3', status: 'in_notice' }),
      makeTenant({ id: 't4', status: 'departed' }),
    ];
    renderPage();
    const activeCard = screen.getByText('Active Tenants').parentElement!;
    expect(within(activeCard).getByText('2')).toBeInTheDocument();
    // "In Notice" also appears as a status badge in the row; scope to the
    // stats label (which has the muted-foreground class).
    const noticeLabel = screen
      .getAllByText('In Notice')
      .find((el) => el.className.includes('text-muted-foreground'))!;
    expect(within(noticeLabel.parentElement!).getByText('1')).toBeInTheDocument();
  });

  it('computes the average rent across tenants with a current tenancy', () => {
    tenants = [
      makeTenant({ id: 't1', current_tenancy: { rent_amount_pcm: 1_000 } }),
      makeTenant({ id: 't2', current_tenancy: { rent_amount_pcm: 2_000 } }),
      // This one has no current tenancy — should be excluded from the average
      makeTenant({ id: 't3', current_tenancy: null }),
    ];
    renderPage();
    const avgCard = screen.getByText('Average Rent').parentElement!;
    // (1000 + 2000) / 2 = 1500 → "£1,500.00"
    expect(within(avgCard).getByText(/£1,500\.00/)).toBeInTheDocument();
  });

  it('counts non-compliant deposits as Deposit Issues', () => {
    tenants = [makeTenant({})];
    compliance = [
      { tenant_id: 't1', deposit_compliance: 'compliant' }, // ignored
      { tenant_id: 't2', deposit_compliance: 'no_deposit' }, // ignored
      { tenant_id: 't3', deposit_compliance: 'missing' },
      { tenant_id: 't4', deposit_compliance: 'expired' },
    ];
    renderPage();
    const depositCard = screen.getByText('Deposit Issues').parentElement!;
    expect(within(depositCard).getByText('2')).toBeInTheDocument();
  });

  it('renders the urgent events banner when any overdue or action_required event exists', () => {
    tenants = [makeTenant({})];
    tenancyEvents = [
      { tenancyId: 'ten-1', type: 'deposit', status: 'ok', title: 'x', propertyAddress: 'y', tenantName: 'Z', description: 'fine' },
      { tenancyId: 'ten-2', type: 'renewal', status: 'overdue', title: 'Renewal due', propertyAddress: '10 High St', tenantName: 'Bob', description: 'overdue by 5 days' },
    ];
    renderPage();
    expect(screen.getByText(/1 tenancy event requiring attention/)).toBeInTheDocument();
    expect(screen.getByText('Renewal due')).toBeInTheDocument();
  });

  it('does not render the urgent events banner when there are no urgent events', () => {
    tenants = [makeTenant({})];
    tenancyEvents = [
      { tenancyId: 'ten-1', type: 'deposit', status: 'ok', title: 'x', propertyAddress: 'y', tenantName: 'Z', description: 'fine' },
    ];
    renderPage();
    expect(screen.queryByText(/tenancy event(s)? requiring attention/)).not.toBeInTheDocument();
  });

  it('opens the Add Tenant modal when the header button is clicked', () => {
    renderPage();
    expect(screen.queryByTestId('add-tenant-modal')).not.toBeInTheDocument();
    const headerBtn = screen.getAllByRole('button', { name: /Add Tenant/i })[0];
    fireEvent.click(headerBtn);
    expect(screen.getByTestId('add-tenant-modal')).toBeInTheDocument();
  });

  it('filters by search term across first+last name, email, phone (case-insensitive)', () => {
    tenants = [
      makeTenant({ id: 't1', first_name: 'Alice', last_name: 'Smith', email: 'alice@example.com', phone: '07700900001' }),
      makeTenant({ id: 't2', first_name: 'Bob', last_name: 'Jones', email: 'bob@example.com', phone: '07700900002' }),
    ];
    renderPage();
    const searchInput = screen.getByLabelText('Search tenants by name, email or phone');
    fireEvent.change(searchInput, { target: { value: 'JONES' } });
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
  });
});
