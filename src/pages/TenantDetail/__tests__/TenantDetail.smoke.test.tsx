import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/useTenantsV2', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useTenantsV2')>('@/hooks/useTenantsV2');
  return {
    ...actual,
    useTenantV2: () => ({
      data: {
        id: 't1', org_id: 'o1',
        first_name: 'Jane', last_name: 'Doe',
        email: 'jane@x.com', phone: null, date_of_birth: null,
        emergency_contact_name: null, emergency_contact_phone: null,
        status: 'active', tenant_type: 'individual', notes: null,
      },
      isLoading: false,
    }),
    useUpdateTenantV2: () => ({ mutate: vi.fn() }),
  };
});
vi.mock('@/hooks/useTenancyAgreements', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useTenancyAgreements')>('@/hooks/useTenancyAgreements');
  return {
    ...actual,
    useTenancyAgreements: () => ({ data: [] }),
    useTenancyComplianceChecks: () => ({ data: [] }),
  };
});
vi.mock('@/hooks/useTenantLifecycle', () => ({ useTenantPaymentScore: () => ({ data: null }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ delete: () => ({ eq: () => Promise.resolve({}) }) }) },
  supabaseAny: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null }) }) }),
    }),
  },
}));
vi.mock('@/components/tenants-v2/AddTenantModal', () => ({ AddTenantModal: () => null }));
vi.mock('@/components/tenants-v2/CreateTenancyAgreementModal', () => ({ CreateTenancyAgreementModal: () => null }));
vi.mock('@/components/tenants-v2/ServeNoticeModal', () => ({ ServeNoticeModal: () => null }));
vi.mock('@/components/tenants-v2/EndTenancyModal', () => ({ EndTenancyModal: () => null }));
vi.mock('@/components/tenants-v2/DepositProtectionCard', () => ({ DepositProtectionCard: () => <div /> }));
vi.mock('@/components/tenants-v2/RightToRentCard', () => ({ RightToRentCard: () => <div /> }));
vi.mock('@/components/tenants/TenantLifecyclePanel', () => ({ TenantLifecyclePanel: () => <div /> }));
vi.mock('@/components/tenants/NoticeComposer', () => ({ NoticeComposer: () => <div /> }));
vi.mock('@/components/tenants/AffordabilityMonitor', () => ({ AffordabilityMonitor: () => <div /> }));
vi.mock('@/components/lettings/TenancyChecklist', () => ({ TenancyChecklist: () => <div /> }));
vi.mock('@/components/communications/CommunicationTimeline', () => ({ CommunicationTimeline: () => <div /> }));
vi.mock('@/components/common', () => ({ MobileDetailsSheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import TenantDetail from '../index';

describe('TenantDetail (smoke)', () => {
  it('renders header and tabs', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/tenants-v2/t1']}>
          <Routes>
            <Route path="/tenants-v2/:id" element={<TenantDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: /Jane Doe/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /payments/i })).toBeInTheDocument();
  });
});
