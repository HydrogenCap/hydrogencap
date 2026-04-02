import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmptyState } from '../EmptyState';
import { AlertCircle } from 'lucide-react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('EmptyState', () => {
  it('renders title', () => {
    renderWithRouter(<EmptyState title="No properties found" />);
    expect(screen.getByText('No properties found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    renderWithRouter(
      <EmptyState title="Empty" description="Add a property to get started" />,
    );
    expect(screen.getByText('Add a property to get started')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    renderWithRouter(<EmptyState title="Empty" />);
    expect(screen.queryByText('Add a property')).not.toBeInTheDocument();
  });

  it('renders primary action button', () => {
    renderWithRouter(
      <EmptyState title="Empty" action={{ label: 'Add Property', href: '/add' }} />,
    );
    expect(screen.getByRole('button', { name: 'Add Property' })).toBeInTheDocument();
  });

  it('navigates when action with href is clicked', () => {
    renderWithRouter(
      <EmptyState title="Empty" action={{ label: 'Go', href: '/somewhere' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(mockNavigate).toHaveBeenCalledWith('/somewhere');
  });

  it('calls onClick when action has onClick', () => {
    const handleClick = vi.fn();
    renderWithRouter(
      <EmptyState title="Empty" action={{ label: 'Click me', onClick: handleClick }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('renders secondary action button', () => {
    renderWithRouter(
      <EmptyState
        title="Empty"
        action={{ label: 'Primary' }}
        secondaryAction={{ label: 'Secondary' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument();
  });

  it('renders children', () => {
    renderWithRouter(
      <EmptyState title="Empty">
        <p data-testid="child">Custom content</p>
      </EmptyState>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = renderWithRouter(
      <EmptyState title="Empty" className="my-custom-class" />,
    );
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('renders with custom icon', () => {
    renderWithRouter(<EmptyState title="Warning" icon={AlertCircle} />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders success variant with emerald styling', () => {
    const { container } = renderWithRouter(
      <EmptyState title="All done!" variant="success" />,
    );
    expect(container.querySelector('.bg-emerald-500\\/10')).toBeInTheDocument();
  });
});
