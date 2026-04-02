import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DistributionFormModal } from '../DistributionFormModal';

vi.mock('@/hooks/useInvestorDetail', () => ({
  useCreateDistribution: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const commitments = [
  { id: 'c-1', entity_name: 'SPV Alpha Ltd', commitment_type: 'equity', entity_id: 'e-1' },
  { id: 'c-2', entity_name: 'SPV Beta Ltd', commitment_type: 'loan', entity_id: 'e-2' },
];

describe('DistributionFormModal', () => {
  it('renders dialog title when open', () => {
    render(
      <DistributionFormModal
        open={true}
        onOpenChange={() => {}}
        investorId="inv-1"
        commitments={commitments}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Record Distribution' })).toBeInTheDocument();
  });

  it('renders Commitment field', () => {
    render(
      <DistributionFormModal
        open={true}
        onOpenChange={() => {}}
        investorId="inv-1"
        commitments={commitments}
      />,
    );
    expect(screen.getByText(/Commitment/)).toBeInTheDocument();
  });

  it('renders Type field', () => {
    render(
      <DistributionFormModal
        open={true}
        onOpenChange={() => {}}
        investorId="inv-1"
        commitments={commitments}
      />,
    );
    expect(screen.getByText(/Type \*/)).toBeInTheDocument();
  });

  it('renders Gross Amount field', () => {
    render(
      <DistributionFormModal
        open={true}
        onOpenChange={() => {}}
        investorId="inv-1"
        commitments={commitments}
      />,
    );
    expect(screen.getByText(/Gross Amount/)).toBeInTheDocument();
  });

  it('renders Distribution Date field', () => {
    render(
      <DistributionFormModal
        open={true}
        onOpenChange={() => {}}
        investorId="inv-1"
        commitments={commitments}
      />,
    );
    expect(screen.getByText(/Distribution Date/)).toBeInTheDocument();
  });

  it('renders Tax Deducted field', () => {
    render(
      <DistributionFormModal
        open={true}
        onOpenChange={() => {}}
        investorId="inv-1"
        commitments={commitments}
      />,
    );
    expect(screen.getByText(/Tax Deducted/)).toBeInTheDocument();
  });

  it('renders Cancel and submit buttons', () => {
    render(
      <DistributionFormModal
        open={true}
        onOpenChange={() => {}}
        investorId="inv-1"
        commitments={commitments}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record Distribution' })).toBeInTheDocument();
  });

  it('renders Period From and Period To fields', () => {
    render(
      <DistributionFormModal
        open={true}
        onOpenChange={() => {}}
        investorId="inv-1"
        commitments={commitments}
      />,
    );
    expect(screen.getByText('Period From')).toBeInTheDocument();
    expect(screen.getByText('Period To')).toBeInTheDocument();
  });

  it('renders Notes field', () => {
    render(
      <DistributionFormModal
        open={true}
        onOpenChange={() => {}}
        investorId="inv-1"
        commitments={commitments}
      />,
    );
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('renders Payment Reference field', () => {
    render(
      <DistributionFormModal
        open={true}
        onOpenChange={() => {}}
        investorId="inv-1"
        commitments={commitments}
      />,
    );
    expect(screen.getByText('Payment Reference')).toBeInTheDocument();
  });
});
