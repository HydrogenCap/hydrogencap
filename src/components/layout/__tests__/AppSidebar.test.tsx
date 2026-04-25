import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock all hooks
vi.mock('@/hooks/usePortfolioComplianceStats', () => ({
  usePortfolioComplianceStats: () => ({ stats: { expired: 0, expiring: 0, valid: 0, total: 0 } }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn(), user: { email: 'test@example.com' } }),
}));
vi.mock('@/hooks/useDocuments', () => ({
  useInboxDocuments: () => ({ data: null }),
}));
vi.mock('@/hooks/usePortfolioRisks', () => ({
  usePortfolioRisks: () => ({ totalCount: 0, criticalCount: 0 }),
}));
vi.mock('@/hooks/useContractorJobs', () => ({
  useJobCounts: () => ({ data: null }),
}));
vi.mock('@/hooks/useComplianceTasks', () => ({
  useComplianceTaskStats: () => ({ overdueCount: 0, totalCount: 0 }),
}));
vi.mock('@/hooks/useTenancyEvents', () => ({
  useTenancyEventCounts: () => ({ urgentCount: 0 }),
}));
vi.mock('@/hooks/usePlatformAdmin', () => ({
  useIsAdmin: () => false,
}));
vi.mock('@/hooks/useSectionVisibility', () => ({
  useSectionVisibility: () => ({ isVisible: () => true }),
}));
vi.mock('@/components/LogoWordmark', () => ({
  LogoWordmark: () => <div data-testid="logo">TenureIQ</div>,
}));
vi.mock('@/components/layout/OrganizationSwitcher', () => ({
  OrganizationSwitcher: () => <div data-testid="org-switcher">Org</div>,
}));
vi.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

// Mock sidebar UI components to simplify rendering
type SidebarMockProps = { children?: React.ReactNode; [key: string]: unknown };
vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: SidebarMockProps) => <nav data-testid="sidebar">{children}</nav>,
  SidebarContent: ({ children }: SidebarMockProps) => <div>{children}</div>,
  SidebarFooter: ({ children }: SidebarMockProps) => <div data-testid="sidebar-footer">{children}</div>,
  SidebarGroup: ({ children }: SidebarMockProps) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: SidebarMockProps) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: SidebarMockProps) => <span>{children}</span>,
  SidebarHeader: ({ children }: SidebarMockProps) => <div data-testid="sidebar-header">{children}</div>,
  SidebarMenu: ({ children }: SidebarMockProps) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children, ...props }: SidebarMockProps) => <div {...props}>{children}</div>,
  SidebarMenuItem: ({ children }: SidebarMockProps) => <li>{children}</li>,
  SidebarMenuSub: ({ children }: SidebarMockProps) => <ul>{children}</ul>,
  SidebarMenuSubButton: ({ children, ...props }: SidebarMockProps) => <div {...props}>{children}</div>,
  SidebarMenuSubItem: ({ children }: SidebarMockProps) => <li>{children}</li>,
}));

import { AppSidebar } from '../AppSidebar';

function renderSidebar(path = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AppSidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppSidebar', () => {
  it('renders sidebar element', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders logo in header', () => {
    renderSidebar();
    expect(screen.getByTestId('logo')).toBeInTheDocument();
  });

  it('renders Portfolio section', () => {
    renderSidebar();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
  });

  it('renders Operations section', () => {
    renderSidebar();
    expect(screen.getByText('Operations')).toBeInTheDocument();
  });

  it('renders Intelligence section', () => {
    renderSidebar();
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
  });

  it('renders Admin section', () => {
    renderSidebar();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders Dashboard nav link', () => {
    renderSidebar();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders Properties nav link', () => {
    renderSidebar();
    expect(screen.getByText('Properties')).toBeInTheDocument();
  });

  it('renders Compliance nav link', () => {
    renderSidebar();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
  });

  it('renders user email in footer', () => {
    renderSidebar();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders Sign out button', () => {
    renderSidebar();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('renders user initial avatar', () => {
    renderSidebar();
    expect(screen.getByText('T')).toBeInTheDocument(); // First char of test@example.com
  });

  it('renders organization switcher', () => {
    renderSidebar();
    expect(screen.getByTestId('org-switcher')).toBeInTheDocument();
  });

  it('renders theme toggle', () => {
    renderSidebar();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });
});
