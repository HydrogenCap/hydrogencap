import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PropertyStatusBar } from '../PropertyStatusBar';

vi.mock('@/hooks/useCompliance', () => ({
  usePropertyCompliance: () => ({ data: null }),
}));

vi.mock('@/hooks/usePropertyPassport', () => ({
  usePropertyPassport: () => ({ data: null }),
  calculatePassportCompleteness: () => ({ percentage: 75, filled: 15, total: 20 }),
}));

vi.mock('@/hooks/usePortfolioRisks', () => ({
  usePortfolioRisks: () => ({ risks: null }),
}));

vi.mock('@/hooks/useTenancies', () => ({
  useTenancies: () => ({ data: null }),
}));

vi.mock('@/lib/calculations', () => ({
  getExpiryStatus: () => 'valid',
}));

vi.mock('@/lib/complianceStatus', () => ({
  getComplianceStatus: () => 'valid',
}));

describe('PropertyStatusBar', () => {
  it('renders without crashing', () => {
    const { container } = render(<PropertyStatusBar propertyId="prop-1" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('shows compliance section', () => {
    render(<PropertyStatusBar propertyId="prop-1" />);
    expect(screen.getByText('Not checked')).toBeInTheDocument();
  });

  it('shows void status when no tenancies', () => {
    render(<PropertyStatusBar propertyId="prop-1" />);
    expect(screen.getByText('Void')).toBeInTheDocument();
  });

  it('shows Development status for development lifecycle', () => {
    render(<PropertyStatusBar propertyId="prop-1" lifecycleType="development" />);
    expect(screen.getByText('Development')).toBeInTheDocument();
  });

  it('shows "No actions due" when no risks', () => {
    render(<PropertyStatusBar propertyId="prop-1" />);
    expect(screen.getByText('No actions due')).toBeInTheDocument();
  });

  it('shows data quality score', () => {
    render(<PropertyStatusBar propertyId="prop-1" />);
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('renders four sections in grid', () => {
    const { container } = render(<PropertyStatusBar propertyId="prop-1" />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
  });
});
