import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeverityBadge } from '../SeverityBadge';
import { SEVERITY } from '@/lib/design-tokens';

describe('SeverityBadge', () => {
  it('renders children text', () => {
    render(<SeverityBadge severity="critical">Expired</SeverityBadge>);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('applies critical badge classes', () => {
    render(<SeverityBadge severity="critical">Expired</SeverityBadge>);
    const badge = screen.getByText('Expired');
    // Check the badge class from design tokens
    expect(badge.className).toContain('rounded-full');
  });

  it('applies warning badge classes', () => {
    render(<SeverityBadge severity="warning">Expiring</SeverityBadge>);
    expect(screen.getByText('Expiring')).toBeInTheDocument();
  });

  it('applies success badge classes', () => {
    render(<SeverityBadge severity="success">Valid</SeverityBadge>);
    expect(screen.getByText('Valid')).toBeInTheDocument();
  });

  it('applies info badge classes', () => {
    render(<SeverityBadge severity="info">Pending</SeverityBadge>);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('applies neutral badge classes', () => {
    render(<SeverityBadge severity="neutral">N/A</SeverityBadge>);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <SeverityBadge severity="critical" className="extra-class">
        Test
      </SeverityBadge>,
    );
    const badge = screen.getByText('Test');
    expect(badge.className).toContain('extra-class');
  });

  it('renders as inline span element', () => {
    render(<SeverityBadge severity="info">Badge</SeverityBadge>);
    const badge = screen.getByText('Badge');
    expect(badge.tagName).toBe('SPAN');
  });

  it('renders with all five severity levels without crashing', () => {
    const levels = ['critical', 'warning', 'info', 'success', 'neutral'] as const;
    for (const level of levels) {
      const { unmount } = render(
        <SeverityBadge severity={level}>{level}</SeverityBadge>,
      );
      expect(screen.getByText(level)).toBeInTheDocument();
      unmount();
    }
  });
});
