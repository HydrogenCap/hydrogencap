import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatusDot } from '../StatusDot';

describe('StatusDot', () => {
  it('renders as a span element', () => {
    const { container } = render(<StatusDot severity="critical" />);
    expect(container.querySelector('span')).toBeInTheDocument();
  });

  it('has rounded-full class for dot shape', () => {
    const { container } = render(<StatusDot severity="info" />);
    const dot = container.querySelector('span');
    expect(dot?.className).toContain('rounded-full');
  });

  it('has standard size classes', () => {
    const { container } = render(<StatusDot severity="success" />);
    const dot = container.querySelector('span');
    expect(dot?.className).toContain('h-2');
    expect(dot?.className).toContain('w-2');
  });

  it('applies pulse animation when pulse=true', () => {
    const { container } = render(<StatusDot severity="warning" pulse />);
    const dot = container.querySelector('span');
    expect(dot?.className).toContain('animate-pulse');
  });

  it('does not pulse by default', () => {
    const { container } = render(<StatusDot severity="warning" />);
    const dot = container.querySelector('span');
    expect(dot?.className).not.toContain('animate-pulse');
  });

  it('does not pulse when pulse=false', () => {
    const { container } = render(<StatusDot severity="critical" pulse={false} />);
    const dot = container.querySelector('span');
    expect(dot?.className).not.toContain('animate-pulse');
  });

  it('applies custom className', () => {
    const { container } = render(<StatusDot severity="info" className="ml-2" />);
    const dot = container.querySelector('span');
    expect(dot?.className).toContain('ml-2');
  });

  it('renders all severity levels without crashing', () => {
    const levels = ['critical', 'warning', 'info', 'success', 'neutral'] as const;
    for (const severity of levels) {
      const { container, unmount } = render(<StatusDot severity={severity} />);
      expect(container.querySelector('span')).toBeInTheDocument();
      unmount();
    }
  });
});
