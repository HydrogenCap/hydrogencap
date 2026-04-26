import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the hook before importing the component
vi.mock('@/hooks/useWelcomeOverlay', () => ({
  useWelcomeOverlay: vi.fn(),
}));

// Auth + org hooks (defensive — component may call them on mount)
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));
vi.mock('@/hooks/useUserOrg', () => ({
  useUserOrg: () => ({ data: 'org-1' }),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { WelcomeOverlay } from '../WelcomeOverlay';
import { useWelcomeOverlay } from '@/hooks/useWelcomeOverlay';

const mockedUseWelcomeOverlay = vi.mocked(useWelcomeOverlay);

beforeEach(() => {
  mockedUseWelcomeOverlay.mockReset();
});

describe('WelcomeOverlay', () => {
  it('renders the welcome heading when shouldShow is true', () => {
    mockedUseWelcomeOverlay.mockReturnValue({
      shouldShow: true,
      isLoading: false,
      band: null,
      markSeen: vi.fn(),
      setBand: vi.fn(),
    } as unknown as ReturnType<typeof useWelcomeOverlay>);

    render(<WelcomeOverlay />);

    expect(screen.getByText(/Welcome to TenureIQ/i)).toBeInTheDocument();
  });

  it('renders nothing when shouldShow is false', () => {
    mockedUseWelcomeOverlay.mockReturnValue({
      shouldShow: false,
      isLoading: false,
      band: null,
      markSeen: vi.fn(),
      setBand: vi.fn(),
    } as unknown as ReturnType<typeof useWelcomeOverlay>);

    const { container } = render(<WelcomeOverlay />);

    expect(screen.queryByText(/Welcome to TenureIQ/i)).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });
});
