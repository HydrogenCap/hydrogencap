import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockEntity = {
  id: 'ent-spv-1',
  org_id: 'org-1',
  entity_name: 'Test SPV Ltd',
  entity_type: 'spv' as const,
  company_number: '12345678',
  incorporation_date: '2020-01-01',
  registered_address: '1 Test Street, London',
  corporation_tax_ref: null,
  vat_registered: false,
  vat_number: null,
  issued_shares: 100,
  status: 'active' as const,
  notes: null,
  created_at: '2020-01-01',
  updated_at: '2020-01-01',
};

vi.mock('@/hooks/useLegalEntities', () => ({
  useLegalEntity: () => ({ data: mockEntity, isLoading: false }),
  useEntityDirectors: () => ({ data: [] }),
  useEntityShareholders: () => ({ data: [] }),
  useDeleteLegalEntity: () => ({ mutateAsync: vi.fn() }),
  useDeleteDirector: () => ({ mutateAsync: vi.fn() }),
  useDeleteShareholder: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useShareCapital', () => ({
  useShareClassesWithAllocation: () => ({ data: [] }),
  useDeleteShareClass: () => ({ mutateAsync: vi.fn() }),
  validateShareIntegrity: () => [],
}));

vi.mock('@/hooks/useCompaniesHouseV2', () => ({
  useEntityVerification: () => ({ data: null }),
  useSyncEntity: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useFreeAgentIntegration', () => ({
  useFreeAgentConnectionForEntity: () => ({ data: null }),
}));

vi.mock('@/hooks/usePropertiesV2', () => ({
  useEntityPropertiesV2: () => ({ data: [] }),
}));

vi.mock('@/hooks/useEntityCHSync', () => ({
  useEntityCHSync: () => ({
    isLookingUp: false,
    updateEntity: { mutateAsync: vi.fn(), isPending: false },
    handleRefreshFromCH: vi.fn(),
  }),
}));

// Use the real CompanySecretsCard but mock the secrets hook so it renders
// the masked placeholder without network.
vi.mock('@/hooks/useCompanySecrets', () => ({
  useCompanySecretsMasked: () => ({
    data: {
      company_id: 'ent-spv-1',
      auth_code_masked: '••••AB12',
      utr_masked: '••••••7890',
      auth_code_last4: 'AB12',
      utr_last4: '7890',
      updated_at: '2024-01-01T00:00:00Z',
    },
    isLoading: false,
  }),
  useRevealSecrets: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetCompanySecrets: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Stub heavy sub-components so the smoke test stays focused.
vi.mock('@/components/entities/EntityFormModal', () => ({ EntityFormModal: () => null }));
vi.mock('@/components/entities/DirectorFormModal', () => ({ DirectorFormModal: () => null }));
vi.mock('@/components/entities/ShareholderFormModal', () => ({ ShareholderFormModal: () => null }));
vi.mock('@/components/entities/ShareClassFormModal', () => ({ ShareClassFormModal: () => null }));
vi.mock('@/components/entities/CHVerificationBanner', () => ({ CHVerificationBanner: () => null }));
vi.mock('@/components/entities/CHDataPanel', () => ({ CHDataPanel: () => null }));
vi.mock('@/components/companies/ComplianceFilingsCard', () => ({ ComplianceFilingsCard: () => null }));
vi.mock('@/components/financials/EntityFinancialSection', () => ({ EntityFinancialSection: () => null }));
vi.mock('@/components/entities/EntityInvestorSection', () => ({ EntityInvestorSection: () => null }));
vi.mock('@/components/entities/EntityOwnershipCard', () => ({ EntityOwnershipCard: () => null }));
vi.mock('@/components/accounting/EntityAccountingSection', () => ({ EntityAccountingSection: () => null }));
vi.mock('@/components/audit/InlineAuditHistory', () => ({ InlineAuditHistory: () => null }));
vi.mock('@/components/entities/EntityHeader', () => ({ EntityHeader: () => null }));
vi.mock('@/components/entities/EntityDetailsCard', () => ({ EntityDetailsCard: () => null }));
vi.mock('@/components/entities/DirectorsSection', () => ({ DirectorsSection: () => null }));
vi.mock('@/components/entities/ShareCapitalSection', () => ({ ShareCapitalSection: () => null }));
vi.mock('@/components/entities/ShareholdersSection', () => ({ ShareholdersSection: () => null }));
vi.mock('@/components/entities/EntityPropertiesCard', () => ({ EntityPropertiesCard: () => null }));
vi.mock('@/components/entities/CompanyFilingDeadlines', () => ({ CompanyFilingDeadlines: () => null }));
vi.mock('@/components/entities/DirectorRegister', () => ({ DirectorRegister: () => null }));
vi.mock('@/components/entities/IntercompanyLoanTracker', () => ({ IntercompanyLoanTracker: () => null }));
vi.mock('@/components/entities/EntityFinancialConsolidation', () => ({ EntityFinancialConsolidation: () => null }));
vi.mock('@/components/entities/EntityPortfolioSummaryCard', () => ({ EntityPortfolioSummaryCard: () => null }));

import EntityDetail from '../EntityDetail';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/entities/ent-spv-1']}>
        <Routes>
          <Route path="/entities/:id" element={<EntityDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EntityDetail — CompanySecretsCard', () => {
  it('mounts the Sensitive Details card with masked values for an SPV with a company number', () => {
    renderPage();
    expect(screen.getByText('Sensitive Details')).toBeInTheDocument();
    expect(screen.getByText('Companies House Auth Code')).toBeInTheDocument();
    expect(screen.getByText('••••AB12')).toBeInTheDocument();
    expect(screen.getByText('••••••7890')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reveal/i })).toBeInTheDocument();
  });
});
