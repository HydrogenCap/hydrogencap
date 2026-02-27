import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, TrendingUp, Percent, AlertTriangle, AlertCircle, ArrowRight, Users, Building2, MapPin, FileText, Wallet, DoorOpen } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { BankPresentationDialog } from '@/components/reports/BankPresentationDialog';
import { useDashboardPropertiesV2, useDashboardTenanciesV2, useDashboardRoomsV2 } from '@/hooks/useDashboardDataV2';
import { usePortfolioAttribution } from '@/hooks/useOwnershipAttribution';
import { useHydrogenKPIs } from '@/hooks/useHydrogenKPIs';
import { useLifecycleFilter } from '@/contexts/LifecycleFilterContext';
import { useRentSchedule } from '@/hooks/useRentCollection';
import { Progress } from '@/components/ui/progress';

import { PortfolioHealthWidget } from '@/components/dashboard/PortfolioHealthWidget';
import { AreaExposureChart } from '@/components/dashboard/AreaExposureChart';
import { BeneficialOwnerWidget } from '@/components/dashboard/BeneficialOwnerWidget';
import { DataQualityWidget } from '@/components/dashboard/DataQualityWidget';
import { MissingComplianceWidget } from '@/components/dashboard/MissingComplianceWidget';
import { LifecycleFilterToggle } from '@/components/dashboard/LifecycleFilterToggle';
import { MetricDetailsSheet } from '@/components/dashboard/MetricDetailsSheet';
import { ThisMonthWidget } from '@/components/dashboard/ThisMonthWidget';
import { PropertyMap } from '@/components/maps/PropertyMap';
import { UpcomingExpirationsWidget } from '@/components/dashboard/UpcomingExpirationsWidget';
import { DashboardCalendarWidget } from '@/components/dashboard/DashboardCalendarWidget';
import { StockConditionSection } from '@/components/dashboard/StockConditionSection';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { SectionCard } from '@/components/dashboard/SectionCard';
import { ActionsRequiredWidget } from '@/components/dashboard/ActionsRequiredWidget';
import { RentCollectionWidget } from '@/components/dashboard/RentCollectionWidget';
import { OccupancyWidget } from '@/components/dashboard/OccupancyWidget';
import { TenancyPipelineWidget } from '@/components/dashboard/TenancyPipelineWidget';
import { RecentActivityWidget } from '@/components/dashboard/RecentActivityWidget';
import { DashboardShareholdersTab, prepareShareholderData } from '@/components/dashboard/DashboardShareholdersTab';
import { LenderExposureChart, computeLenderData } from '@/components/dashboard/LenderExposureChart';
import {
  formatGBP,
  formatPercent,
  getEffectiveCosts,
  calculateMonthlyCashflowAfterDebt,
  calculateMonthlyMortgagePayment,
} from '@/lib/calculations';
import { calculatePortfolioRentPerBedroom } from '@/lib/mortgageCalculations';
import { MetricKey, METRICS_CONFIG, MetricBreakdown } from '@/lib/metricsConfig';

import { usePropertyPassports, type PropertyPassport } from '@/hooks/usePropertyPassport';
import { useMissingInfo } from '@/hooks/useMissingInfo';
import { usePortfolioRisks } from '@/hooks/usePortfolioRisks';
import { usePortfolioMonthlySummary, usePropertyAnnualPerformance } from '@/hooks/useFinancialSnapshots';

function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [cashflowPeriod, setCashflowPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [kpiView, setKpiView] = useState<'gross' | 'hydrogen'>('gross');
  const { data: properties, isLoading, isError, error } = useDashboardPropertiesV2();
  const { data: passports } = usePropertyPassports();
  const { stats: missingStats } = useMissingInfo();
  const { lifecycleFilter, filterProperties } = useLifecycleFilter();
  const { risks: portfolioRisks, criticalCount: portfolioCriticalCount } = usePortfolioRisks();

  // Financial snapshot data for dashboard KPIs
  const { data: portfolioMonthlySummary } = usePortfolioMonthlySummary(12);
  const { data: annualPerformance } = usePropertyAnnualPerformance();

  // V2 tenancy and room data for dashboard stats
  const { data: allTenancies } = useDashboardTenanciesV2();
  const { data: allRooms } = useDashboardRoomsV2();
  const currentDashMonth = format(new Date(), 'yyyy-MM');
  const { data: rentSchedule } = useRentSchedule({ month: currentDashMonth });

  // Filter properties based on lifecycle selection
  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    return filterProperties(properties);
  }, [properties, filterProperties]);

  // Core rental properties only (for KPIs that should exclude development)
  const coreRentalProperties = useMemo(() => {
    if (!properties) return [];
    return properties.filter(p => (p.lifecycle_type ?? 'development') === 'core_rental');
  }, [properties]);

  const { data: attribution, isLoading: isAttributionLoading } = usePortfolioAttribution(coreRentalProperties);
  const hydrogenKPIs = useHydrogenKPIs(attribution);

  // Calculate portfolio totals - ONLY from core rental properties for income KPIs
  const portfolioStats = useMemo(() => {
    const kpiProperties = coreRentalProperties;
    if (!kpiProperties?.length) {
      return {
        totalValue: 0,
        totalMortgage: 0,
        totalEquity: 0,
        averageLTV: 0,
        monthlyCashflow: 0,
        rentPerBedroom: null as number | null,
      };
    }

    const currentYear = new Date().getFullYear();
    let totalValue = 0;
    let totalMortgage = 0;
    let totalMonthlyCashflowAfterDebt = 0;

    kpiProperties.forEach(property => {
      const loan = property.loans?.[0];
      const income = property.income?.find(i => i.year === currentYear);
      const costs = property.costs?.find(c => c.year === currentYear);

      const value = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
      const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
      const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
      const effectiveCosts = getEffectiveCosts(rent, value, costs);
      const totalCosts = effectiveCosts.total;

      const storedPayment = loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null;
      const paymentOverride = loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : storedPayment;
      const mortgagePaymentResult = calculateMonthlyMortgagePayment({
        balance: mortgage || null,
        interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
        termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
        isInterestOnly: loan?.capital_or_interest === 'interest',
        paymentOverride,
      });

      totalValue += value;
      totalMortgage += mortgage;
      const monthlyCashflow = calculateMonthlyCashflowAfterDebt(rent, totalCosts, mortgagePaymentResult.effective);
      totalMonthlyCashflowAfterDebt += monthlyCashflow || 0;
    });

    const totalEquity = totalValue - totalMortgage;
    const averageLTV = totalValue > 0 ? (totalMortgage / totalValue) * 100 : 0;

    const rentPerBedroomData = kpiProperties.map(p => {
      const inc = p.income?.find(i => i.year === currentYear);
      return {
        annualRent: inc?.annual_rent_gbp ? Number(inc.annual_rent_gbp) : null,
        bedrooms: p.beds ? Number(p.beds) : null,
      };
    });
    const rentPerBedroom = calculatePortfolioRentPerBedroom(rentPerBedroomData);

    return { totalValue, totalMortgage, totalEquity, averageLTV, monthlyCashflow: totalMonthlyCashflowAfterDebt, rentPerBedroom: rentPerBedroom.monthly };
  }, [coreRentalProperties]);

  // Rental & occupancy stats
  const rentalStats = useMemo(() => {
    const activeTenancies = allTenancies?.filter(t => t.status === 'active') || [];
    const noticeTenancies = allTenancies?.filter(t => t.status === 'notice') || [];

    const totalMonthlyRent = activeTenancies.reduce((sum, t) => sum + (t.rent_amount_pcm || 0), 0);

    // Build a map of property_id -> beds for whole-property rooms
    const propertyBedsMap = new Map<string, number>();
    for (const p of coreRentalProperties) {
      if (p.beds) propertyBedsMap.set(p.id, Number(p.beds));
    }

    const rooms = allRooms || [];
    // For "Whole Property" rooms, count the property's bedroom count instead of 1
    let totalRooms = 0;
    let occupiedRooms = 0;
    let vacantRooms = 0;
    for (const r of rooms) {
      const isWholeProperty = r.room_name?.toLowerCase() === 'whole property';
      const weight = isWholeProperty && r.property_id && propertyBedsMap.has(r.property_id)
        ? propertyBedsMap.get(r.property_id)!
        : 1;
      totalRooms += weight;
      if (r.status === 'occupied') occupiedRooms += weight;
      if (r.status === 'vacant') vacantRooms += weight;
    }
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    const totalBedrooms = coreRentalProperties.reduce((sum, p) => sum + (p.beds ? Number(p.beds) : 0), 0);

    const schedule = rentSchedule || [];
    const totalDue = schedule.reduce((sum, r) => sum + (r.rent_amount || 0), 0);
    const totalCollected = schedule.reduce((sum, r) => sum + (r.amount_paid || 0), 0);
    const totalOverdue = schedule.filter(r => r.status === 'overdue').reduce((sum, r) => sum + (r.amount_outstanding || 0), 0);

    return {
      activeTenancies: activeTenancies.length,
      noticeTenancies: noticeTenancies.length,
      totalMonthlyRent,
      totalRooms,
      occupiedRooms,
      vacantRooms,
      occupancyRate,
      totalBedrooms,
      totalDue,
      totalCollected,
      totalOverdue,
    };
  }, [allTenancies, allRooms, rentSchedule, coreRentalProperties]);

  // Lender exposure data
  const lenderData = useMemo(() => computeLenderData(coreRentalProperties), [coreRentalProperties]);

  // Financial snapshot KPIs
  const snapshotKPIs = useMemo(() => {
    const latestMonth = portfolioMonthlySummary?.[0];
    const monthlyCashPosition = latestMonth?.total_cash_flow ?? null;
    const latestMonthLabel = latestMonth?.snapshot_month
      ? format(new Date(latestMonth.snapshot_month), 'MMM yyyy')
      : null;

    // Net Yield = trailing 12m NOI / sum of current valuations × 100
    const totalAnnualNOI = annualPerformance?.reduce((sum, p) => sum + (p.annual_noi || 0), 0) ?? 0;
    const totalValuation = coreRentalProperties.reduce((sum, p) => sum + (p.current_value_gbp ? Number(p.current_value_gbp) : 0), 0);
    const netYield = totalValuation > 0 ? (totalAnnualNOI / totalValuation) * 100 : null;

    return { monthlyCashPosition, latestMonthLabel, netYield };
  }, [portfolioMonthlySummary, annualPerformance, coreRentalProperties]);

  // Shareholder data
  const shareholderData = useMemo(() => prepareShareholderData(attribution), [attribution]);

  // Map check
  const hasPropertiesWithCoords = useMemo(() => {
    if (!filteredProperties?.length) return false;
    return filteredProperties.some(p => p.latitude && p.longitude);
  }, [filteredProperties]);

  // Handle metric card click
  const handleMetricClick = useCallback((metricKey: MetricKey) => {
    setSelectedMetric(metricKey);
  }, []);

  // Get breakdown for selected metric
  const selectedBreakdown = useMemo<MetricBreakdown | null>(() => {
    if (!selectedMetric || !coreRentalProperties) return null;
    const config = METRICS_CONFIG[selectedMetric];
    return config.getBreakdown(coreRentalProperties, passports || []);
  }, [selectedMetric, coreRentalProperties, passports]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
          <p className="text-muted-foreground mb-4">{error?.message}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              {filteredProperties?.length || 0} {lifecycleFilter === 'all' ? '' : lifecycleFilter === 'core_rental' ? 'core rental ' : 'development '}
              properties{lifecycleFilter !== 'all' && properties && properties.length > filteredProperties.length ? ` (${properties.length} total)` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
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

        {/* Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="shareholders">
              <Users className="h-4 w-4 mr-2" />
              Shareholders
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Gross / Hydrogen Toggle */}
            {hydrogenKPIs.isAvailable && (
              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted w-fit">
                <button
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    kpiView === 'gross' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setKpiView('gross')}
                >
                  Gross Portfolio
                </button>
                <button
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    kpiView === 'hydrogen' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setKpiView('hydrogen')}
                >
                  Hydrogen Attributable
                </button>
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label={kpiView === 'hydrogen' ? 'Hydrogen Equity' : 'Attributable Equity'}
                value={formatGBP(kpiView === 'hydrogen' ? hydrogenKPIs.totalEquity : portfolioStats.totalEquity)}
                subtitle={`Value: ${formatGBP(kpiView === 'hydrogen' ? hydrogenKPIs.totalValue : portfolioStats.totalValue)}`}
                icon={TrendingUp}
                iconClassName="text-primary"
                valueClassName="text-primary"
                onClick={() => handleMetricClick('equity')}
              />
              <KpiCard
                label={cashflowPeriod === 'monthly' ? 'Monthly Cashflow' : 'Annual Cashflow'}
                value={formatGBP(
                  kpiView === 'hydrogen'
                    ? (cashflowPeriod === 'monthly' ? hydrogenKPIs.monthlyCashflow : hydrogenKPIs.totalCashflow)
                    : (cashflowPeriod === 'monthly' ? portfolioStats.monthlyCashflow : portfolioStats.monthlyCashflow * 12)
                )}
                subtitle={kpiView === 'hydrogen' ? `${hydrogenKPIs.propertyCount} properties` : 'After debt service'}
                icon={PoundSterling}
                iconClassName="text-success"
                valueClassName={(kpiView === 'hydrogen' ? hydrogenKPIs.monthlyCashflow : portfolioStats.monthlyCashflow) >= 0 ? 'text-success' : 'text-destructive'}
                onClick={() => handleMetricClick('cashflow')}
                headerAction={
                  <button
                    className="text-xs px-2 py-1 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground transition-colors font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCashflowPeriod(cashflowPeriod === 'monthly' ? 'annual' : 'monthly');
                    }}
                    aria-label={`Switch to ${cashflowPeriod === 'monthly' ? 'annual' : 'monthly'} view`}
                  >
                    {cashflowPeriod === 'monthly' ? '/mo' : '/yr'}
                  </button>
                }
              />
              <KpiCard
                label="Average LTV"
                value={formatPercent(kpiView === 'hydrogen' ? hydrogenKPIs.averageLTV : portfolioStats.averageLTV)}
                subtitle={`Debt: ${formatGBP(kpiView === 'hydrogen' ? hydrogenKPIs.totalDebt : portfolioStats.totalMortgage)}`}
                icon={Percent}
                valueClassName={
                  (kpiView === 'hydrogen' ? hydrogenKPIs.averageLTV : portfolioStats.averageLTV) > 85 ? 'text-destructive' :
                  (kpiView === 'hydrogen' ? hydrogenKPIs.averageLTV : portfolioStats.averageLTV) > 75 ? 'text-warning' : ''
                }
                onClick={() => handleMetricClick('ltv')}
              />
              <KpiCard
                label="Action Required"
                value={portfolioRisks.length === 0 ? '✓' : String(portfolioRisks.length)}
                subtitle={portfolioRisks.length === 0 ? 'All clear' : `${portfolioCriticalCount} critical`}
                icon={AlertTriangle}
                iconClassName={portfolioRisks.length > 0 ? 'text-warning' : 'text-success'}
                valueClassName={portfolioRisks.length > 0 ? 'text-warning' : 'text-success'}
                onClick={() => navigate('/actions')}
                className={portfolioRisks.length > 0 ? 'border-warning/40' : 'border-success/40'}
              />
            </div>

            {/* Rental KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Monthly Rent Roll"
                value={formatGBP(rentalStats.totalMonthlyRent)}
                subtitle={`${rentalStats.activeTenancies} active tenancies`}
                icon={Wallet}
                iconClassName="text-primary"
                valueClassName="text-primary"
              />
              <KpiCard
                label="Occupancy Rate"
                value={formatPercent(rentalStats.occupancyRate)}
                subtitle={`${rentalStats.occupiedRooms} of ${rentalStats.totalRooms} bedrooms let`}
                icon={DoorOpen}
                iconClassName={rentalStats.occupancyRate >= 90 ? 'text-success' : rentalStats.occupancyRate >= 75 ? 'text-warning' : 'text-destructive'}
                valueClassName={rentalStats.occupancyRate >= 90 ? 'text-success' : rentalStats.occupancyRate >= 75 ? 'text-warning' : 'text-destructive'}
              />
              <KpiCard
                label="Portfolio Net Yield"
                value={snapshotKPIs.netYield !== null ? formatPercent(snapshotKPIs.netYield) : '—'}
                subtitle={snapshotKPIs.netYield !== null ? 'Trailing 12m NOI / valuation' : 'No snapshot data yet'}
                icon={TrendingUp}
                iconClassName="text-primary"
                valueClassName={snapshotKPIs.netYield !== null && snapshotKPIs.netYield >= 6 ? 'text-success' : snapshotKPIs.netYield !== null && snapshotKPIs.netYield < 4 ? 'text-warning' : ''}
                onClick={() => navigate('/financials')}
              />
              <KpiCard
                label="Monthly Cash Position"
                value={snapshotKPIs.monthlyCashPosition !== null ? formatGBP(snapshotKPIs.monthlyCashPosition) : '—'}
                subtitle={snapshotKPIs.latestMonthLabel ? `As of ${snapshotKPIs.latestMonthLabel}` : 'No snapshot data yet'}
                icon={PoundSterling}
                iconClassName={snapshotKPIs.monthlyCashPosition !== null && snapshotKPIs.monthlyCashPosition >= 0 ? 'text-success' : 'text-destructive'}
                valueClassName={snapshotKPIs.monthlyCashPosition !== null && snapshotKPIs.monthlyCashPosition >= 0 ? 'text-success' : 'text-destructive'}
                onClick={() => navigate('/financials')}
              />
            </div>

            {/* Missing Info Shortcut */}
            {missingStats.totalMissingFields > 0 && (
              <Card
                className="bg-warning/5 border-warning/30 hover:bg-warning/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                role="button"
                tabIndex={0}
                onClick={() => navigate('/missing-info')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate('/missing-info');
                  }
                }}
                aria-label="View missing information"
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-warning/20">
                        <AlertCircle className="h-5 w-5 text-warning" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Missing Information</h3>
                        <p className="text-sm text-muted-foreground">
                          {missingStats.propertiesWithFinanceMissing > 0 && (
                            <span>{missingStats.propertiesWithFinanceMissing} finance • </span>
                          )}
                          {missingStats.propertiesWithInsuranceMissing > 0 && (
                            <span>{missingStats.propertiesWithInsuranceMissing} insurance • </span>
                          )}
                          {missingStats.propertiesWithPassportMissing > 0 && (
                            <span>{missingStats.propertiesWithPassportMissing} passport • </span>
                          )}
                          <span className="font-medium text-warning">{missingStats.totalMissingFields} fields total</span>
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sub-tabs: Today / Health / Portfolio */}
            <Tabs defaultValue="today" className="w-full">
              <TabsList className="grid w-full max-w-lg grid-cols-3">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="health">Health</TabsTrigger>
                <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              </TabsList>

              {/* TODAY TAB */}
              <TabsContent value="today" className="space-y-6 mt-4">
                {/* Property Map — promoted to top */}
                <SectionCard
                  title="Property Map"
                  subtitle={`${filteredProperties?.filter(p => p.latitude && p.longitude).length || 0} properties plotted`}
                  icon={MapPin}
                  onClick={() => navigate('/dashboard/map')}
                  showArrow
                  noPadding
                  contentClassName="p-0"
                >
                  {hasPropertiesWithCoords ? (
                    <div className="p-4">
                      <PropertyMap
                        properties={filteredProperties || []}
                        className="h-[350px] rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Add properties with coordinates to see them on the map</p>
                      </div>
                    </div>
                  )}
                </SectionCard>

                {/* Widgets Row: This Month + Actions Required + Calendar */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <ErrorBoundary>
                    <ThisMonthWidget />
                  </ErrorBoundary>
                  <ErrorBoundary>
                    <ActionsRequiredWidget />
                  </ErrorBoundary>
                  <ErrorBoundary>
                    <DashboardCalendarWidget />
                  </ErrorBoundary>
                </div>

                {/* Widgets Row: Rent Collection + Occupancy + Tenancy Pipeline */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <ErrorBoundary>
                    <RentCollectionWidget />
                  </ErrorBoundary>
                  <ErrorBoundary>
                    <OccupancyWidget />
                  </ErrorBoundary>
                  <ErrorBoundary>
                    <TenancyPipelineWidget />
                  </ErrorBoundary>
                </div>

                {/* Recent Activity Feed */}
                <ErrorBoundary>
                  <RecentActivityWidget />
                </ErrorBoundary>
              </TabsContent>

              {/* HEALTH TAB */}
              <TabsContent value="health" className="space-y-6 mt-4">
                {coreRentalProperties.length > 0 && (
                  <ErrorBoundary>
                    <PortfolioHealthWidget
                      properties={coreRentalProperties}
                      onClick={() => handleMetricClick('health')}
                    />
                  </ErrorBoundary>
                )}
                <ErrorBoundary>
                  <MissingComplianceWidget />
                </ErrorBoundary>
                <ErrorBoundary>
                  <DashboardCalendarWidget />
                </ErrorBoundary>
                <ErrorBoundary>
                  {filteredProperties.length > 0 && (
                    <DataQualityWidget properties={filteredProperties} />
                  )}
                </ErrorBoundary>
                <ErrorBoundary>
                  <StockConditionSection />
                </ErrorBoundary>
              </TabsContent>

              {/* PORTFOLIO TAB */}
              <TabsContent value="portfolio" className="space-y-6 mt-4">
                <SectionCard
                  title="Property Map"
                  icon={MapPin}
                  onClick={() => navigate('/dashboard/map')}
                  showArrow
                  noPadding
                  contentClassName="p-0"
                >
                  {hasPropertiesWithCoords ? (
                    <div className="p-4">
                      <PropertyMap
                        properties={filteredProperties || []}
                        className="h-[400px] rounded-lg pointer-events-none"
                      />
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Add properties with coordinates to see them on the map</p>
                      </div>
                    </div>
                  )}
                </SectionCard>

                <div className="grid gap-6 md:grid-cols-2">
                  <LenderExposureChart lenderData={lenderData} />
                  <ErrorBoundary>
                    {filteredProperties && <AreaExposureChart properties={filteredProperties} />}
                  </ErrorBoundary>
                </div>

                <ErrorBoundary>
                  {coreRentalProperties.length > 0 && (
                    <BeneficialOwnerWidget properties={coreRentalProperties} />
                  )}
                </ErrorBoundary>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Shareholders Tab */}
          <TabsContent value="shareholders">
            <DashboardShareholdersTab
              shareholderData={shareholderData}
              isLoading={isAttributionLoading}
            />
          </TabsContent>
        </Tabs>

        {/* Metric Details Sheet */}
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
