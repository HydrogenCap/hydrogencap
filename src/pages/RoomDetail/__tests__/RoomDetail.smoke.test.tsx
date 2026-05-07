import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/useRoomsV2', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useRoomsV2')>('@/hooks/useRoomsV2');
  return {
    ...actual,
    useRoom: () => ({
      data: {
        id: 'r1', property_id: 'p1', room_name: 'Room A',
        room_type: 'double', floor: 1, has_ensuite: false, is_lettable: true,
        current_rent_pcm: 600, target_rent_pcm: 650, occupancy_status: 'vacant',
        notes: null, size_sqm: null, occupancy_type: null, amenity_type: null,
        created_at: '', updated_at: '',
        properties_v2: { address_line_1: '1 High St', city: 'London', postcode: 'E1' },
      },
      isLoading: false,
    }),
    useUpdateRoom: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});
vi.mock('@/hooks/useTenancyAgreements', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useTenancyAgreements')>('@/hooks/useTenancyAgreements');
  return { ...actual, useTenancyAgreements: () => ({ data: [] }) };
});
vi.mock('@/hooks/useRoomPnL', () => ({
  useRoomPnL: () => ({ data: null, isLoading: false }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabaseAny: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [] }),
          not: () => Promise.resolve({ data: [] }),
        }),
      }),
    }),
  },
}));
vi.mock('@/components/properties-v2/RoomFormModal', () => ({ RoomFormModal: () => null }));
vi.mock('@/components/tenants-v2/CreateTenancyAgreementModal', () => ({ CreateTenancyAgreementModal: () => null }));

import RoomDetail from '../index';

describe('RoomDetail (smoke)', () => {
  it('renders header and core cards', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/rooms-v2/r1']}>
          <Routes>
            <Route path="/rooms-v2/:id" element={<RoomDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: /Room A/i })).toBeInTheDocument();
    expect(screen.getByText(/Details/i)).toBeInTheDocument();
    expect(screen.getByText(/Current Tenant/i)).toBeInTheDocument();
  });
});
