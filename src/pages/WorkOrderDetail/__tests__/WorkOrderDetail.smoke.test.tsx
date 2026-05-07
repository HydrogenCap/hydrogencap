import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common', () => ({
  LoadingState: ({ text }: { text: string }) => <div>{text}</div>,
  MobileDetailsSheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/works/WorkOrderPipeline', () => ({ WorkOrderPipeline: () => <div>Pipeline</div> }));
vi.mock('@/components/works/ApprovalWorkflow', () => ({ ApprovalWorkflow: () => <div /> }));
vi.mock('@/components/works/MaterialTracker', () => ({ MaterialTracker: () => <div>Materials</div> }));
vi.mock('@/components/works/WarrantyTracker', () => ({ WarrantyTracker: () => <div>Warranty</div> }));
vi.mock('@/hooks/useWorkOrders', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useWorkOrders')>('@/hooks/useWorkOrders');
  return {
    ...actual,
    useWorkOrder: () => ({
      data: {
        id: 'wo1', wo_number: 'WO-001', title: 'Fix boiler', status: 'draft',
        category: 'plumbing', priority: 'high', estimated_cost: 500,
        approved_budget: null, actual_cost: null, cost_items: [], jobs: [],
        property_id: 'p1', maintenance_request_id: null, description: null,
        internal_notes: null, target_start_date: null, target_completion_date: null,
        actual_completion_date: null, invoice_reference: null,
        property: { address_line_1: '1 High St', city: 'London' },
      },
      isLoading: false,
    }),
    useSubmitWorkOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useApproveWorkOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRejectWorkOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateWorkOrder: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useCompleteWorkOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useAddCostItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteCostItem: () => ({ mutate: vi.fn() }),
  };
});

import WorkOrderDetail from '../index';

describe('WorkOrderDetail (smoke)', () => {
  it('renders header and tabs', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/work-orders/wo1']}>
          <Routes>
            <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: /Fix boiler/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /costs/i })).toBeInTheDocument();
  });
});
