import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadingButton } from '../LoadingButton';

describe('LoadingButton', () => {
  it('renders children text', () => {
    render(<LoadingButton>Save</LoadingButton>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('is enabled by default', () => {
    render(<LoadingButton>Click</LoadingButton>);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('disables button when loading=true', () => {
    render(<LoadingButton loading>Save</LoadingButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables button when disabled=true', () => {
    render(<LoadingButton disabled>Save</LoadingButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables button when both loading and disabled are true', () => {
    render(<LoadingButton loading disabled>Save</LoadingButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows spinner SVG when loading', () => {
    const { container } = render(<LoadingButton loading>Save</LoadingButton>);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('does not show spinner when not loading', () => {
    const { container } = render(<LoadingButton>Save</LoadingButton>);
    const spinners = container.querySelectorAll('.animate-spin');
    expect(spinners).toHaveLength(0);
  });

  it('shows loadingText when loading and loadingText is provided', () => {
    render(
      <LoadingButton loading loadingText="Saving...">
        Save
      </LoadingButton>,
    );
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows children when loading and no loadingText', () => {
    render(<LoadingButton loading>Save</LoadingButton>);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('calls onClick when not loading', () => {
    const handleClick = vi.fn();
    render(<LoadingButton onClick={handleClick}>Go</LoadingButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('renders as button element', () => {
    render(<LoadingButton>Test</LoadingButton>);
    expect(screen.getByRole('button').tagName).toBe('BUTTON');
  });
});
