import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedNumber } from '../AnimatedNumber';

describe('AnimatedNumber', () => {
  // matchMedia is mocked to return prefers-reduced-motion: false in setup.ts
  // So animation logic runs, but for snapshot testing we check initial render

  it('renders the value', () => {
    render(<AnimatedNumber value={1000} />);
    // On initial render, the display starts at the value (or animates to it)
    // With reduced-motion mocked to false, animation starts — but the initial state is the value
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
  });

  it('renders with prefix', () => {
    render(<AnimatedNumber value={500} prefix="£" />);
    expect(screen.getByText(/£/)).toBeInTheDocument();
  });

  it('renders with suffix', () => {
    render(<AnimatedNumber value={95} suffix="%" />);
    expect(screen.getByText(/%/)).toBeInTheDocument();
  });

  it('renders with both prefix and suffix', () => {
    render(<AnimatedNumber value={1234} prefix="£" suffix="/mo" />);
    const el = screen.getByText(/£.*\/mo/);
    expect(el).toBeInTheDocument();
  });

  it('formats large numbers with commas (UK format)', () => {
    render(<AnimatedNumber value={1000000} />);
    expect(screen.getByText(/1,000,000/)).toBeInTheDocument();
  });

  it('rounds displayed number to nearest integer', () => {
    render(<AnimatedNumber value={999.7} />);
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
  });

  it('renders zero correctly', () => {
    render(<AnimatedNumber value={0} prefix="£" />);
    expect(screen.getByText(/£0/)).toBeInTheDocument();
  });

  it('renders negative values', () => {
    render(<AnimatedNumber value={-500} prefix="£" />);
    expect(screen.getByText(/-500/)).toBeInTheDocument();
  });
});
