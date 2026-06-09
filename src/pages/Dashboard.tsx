import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, FileText, Home, Users, RefreshCw, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { KpiCardSkeleton, PageSkeleton } from '@/components/common';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BankPresentationDialog } from '@/components/reports/BankPresentationDialog';
import { ActivationChecklist } from '@/components/dashboard/ActivationChecklist';
import { ActivationWidget } from '@/components/ActivationWidget';
import { WelcomeOverlay } from '@/components/onboarding/WelcomeOverlay';
import { RentersRightsBillKPI } from '@/components/RentersRightsBillKPI';
import { DemoBanner } from '@/components/dashboard/DemoBanner';
import { LifecycleFilterToggle } from '@/components/dashboard/LifecycleFilterToggle';
import { MetricDetailsSheet } from '@/components/dashboard/MetricDetailsSheet';
import { DashboardShareholdersTab } from '@/components/dashboard/DashboardShareholdersTab';
import { computeLenderData } from '@/components/dashboard/LenderExposureChart';

// Zone components
import { TodayStrip } from '@/components/dashboard/TodayStrip';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { PortfolioViewModeToggle } from '@/components/dashboard/PortfolioViewModeToggle';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { PortfolioPulse } from '@/components/dashboard/PortfolioPulse';
import { CollapsibleSection } from '@/components/dashboard/CollapsibleSection';
import { RefinancingBanner } from '@/components/dashboard/RefinancingBanner';

// Hooks
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { usePortfolioKPIs } from '@/hooks/usePortfolioKPIs';
import { useDashboardTenanciesV2, useDashboardRoomsV2, useDashboardPropertiesV2 } from '@/hooks/useDashboardDataV2';
import { useLifecycleFilter } from '@/contexts/LifecycleFilterContext';
import { useRentSchedule } from '@/hooks/useRentCollection';
import { usePropertyPassports } from '@/hooks/usePropertyPassport';
import { useMissingInfo } from '@/hooks/useMissingInfo';
import { usePortfolioRisks } from '@/hooks/usePortfolioRisks';
import { usePortfolioMonthlySummary } from '@/hooks/useFinancialSnapshots';
import { useVoidRate } from '@/hooks/useVoidPeriods';
import { useLoanAlerts } from '@/hooks/useLoanFacilities';
import { useUpcomingComplianceEvents } from '@/hooks/useCalendarEvents';
import { LeaseholdAlertWidget } from '@/components/dashboard/LeaseholdAlertWidget';

import { formatGBP, formatPercent } from '@/lib/calculations';
import { MetricKey, MetricBreakdown, METRICS_CONFIG } from '@/lib/metricsConfig';
import { SEO } from '@/components/SEO';
import { cn } from '@/lib/utils';

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { lifecycleFilter, filterProperties: _filterProperties } = useLifecycleFilter();

  // Time-based greeting
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      toast.success('Dashboard refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);


  // ── Data hooks ──────────────────────────────────────────
  const { data: propertiesV2, isLoading: propsLoading } = usePropertiesV2();
  const { data: portfolioKPIs, isLoading: kpisLoading } = usePortfolioKPIs();
  const { data: v1Properties } = useDashboardPropertiesV2();
  const isLoading = propsLoading || kpisLoading;

  const { data: _passports } = usePropertyPassports();
  const { stats: missingStats } = useMissingInfo();
  const { risks: portfolioRisks, criticalCount: portfolioCriticalCount } = usePortfolioRisks();
  const { data: portfolioMonthlySummary } = usePortfolioMonthlySummary(12);
  const { data: allTenancies } = useDashboardTenanciesV2();
  const { data: allRooms } = useDashboardRoomsV2();
  const currentDashMonth = format(new Date(), 'yyyy-MM');
  const { data: rentScheduleData } = useRentSchedule({ month: currentDashMonth });
  const rentSchedule = rentScheduleData?.items;
  const { data: voidRateData } = useVoidRate();
  const { data: loanAlerts } = useLoanAlerts();
  const { events: complianceEvents } = useUpcomingComplianceEvents(60);

  // ── Derived data ────────────────────────────────────────
  const filteredProperties = useMemo(() => {
    if (!propertiesV2) return [];
    if (lifecycleFilter === 'all') return propertiesV2;
    const stageMap: Record<string, string> = {
      stabilised: 'core_rental', letting: 'core_rental',
      pipeline: 'development', acquisition: 'development',
      refurbishment: 'development', disposal: 'development',
    };
    return propertiesV2.filter(p => stageMap[p.lifecycle_stage] === lifecycleFilter || lifecycleFilter === p.lifecycle_stage);
  }, [propertiesV2, lifecycleFilter]);

  const coreRentalProperties = useMemo(() => {
    if (!propertiesV2) return [];
    return propertiesV2.filter(p => ['stabilised', 'letting'].includes(p.lifecycle_stage));
  }, [propertiesV2]);

  const v1CoreRentalProperties = useMemo(() => {
    if (!v1Properties) return [];
    return v1Properties.filter(p => (p.lifecycle_type ?? 'development') === 'core_rental');
  }, [v1Properties]);

  const rentalStats = useMemo(() => {
    const activeTenancies = allTenancies?.filter(t => t.status === 'active') || [];
    const totalMonthlyRent = activeTenancies.reduce((sum, t) => sum + (t.rent_amount_pcm || 0), 0);

    const propertyBedsMap = new Map<string, number>();
    for (const p of coreRentalProperties) {
      if (p.total_lettable_rooms) propertyBedsMap.set(p.id, Number(p.total_lettable_rooms));
    }

    const rooms = allRooms || [];
    let totalRooms = 0, occupiedRooms = 0;
    for (const r of rooms) {
      const isWholeProperty = r.room_name?.toLowerCase() === 'whole property';
      const weight = isWholeProperty && r.property_id && propertyBedsMap.has(r.property_id)
        ? propertyBedsMap.get(r.property_id)! : 1;
      totalRooms += weight;
      if (r.status === 'occupied') occupiedRooms += weight;
    }
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // WAULT
    const now = new Date();
    let waultNumerator = 0, waultDenominator = 0;
    for (const t of activeTenancies) {
      const endDate = t.end_date ? new Date(t.end_date) : null;
      const rent = t.rent_amount_pcm || 0;
      if (endDate && endDate > now && rent > 0) {
        const remainingMonths = Math.max(0, (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        waultNumerator += remainingMonths * rent;
        waultDenominator += rent;
      }
    }

    return {
      activeTenancies: activeTenancies.length,
      totalMonthlyRent,
      totalRooms,
      occupiedRooms,
      occupancyRate,
      waultMonths: waultDenominator > 0 ? waultNumerator / waultDenominator : null,
    };
  }, [allTenancies, allRooms, coreRentalProperties]);

  const lenderData = useMemo(() => computeLenderData(v1CoreRentalProperties), [v1CoreRentalProperties]);

  const snapshotKPIs = useMemo(() => {
    const latestMonth = portfolioMonthlySummary?.[0];
    return {
      monthlyCashPosition: latestMonth?.total_cash_flow ?? null,
      latestMonthLabel: latestMonth?.snapshot_month
        ? format(new Date(latestMonth.snapshot_month), 'MMM yyyy') : null,
    };
  }, [portfolioMonthlySummary]);

  const mapProperties = useMemo(() => {
    return filteredProperties
      .filter(p => p.latitude && p.longitude)
      .map(p => ({
        id: p.id,
        address_line: p.address_line_1,
        postcode: p.postcode,
        latitude: p.latitude,
        longitude: p.longitude,
        lifecycle_type: ['stabilised', 'letting'].includes(p.lifecycle_stage) ? 'core_rental' : 'development',
        town_city: p.city,
      }));
  }, [filteredProperties]);

  // ── Metric details sheet ────────────────────────────────
  const handleMetricClick = useCallback((metricKey: MetricKey) => {
    setSelectedMetric(metricKey);
  }, []);

  const selectedBreakdown = useMemo<MetricBreakdown | null>(() => {
    if (!selectedMetric || !v1Properties) return null;
    // Single source of truth — reuse formulas from calculations.ts via METRICS_CONFIG.
    const cfg = METRICS_CONFIG[selectedMetric];
    if (!cfg) return null;
    return cfg.getBreakdown(v1CoreRentalProperties, _passports || []);
  }, [selectedMetric, v1Properties, v1CoreRentalProperties, _passports]);

  // ── Loading state ───────────────────────────────────────
  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageSkeleton />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <KpiCardSkeleton key={i} />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <AppLayout>
      <SEO title="Dashboard — TenureIQ" description="See your portfolio at a glance — KPIs, alerts, and what needs attention today." />
      <div className="space-y-6">
        <WelcomeOverlay />
        <DemoBanner />
        <ActivationWidget />
        <ActivationChecklist />
        <RefinancingBanner />


        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}
              <span className="text-muted-foreground font-normal"> · Dashboard</span>
            </h1>
            <p className="text-muted-foreground">
              {filteredProperties?.length || 0} properties
              {propertiesV2 && filteredProperties.length < propertiesV2.length ? ` (${propertiesV2.length} total)` : ''}
              <span className="ml-2 text-xs">· {format(new Date(), 'EEE d MMM yyyy')}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh dashboard data"
              title="Refresh dashboard data"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
            <BankPresentationDialog
              trigger={
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Bank Pack
                </Button>
              }
            />
            <LifecycleFilterToggle />
          </div>
        </div>

        {/* Empty state */}
        {filteredProperties.length === 0 && propertiesV2 !== undefined && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome to Tenure IQ</h2>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add your first property — or bulk-import an existing portfolio — to unlock your live dashboard, compliance register, and lender packs.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button asChild>
                <Link to="/wizards/add-property">Add your first property</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/import" className="gap-2">
                  <Upload className="h-4 w-4" /> Import portfolio
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Top-level tabs: Overview vs Shareholders */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full max-w-md grid grid-cols-2 overflow-x-auto flex-nowrap print:hidden">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="shareholders">
              <Users className="h-4 w-4 mr-2" />
              Shareholders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Zone 0 — Portfolio Pulse (intelligent briefing) */}
            <CollapsibleSection id="pulse" title="Today's briefing" defaultOpen>
              <PortfolioPulse
                risks={portfolioRisks}
                criticalCount={portfolioCriticalCount}
                loanAlerts={loanAlerts}
                rentSchedule={rentSchedule}
                complianceEvents={complianceEvents}
                propertiesCount={filteredProperties.length}
              />
            </CollapsibleSection>

            {/* Zone 1 — Today Strip */}
            <CollapsibleSection id="today-strip" title="At-a-glance" defaultOpen>
              <TodayStrip
                risks={portfolioRisks}
                criticalCount={portfolioCriticalCount}
                loanAlerts={loanAlerts}
                rentSchedule={rentSchedule}
                complianceEvents={complianceEvents}
              />
            </CollapsibleSection>

            {/* Zone 2 — KPI Cards */}
            {portfolioKPIs && (
              <CollapsibleSection
                id="kpis"
                title="Key metrics"
                defaultOpen
                headerAction={<PortfolioViewModeToggle />}
              >
                <KpiCards
                  portfolioKPIs={portfolioKPIs}
                  risks={portfolioRisks}
                  criticalCount={portfolioCriticalCount}
                  rentalStats={rentalStats}
                  snapshotKPIs={snapshotKPIs}
                  voidRateData={voidRateData}
                  onMetricClick={handleMetricClick}
                />
              </CollapsibleSection>
            )}

            {/* RRB Readiness KPI */}
            <CollapsibleSection id="rrb" title="Renters' Rights Bill readiness" defaultOpen>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                <RentersRightsBillKPI />
              </div>
            </CollapsibleSection>

            {/* Missing Info Shortcut */}
            {missingStats.totalMissingFields > 0 && (
              <CollapsibleSection id="missing-info" title="Data quality" defaultOpen>
                <Card
                  className="bg-warning/5 border-warning/30 hover:bg-warning/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/missing-info')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/missing-info'); } }}
                  aria-label="View missing information"
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-warning/20">
                          <AlertCircle className="h-5 w-5 text-warning" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                            Missing Information
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-warning/20 text-warning">
                              {missingStats.totalMissingFields} field{missingStats.totalMissingFields === 1 ? '' : 's'}
                            </span>
                          </h3>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {missingStats.propertiesWithFinanceMissing > 0 && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border text-muted-foreground">
                                {missingStats.propertiesWithFinanceMissing} finance
                              </span>
                            )}
                            {missingStats.propertiesWithInsuranceMissing > 0 && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border text-muted-foreground">
                                {missingStats.propertiesWithInsuranceMissing} insurance
                              </span>
                            )}
                            {missingStats.propertiesWithPassportMissing > 0 && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border text-muted-foreground">
                                {missingStats.propertiesWithPassportMissing} passport
                              </span>
                            )}
                            {missingStats.propertiesWithCriticalPassportMissing > 0 && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-destructive/10 border border-destructive/30 text-destructive font-medium">
                                {missingStats.propertiesWithCriticalPassportMissing} critical
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleSection>
            )}

            {/* Leasehold Alerts */}
            <CollapsibleSection id="leasehold" title="Leasehold alerts" defaultOpen>
              <LeaseholdAlertWidget />
            </CollapsibleSection>

            {/* Zone 3 — Tabbed Detail */}
            <CollapsibleSection id="detail-tabs" title="Detail" defaultOpen>
              <DashboardTabs
                v1CoreRentalProperties={v1CoreRentalProperties}
                v1Properties={v1Properties}
                lenderData={lenderData}
                mapProperties={mapProperties}
                onHealthMetricClick={() => handleMetricClick('health')}
              />
            </CollapsibleSection>
          </TabsContent>

          <TabsContent value="shareholders">
            <DashboardShareholdersTab />
          </TabsContent>
        </Tabs>

        <MetricDetailsSheet
          open={selectedMetric !== null}
          onOpenChange={(open) => !open && setSelectedMetric(null)}
          breakdown={selectedBreakdown}
        />
      </div>
    </AppLayout>
  );
}

export default DashboardPage;
