import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock all hooks used by Dashboard
vi.mock('@/hooks/usePropertiesV2', () => ({
  usePropertiesV2: () => ({ data: undefined, isLoading: true }),
}));
vi.mock('@/hooks/usePortfolioKPIs', () => ({
  usePortfolioKPIs: () => ({ data: null, isLoading: true }),
}));
vi.mock('@/hooks/useDashboardDataV2', () => ({
  useDashboardTenanciesV2: () => ({ data: null }),
  useDashboardRoomsV2: () => ({ data: null }),
  useDashboardPropertiesV2: () => ({ data: null }),
}));
vi.mock('@/contexts/LifecycleFilterContext', () => ({
  useLifecycleFilter: () => ({ lifecycleFilter: 'all', filterProperties: (p: any) => p }),
}));
vi.mock('@/hooks/useRentCollection', () => ({
  useRentSchedule: () => ({ data: null }),
}));
vi.mock('@/hooks/usePropertyPassport', () => ({
  usePropertyPassports: () => ({ data: null }),
}));
vi.mock('@/hooks/useMissingInfo', () => ({
  useMissingInfo: () => ({ stats: { totalMissingFields: 0, propertiesWithFinanceMissing: 0, propertiesWithInsuranceMissing: 0, propertiesWithPassportMissing: 0 } }),
}));
vi.mock('@/hooks/usePortfolioRisks', () => ({
  usePortfolioRisks: () => ({ risks: [], criticalCount: 0, totalCount: 0 }),
}));
vi.mock('@/hooks/useFinancialSnapshots', () => ({
  usePortfolioMonthlySummary: () => ({ data: null }),
}));
vi.mock('@/hooks/useVoidPeriods', () => ({
  useVoidRate: () => ({ data: null }),
}));
vi.mock('@/hooks/useLoanFacilities', () => ({
  useLoanAlerts: () => ({ data: null }),
}));
vi.mock('@/hooks/useCalendarEvents', () => ({
  useUpcomingComplianceEvents: () => ({ events: [] }),
}));

// Mock layout and sub-components
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));
vi.mock('@/components/common', () => ({
  KpiCardSkeleton: () => <div data-testid="kpi-skeleton">Loading...</div>,
  PageSkeleton: () => <div data-testid="page-skeleton">Loading page...</div>,
}));
vi.mock('@/components/reports/BankPresentationDialog', () => ({
  BankPresentationDialog: () => null,
}));
vi.mock('@/components/dashboard/ActivationChecklist', () => ({
  ActivationChecklist: () => null,
}));
vi.mock('@/components/dashboard/DemoBanner', () => ({
  DemoBanner: () => null,
}));
vi.mock('@/components/dashboard/LifecycleFilterToggle', () => ({
  LifecycleFilterToggle: () => null,
}));
vi.mock('@/components/dashboard/MetricDetailsSheet', () => ({
  MetricDetailsSheet: () => null,
}));
vi.mock('@/components/dashboard/DashboardShareholdersTab', () => ({
  DashboardShareholdersTab: () => null,
}));
vi.mock('@/components/dashboard/LenderExposureChart', () => ({
  computeLenderData: () => [],
}));
vi.mock('@/components/dashboard/TodayStrip', () => ({
  TodayStrip: () => null,
}));
vi.mock('@/components/dashboard/KpiCards', () => ({
  KpiCards: () => null,
}));
vi.mock('@/components/dashboard/DashboardTabs', () => ({
  DashboardTabs: () => null,
}));

import DashboardPage from '../Dashboard';

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Dashboard page', () => {
  it('renders loading state with skeletons', () => {
    renderDashboard();
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  it('renders KPI skeletons during loading', () => {
    renderDashboard();
    const kpiSkeletons = screen.getAllByTestId('kpi-skeleton');
    expect(kpiSkeletons).toHaveLength(3);
  });
});
