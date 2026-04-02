import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SnoozeActionDialog } from '../SnoozeActionDialog';

// Mock hooks
const mockMutate = vi.fn();
vi.mock('@/hooks/useActionWorkflows', () => ({
  useSnoozeAction: () => ({ mutate: mockMutate, isPending: false }),
  getActionKey: (id: string) => ({ actionType: 'risk', actionKey: id }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockRisk = {
  id: 'risk-1',
  propertyId: 'prop-1',
  address: '1 Test Street',
  message: 'Gas safety certificate expired',
  severity: 'critical' as const,
  category: 'compliance',
  actionUrl: '/compliance',
  type: 'ltv' as const,
  targetUrl: '/compliance',
  priority: 1,
};

describe('SnoozeActionDialog', () => {
  beforeEach(() => {
    mockMutate.mockReset();
  });

  it('renders nothing when risk is null', () => {
    const { container } = render(
      <SnoozeActionDialog open={true} onOpenChange={() => {}} risk={null} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog title when open with risk', () => {
    render(
      <SnoozeActionDialog open={true} onOpenChange={() => {}} risk={mockRisk} />,
    );
    expect(screen.getByText('Snooze Action')).toBeInTheDocument();
  });

  it('displays the risk address and message', () => {
    render(
      <SnoozeActionDialog open={true} onOpenChange={() => {}} risk={mockRisk} />,
    );
    expect(screen.getByText('1 Test Street')).toBeInTheDocument();
    expect(screen.getByText('Gas safety certificate expired')).toBeInTheDocument();
  });

  it('renders all snooze duration buttons', () => {
    render(
      <SnoozeActionDialog open={true} onOpenChange={() => {}} risk={mockRisk} />,
    );
    expect(screen.getByRole('button', { name: '1 week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 weeks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3 months' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom date' })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(
      <SnoozeActionDialog open={true} onOpenChange={() => {}} risk={mockRisk} />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders Snooze submit button', () => {
    render(
      <SnoozeActionDialog open={true} onOpenChange={() => {}} risk={mockRisk} />,
    );
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeInTheDocument();
  });

  it('calls onOpenChange when Cancel is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <SnoozeActionDialog open={true} onOpenChange={onOpenChange} risk={mockRisk} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('displays descriptive text about snooze behaviour', () => {
    render(
      <SnoozeActionDialog open={true} onOpenChange={() => {}} risk={mockRisk} />,
    );
    expect(screen.getByText(/Hide this action temporarily/)).toBeInTheDocument();
  });
});
