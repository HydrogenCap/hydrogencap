import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecordPaymentDialog from '../RecordPaymentDialog';

const mockMutate = vi.fn();
vi.mock('@/hooks/useRentCollection', () => ({
  useRecordPayment: () => ({ mutate: mockMutate, isPending: false }),
  normalizeRentItem: (_item: any) => ({
    tenantName: 'Jane Smith',
    tenantEmail: 'jane@test.com',
    propertyAddress: '5 Oak Lane',
    roomName: 'Room B',
  }),
}));

vi.mock('@/components/rent/RentReceiptDialog', () => ({
  RentReceiptDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="receipt-dialog">Receipt</div> : null,
}));

const mockItem = {
  id: 'rs-1',
  tenancy_id: 'ten-1',
  agreement_id: 'agr-1',
  rent_amount: 1200,
  additional_charges: 50,
  amount_paid: 200,
  amount_outstanding: 1050,
  status: 'partial' as const,
  due_date: '2025-06-01',
  month: '2025-06',
  tenant: { first_name: 'Jane', last_name: 'Smith', email: 'jane@test.com' },
  room: { room_name: 'Room B' },
  property: { address_line_1: '5 Oak Lane', postcode: 'N1 1AA' },
};

describe('RecordPaymentDialog', () => {
  beforeEach(() => {
    mockMutate.mockReset();
  });

  it('renders nothing visible when item is null and receipt is not showing', () => {
    const { container: _container } = render(
      <RecordPaymentDialog item={null} open={false} onOpenChange={() => {}} />,
    );
    // Only receipt dialog rendered (but closed)
    expect(screen.queryByText('Record Payment')).not.toBeInTheDocument();
  });

  it('renders dialog title when open with item', () => {
    render(
      <RecordPaymentDialog item={mockItem as any} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByRole('heading', { name: 'Record Payment' })).toBeInTheDocument();
  });

  it('displays outstanding amount', () => {
    render(
      <RecordPaymentDialog item={mockItem as any} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText(/Outstanding/)).toBeInTheDocument();
    expect(screen.getByText(/£1,050/)).toBeInTheDocument();
  });

  it('displays rent due amount', () => {
    render(
      <RecordPaymentDialog item={mockItem as any} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText(/Rent due/)).toBeInTheDocument();
    expect(screen.getByText(/£1,200/)).toBeInTheDocument();
  });

  it('displays already paid when amount_paid > 0', () => {
    render(
      <RecordPaymentDialog item={mockItem as any} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText(/Already paid/)).toBeInTheDocument();
    expect(screen.getByText(/£200/)).toBeInTheDocument();
  });

  it('displays additional charges when > 0', () => {
    render(
      <RecordPaymentDialog item={mockItem as any} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText(/Additional charges/)).toBeInTheDocument();
  });

  it('renders Full Payment toggle', () => {
    render(
      <RecordPaymentDialog item={mockItem as any} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText('Full Payment')).toBeInTheDocument();
  });

  it('renders payment method dropdown', () => {
    render(
      <RecordPaymentDialog item={mockItem as any} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText('Payment Method')).toBeInTheDocument();
  });

  it('renders Cancel and Record Payment buttons', () => {
    render(
      <RecordPaymentDialog item={mockItem as any} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record Payment' })).toBeInTheDocument();
  });

  it('shows tenant and property info in description', () => {
    render(
      <RecordPaymentDialog item={mockItem as any} open={true} onOpenChange={() => {}} />,
    );
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    expect(screen.getByText(/5 Oak Lane/)).toBeInTheDocument();
  });
});
