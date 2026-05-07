import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/usePropertiesV2', () => ({
  usePropertyV2: () => ({
    data: {
      id: 'p1', org_id: 'o1', entity_id: 'e1',
      address_line_1: '12 Test St', address_line_2: null,
      city: 'London', postcode: 'SW1A 1AA', property_type: 'hmo_licensed',
      lifecycle_stage: 'letting', listing_grade: 'none', rent_basis: 'whole_house',
      whole_house_rent_pcm: 2000, current_valuation: 500000, purchase_price: 400000,
      purchase_date: '2020-01-01', valuation_date: '2025-01-01',
      council_name: null, council_area: null, year_built: 1900,
      total_floors: 2, total_lettable_rooms: 4, notes: null, epc_rating: 'C',
    },
    isLoading: false,
  }),
  useUpdatePropertyV2: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useComplianceV2', () => ({ usePropertyComplianceV2: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useInsurance', () => ({ useInsurancePolicies: () => ({ data: [] }) }));
vi.mock('@/hooks/useLoanFacilities', () => ({ useLoanFacilitiesByProperty: () => ({ data: [] }) }));
vi.mock('@/hooks/usePropertyPhotosV2', () => ({ usePropertyPhotoV2: () => null }));
vi.mock('@/hooks/useUserOrg', () => ({ fetchUserOrgId: vi.fn(async () => 'o1') }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { storage: { from: () => ({ createSignedUrls: vi.fn(async () => ({ data: [] })) }) } },
  supabaseAny: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
        gte: () => ({ lte: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  },
}));
vi.mock('@/components/property-detail/PropertyStatusBar', () => ({ PropertyStatusBar: () => <div data-testid="status-bar" /> }));
vi.mock('@/components/property-detail/PropertyHeader', () => ({ PropertyHeader: () => <div data-testid="header" /> }));
vi.mock('@/components/property-detail/PropertyTimeline', () => ({ PropertyTimeline: () => <div /> }));
vi.mock('@/components/property-detail/LeaseholdHealthCard', () => ({ LeaseholdHealthCard: () => <div /> }));
vi.mock('@/components/property-detail/HMOCompliancePanel', () => ({ HMOCompliancePanel: () => <div /> }));
vi.mock('@/components/properties-v2/PropertyRoomsSection', () => ({ PropertyRoomsSection: () => <div /> }));
vi.mock('@/components/properties-v2/PropertyFormModal', () => ({ PropertyFormModal: () => null }));
vi.mock('@/components/lending/PropertyLoansSection', () => ({ PropertyLoansSection: () => <div /> }));
vi.mock('@/components/compliance-v2/PropertyComplianceSection', () => ({ PropertyComplianceSection: () => <div /> }));
vi.mock('@/components/financials/PropertyFinancialSection', () => ({ PropertyFinancialSection: () => <div /> }));
vi.mock('@/components/financials/PropertyPnLCard', () => ({ PropertyPnLCard: () => <div /> }));
vi.mock('@/components/audit/InlineAuditHistory', () => ({ InlineAuditHistory: () => <div /> }));
vi.mock('@/components/communications/CommunicationTimeline', () => ({ CommunicationTimeline: () => <div /> }));
vi.mock('@/components/property/EpcRoadmapCard', () => ({ EpcRoadmapCard: () => <div /> }));
vi.mock('@/components/valuations', () => ({ ComparableSalesTable: () => <div /> }));
vi.mock('@/components/valuations/ValuationHistoryChart', () => ({ ValuationHistoryChart: () => <div /> }));
vi.mock('@/components/valuations/ComparableEvidenceLog', () => ({ ComparableEvidenceLog: () => <div /> }));
vi.mock('@/components/valuations/RevaluationTrigger', () => ({ RevaluationTrigger: () => <div /> }));
vi.mock('@/components/valuations/ValuationRecordForm', () => ({ ValuationRecordForm: () => null }));

import PropertyDetail from '../index';

describe('PropertyDetail (smoke)', () => {
  it('renders header, status bar, and tabs', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/property/p1']}>
          <Routes>
            <Route path="/property/:id" element={<PropertyDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
  });
});
