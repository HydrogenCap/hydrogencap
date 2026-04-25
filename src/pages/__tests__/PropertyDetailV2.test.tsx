import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Per-test state.
let property: Record<string, unknown> | null;
let isLoading = false;

vi.mock('@/hooks/usePropertiesV2', () => ({
  usePropertyV2: () => ({ data: property, isLoading }),
  useUpdatePropertyV2: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useComplianceV2', () => ({
  usePropertyComplianceV2: () => ({ data: [] }),
}));

vi.mock('@/hooks/useInsurance', () => ({
  useInsurancePolicies: () => ({ data: [] }),
}));

vi.mock('@/hooks/useLoanFacilities', () => ({
  useLoanFacilitiesByProperty: () => ({ data: [] }),
}));

vi.mock('@/hooks/usePropertyPhotosV2', () => ({
  usePropertyPhotoV2: () => null,
}));

vi.mock('@/hooks/useUserOrg', () => ({
  fetchUserOrgId: vi.fn(async () => 'org-1'),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: [], error: null }) }),
        gte: () => ({ lte: async () => ({ data: [], error: null }) }),
      }),
    }),
  };
  return { supabase: client, supabaseAny: client };
});

// Shell components — stub to keep the test focused on page-level wiring.
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));
vi.mock('@/components/common', () => ({
  PageSkeleton: ({ tabs }: { tabs?: number }) => <div data-testid="page-skeleton" data-tabs={tabs} />,
}));

// Sub-component stubs (page assembles these, tests shouldn't care about their internals).
vi.mock('@/components/property-detail/PropertyStatusBar', () => ({
  PropertyStatusBar: () => <div data-testid="status-bar" />,
}));
vi.mock('@/components/property-detail/PropertyHeader', () => ({
  PropertyHeader: ({ onEdit }: { onEdit: () => void }) => (
    <div data-testid="property-header">
      <button onClick={onEdit}>Edit</button>
    </div>
  ),
}));
vi.mock('@/components/property-detail/PropertyTimeline', () => ({
  PropertyTimeline: () => <div data-testid="property-timeline" />,
}));
vi.mock('@/components/property-detail/LeaseholdHealthCard', () => ({
  LeaseholdHealthCard: () => <div data-testid="leasehold-card" />,
}));
vi.mock('@/components/property-detail/HMOCompliancePanel', () => ({
  HMOCompliancePanel: () => <div data-testid="hmo-panel" />,
}));

vi.mock('@/components/property/EpcRoadmapCard', () => ({
  EpcRoadmapCard: () => <div data-testid="epc-roadmap" />,
}));
vi.mock('@/components/properties-v2/PropertyFormModal', () => ({
  PropertyFormModal: ({ open }: { open: boolean }) => (open ? <div data-testid="edit-modal-open" /> : null),
}));
vi.mock('@/components/properties-v2/PropertyRoomsSection', () => ({
  PropertyRoomsSection: () => <div data-testid="rooms-section" />,
}));
vi.mock('@/components/lending/PropertyLoansSection', () => ({
  PropertyLoansSection: () => <div data-testid="loans-section" />,
}));
vi.mock('@/components/compliance-v2/PropertyComplianceSection', () => ({
  PropertyComplianceSection: () => <div data-testid="compliance-section" />,
}));
vi.mock('@/components/financials/PropertyFinancialSection', () => ({
  PropertyFinancialSection: () => <div data-testid="financial-section" />,
}));
vi.mock('@/components/financials/PropertyPnLCard', () => ({
  PropertyPnLCard: () => <div data-testid="pnl-card" />,
}));
vi.mock('@/components/audit/InlineAuditHistory', () => ({
  InlineAuditHistory: () => <div data-testid="audit-history" />,
}));
vi.mock('@/components/communications/CommunicationTimeline', () => ({
  CommunicationTimeline: () => <div data-testid="comms-timeline" />,
}));
vi.mock('@/components/valuations', () => ({
  ComparableSalesTable: () => <div data-testid="comparable-sales" />,
}));
vi.mock('@/components/valuations/ValuationHistoryChart', () => ({
  ValuationHistoryChart: () => <div data-testid="valuation-history" />,
}));
vi.mock('@/components/valuations/ComparableEvidenceLog', () => ({
  ComparableEvidenceLog: () => <div data-testid="comparable-evidence" />,
}));
vi.mock('@/components/valuations/RevaluationTrigger', () => ({
  RevaluationTrigger: () => <div data-testid="revaluation-trigger" />,
}));
vi.mock('@/components/valuations/ValuationRecordForm', () => ({
  ValuationRecordForm: () => <div data-testid="valuation-form" />,
}));

import PropertyDetailV2 from '../PropertyDetailV2';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/property/p1']}>
        <Routes>
          <Route path="/property/:id" element={<PropertyDetailV2 />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    address_line_1: '10 High St',
    address_line_2: null,
    city: 'Oxford',
    postcode: 'OX1 1AA',
    property_type: 'hmo_licensed',
    lifecycle_stage: 'stabilised',
    entity_id: 'ent-1',
    entity_name: 'Acme',
    current_valuation: 400_000,
    purchase_price: 300_000,
    purchase_date: '2022-01-01',
    whole_house_rent_pcm: 2_000,
    total_lettable_rooms: 4,
    epc_rating: 'C',
    notes: null,
    rent_basis: 'whole_house',
    ...overrides,
  };
}

describe('PropertyDetailV2 page', () => {
  beforeEach(() => {
    property = makeProperty({});
    isLoading = false;
  });

  it('shows the page skeleton while loading', () => {
    property = null;
    isLoading = true;
    renderPage();
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('property-header')).not.toBeInTheDocument();
  });

  it('shows "Property not found" when the hook returns null data', () => {
    property = null;
    isLoading = false;
    renderPage();
    expect(screen.getByText(/Property not found/i)).toBeInTheDocument();
  });

  it('renders the status bar and property header when data loaded', () => {
    renderPage();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('property-header')).toBeInTheDocument();
  });

  it('renders all 7 tab triggers', () => {
    renderPage();
    const tabs = ['Overview', 'Financials', 'Compliance', 'Valuation', 'Lending', 'Comms', 'Timeline'];
    for (const name of tabs) {
      expect(screen.getByRole('tab', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
  });

  it('defaults to the Overview tab which renders rooms, EPC roadmap, HMO panel, leasehold card', () => {
    renderPage();
    expect(screen.getByTestId('rooms-section')).toBeInTheDocument();
    expect(screen.getByTestId('epc-roadmap')).toBeInTheDocument();
    expect(screen.getByTestId('hmo-panel')).toBeInTheDocument();
    expect(screen.getByTestId('leasehold-card')).toBeInTheDocument();
  });

  it('opens the edit modal when the Edit button in the header is clicked', () => {
    renderPage();
    expect(screen.queryByTestId('edit-modal-open')).not.toBeInTheDocument();
    // Scope to the property-header testid — the Notes card also has an Edit button.
    const header = screen.getByTestId('property-header');
    fireEvent.click(within(header).getByRole('button', { name: 'Edit' }));
    expect(screen.getByTestId('edit-modal-open')).toBeInTheDocument();
  });
});
