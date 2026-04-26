import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListState } from './ListState';

const baseProps = {
  emptyTitle: 'No items',
  emptyDescription: 'Add your first one to get started.',
  onRetry: vi.fn(),
};

describe('ListState', () => {
  it('renders 5 skeleton rows in loading state', () => {
    const { container } = render(
      <ListState {...baseProps} isLoading error={null} isEmpty={false}>
        <div>content</div>
      </ListState>,
    );
    expect(screen.getByTestId('list-state-loading')).toBeInTheDocument();
    // 5 skeleton rows
    expect(container.querySelectorAll('[data-testid="list-state-loading"] > *')).toHaveLength(5);
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('renders error card with safe message and retry', () => {
    const onRetry = vi.fn();
    render(
      <ListState
        {...baseProps}
        onRetry={onRetry}
        isLoading={false}
        error={new Error('Network unreachable')}
        isEmpty={false}
      >
        <div>content</div>
      </ListState>,
    );
    expect(screen.getByText('Something went wrong loading this list')).toBeInTheDocument();
    expect(screen.getByText('Network unreachable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides leaky pgrst/supabase error messages behind a generic fallback', () => {
    render(
      <ListState
        {...baseProps}
        isLoading={false}
        error={new Error('PGRST116: row not found in supabase')}
        isEmpty={false}
      >
        <div>content</div>
      </ListState>,
    );
    expect(screen.getByText('Please try again.')).toBeInTheDocument();
    expect(screen.queryByText(/pgrst/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/supabase/i)).not.toBeInTheDocument();
  });

  it('renders empty state with optional CTA', () => {
    const onClick = vi.fn();
    render(
      <ListState
        {...baseProps}
        isLoading={false}
        error={null}
        isEmpty
        emptyAction={{ label: 'Create one', onClick }}
      >
        <div>content</div>
      </ListState>,
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Add your first one to get started.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create one' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders children when populated', () => {
    render(
      <ListState {...baseProps} isLoading={false} error={null} isEmpty={false}>
        <div>actual list rows</div>
      </ListState>,
    );
    expect(screen.getByText('actual list rows')).toBeInTheDocument();
    expect(screen.queryByTestId('list-state-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('list-state-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('list-state-error')).not.toBeInTheDocument();
  });
});
