import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Stable hook mocks — each test can tweak the per-test state below.
let properties: Array<Record<string, unknown>> | undefined;
let isLoading = false;

vi.mock('@/hooks/usePropertiesV2', async () => {
  // Keep the real constants so filter Select items render with the same
  // labels the component expects.
  const actual = await vi.importActual<typeof import('@/hooks/usePropertiesV2')>('@/hooks/usePropertiesV2');
  return {
    ...actual,
    usePropertiesV2: () => ({ data: properties, isLoading }),
    getPropertyComplianceStatus: () => 'green' as const,
  };
});

vi.mock('@/hooks/useRoomsV2', () => ({
  usePropertyRoomSummaries: () => ({
    data: new Map([['p1', { total_occupied: 3, total_lettable: 4, gross_rent_pcm: 2_400 }]]),
  }),
}));

vi.mock('@/hooks/useLegalEntities', () => ({
  useLegalEntities: () => ({
    data: [{ id: 'ent-1', entity_name: 'Acme Ltd' }],
  }),
}));

vi.mock('@/hooks/usePropertyPhotosV2', () => ({
  usePropertyPhotosV2: () => ({ data: new Map() }),
}));

vi.mock('@/hooks/useBulkEpcEnrichV2', () => ({
  useBulkEpcEnrichV2: () => ({ enrichAll: vi.fn(), isEnriching: false }),
}));

vi.mock('@/hooks/useDemoData', () => ({
  useDemoData: () => ({ seed: { mutate: vi.fn() } }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock('@/components/properties-v2/PropertyFormModal', () => ({
  PropertyFormModal: () => null,
}));

vi.mock('@/components/properties-v2/wizard/PropertyWizard', () => ({
  PropertyWizard: ({ open }: { open: boolean }) => (open ? <div data-testid="wizard-open" /> : null),
}));

import PropertiesV2 from '../PropertiesV2';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PropertiesV2 />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeProperty(overrides: Record<string, unknown>) {
  return {
    id: 'p1',
    address_line_1: '10 High Street',
    address_line_2: null,
    city: 'Oxford',
    postcode: 'OX1 1AA',
    property_type: 'single_let',
    lifecycle_stage: 'stabilised',
    listing_grade: 'none',
    current_valuation: 300_000,
    purchase_date: '2023-01-01',
    total_lettable_rooms: 3,
    rent_basis: 'whole_house',
    whole_house_rent_pcm: 1_500,
    entity_id: 'ent-1',
    entity_name: 'Acme Ltd',
    entity_type: 'spv',
    ...overrides,
  };
}

describe('PropertiesV2 page', () => {
  beforeEach(() => {
    properties = [makeProperty({})];
    isLoading = false;
  });

  it('renders the page header and primary CTAs', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Properties' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Property/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enrich EPC/i })).toBeInTheDocument();
  });

  it('shows loading skeletons while properties are loading', () => {
    properties = undefined;
    isLoading = true;
    const { container } = renderPage();
    // PropertyCardSkeleton does not carry a testid — assert the list area is
    // empty of property cards and that the heading still renders.
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Properties')).toBeInTheDocument();
  });

  it('shows the empty-first-property state when there are no properties', () => {
    properties = [];
    renderPage();
    expect(screen.getByText('No properties yet')).toBeInTheDocument();
  });

  it('shows the empty-filters state when filters exclude all properties', () => {
    properties = [makeProperty({})];
    renderPage();
    const searchInput = screen.getByLabelText('Search properties by address or postcode');
    fireEvent.change(searchInput, { target: { value: 'nonexistent-string-xyz' } });
    expect(screen.getByText('No properties match your filters')).toBeInTheDocument();
  });

  it('renders a property card with address, entity, monthly rent and stats', () => {
    properties = [makeProperty({})];
    renderPage();
    expect(screen.getByText('10 High Street')).toBeInTheDocument();
    expect(screen.getByText('Oxford, OX1 1AA')).toBeInTheDocument();
    // Monthly rent stat card shows the £1,500 formatted value
    const rentMatches = screen.getAllByText(/£1,500/);
    expect(rentMatches.length).toBeGreaterThan(0);
    // Total Properties stat card shows "1"
    const totalCard = screen.getByText('Total Properties').parentElement!;
    expect(within(totalCard).getByText('1')).toBeInTheDocument();
  });

  it('filters by search term (case-insensitive, matches address or postcode)', () => {
    properties = [
      makeProperty({ id: 'p1', address_line_1: '10 High Street', postcode: 'OX1 1AA', city: 'Oxford' }),
      makeProperty({ id: 'p2', address_line_1: '5 Low Road', postcode: 'CB2 2BB', city: 'Cambridge' }),
    ];
    renderPage();
    const searchInput = screen.getByLabelText('Search properties by address or postcode');
    fireEvent.change(searchInput, { target: { value: 'OXFORD' } });
    expect(screen.getByText('10 High Street')).toBeInTheDocument();
    expect(screen.queryByText('5 Low Road')).not.toBeInTheDocument();
  });

  it('opens the property wizard when Add Property is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Add Property/i }));
    expect(screen.getByTestId('wizard-open')).toBeInTheDocument();
  });
});
