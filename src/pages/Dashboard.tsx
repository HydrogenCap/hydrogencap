import React, { useMemo, useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, TrendingUp, Percent, AlertTriangle, AlertCircle, ArrowRight, Users, Building2, MapPin, FileText, Wallet, DoorOpen, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { BankPresentationDialog } from '@/components/reports/BankPresentationDialog';
import { ActivationChecklist } from '@/components/dashboard/ActivationChecklist';

// V2 data sources
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { usePortfolioKPIs } from '@/hooks/usePortfolioKPIs';
import { useDashboardTenanciesV2, useDashboardRoomsV2 } from '@/hooks/useDashboardDataV2';
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
const PropertyMap = lazy(() => import('@/components/maps/PropertyMap').then(m => ({ default: m.PropertyMap })));
import { UpcomingExpirationsWidget } from '@/components/dashboard/UpcomingExpirationsWidget';
import { DashboardCalendarWidget } from '@/components/dashboard/DashboardCalendarWidget';
import { StockConditionSection } from '@/components/dashboard/StockConditionSection';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { DualKpiCard } from '@/components/dashboard/DualKpiCard';
import { SectionCard } from '@/components/dashboard/SectionCard';
import { ActionsRequiredWidget } from '@/components/dashboard/ActionsRequiredWidget';
import { ComplianceTasksWidget } from '@/components/dashboard/ComplianceTasksWidget';
import { RentCollectionWidget } from '@/components/dashboard/RentCollectionWidget';
import { OccupancyWidget } from '@/components/dashboard/OccupancyWidget';
import { TenancyPipelineWidget } from '@/components/dashboard/TenancyPipelineWidget';
import { VoidCostWidget } from '@/components/dashboard/VoidCostWidget';
import { RecentActivityWidget } from '@/components/dashboard/RecentActivityWidget';
import { MaintenanceWidget } from '@/components/dashboard/MaintenanceWidget';
import { WorkOrdersWidget } from '@/components/dashboard/WorkOrdersWidget';
import { TenancyEventsWidget } from '@/components/dashboard/TenancyEventsWidget';
import { CHFilingAlertsWidget } from '@/components/dashboard/CHFilingAlertsWidget';
import { DashboardShareholdersTab } from '@/components/dashboard/DashboardShareholdersTab';
import { LenderExposureChart, computeLenderData } from '@/components/dashboard/LenderExposureChart';
import { formatGBP, formatPercent } from '@/lib/calculations';
import { MetricKey, MetricBreakdown } from '@/lib/metricsConfig';

import { usePropertyPassports } from '@/hooks/usePropertyPassport';
import { useMissingInfo } from '@/hooks/useMissingInfo';
import { usePortfolioRisks } from '@/hooks/usePortfolioRisks';
import { usePortfolioMonthlySummary } from '@/hooks/useFinancialSnapshots';

// V1 bridge — still needed for widgets that haven't migrated yet
import { useDashboardPropertiesV2 } from '@/hooks/useDashboardDataV2';

function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [cashflowPeriod, setCashflowPeriod] = useState<'monthly' | 'annual'>('monthly');
  const { lifecycleFilter, filterProperties } = useLifecycleFilter();

  // V2 data sources
  const { data: propertiesV2, isLoading: propsLoading } = usePropertiesV2();
  const { data: portfolioKPIs, isLoading: kpisLoading } = usePortfolioKPIs();

  // V1 bridge data — still needed for PortfolioHealthWidget, DataQualityWidget, LenderExposureChart
  const { data: v1Properties } = useDashboardPropertiesV2();

  const isLoading = propsLoading || kpisLoading;
  const { data: passports } = usePropertyPassports();
  const { stats: missingStats } = useMissingInfo();
  const { risks: portfolioRisks, criticalCount: portfolioCriticalCount } = usePortfolioRisks();

  // Financial snapshot data for rental KPI row (Track C - unchanged)
  const { data: portfolioMonthlySummary } = usePortfolioMonthlySummary(12);

  // V2 tenancy and room data
  const { data: allTenancies } = useDashboardTenanciesV2();
  const { data: allRooms } = useDashboardRoomsV2();
  const currentDashMonth = format(new Date(), 'yyyy-MM');
  const { data: rentScheduleData } = useRentSchedule({ month: currentDashMonth });
  const rentSchedule = rentScheduleData?.items;

  // Filter properties using V2 data
  const filteredProperties = useMemo(() => {
    if (!propertiesV2) return [];
    if (lifecycleFilter === 'all') return propertiesV2;
    // Map V2 lifecycle_stage to V1 lifecycle_type for filter compatibility
    const stageMap: Record<string, string> = {
      stabilised: 'core_rental',
      letting: 'core_rental',
      pipeline: 'development',
      acquisition: 'development',
      refurbishment: 'development',
      disposal: 'development',
    };
    return propertiesV2.filter(p => stageMap[p.lifecycle_stage] === lifecycleFilter || lifecycleFilter === p.lifecycle_stage);
  }, [propertiesV2, lifecycleFilter]);

  const coreRentalProperties = useMemo(() => {
    if (!propertiesV2) return [];
    return propertiesV2.filter(p => ['stabilised', 'letting'].includes(p.lifecycle_stage));
  }, [propertiesV2]);

  // V1 bridge properties for widgets that still need V1 shape
  const v1CoreRentalProperties = useMemo(() => {
    if (!v1Properties) return [];
    return v1Properties.filter(p => (p.lifecycle_type ?? 'development') === 'core_rental');
  }, [v1Properties]);

  // Rental & occupancy stats (Track C — leave unchanged)
  const rentalStats = useMemo(() => {
    const activeTenancies = allTenancies?.filter(t => t.status === 'active') || [];
    const noticeTenancies = allTenancies?.filter(t => t.status === 'notice') || [];
    const totalMonthlyRent = activeTenancies.reduce((sum, t) => sum + (t.rent_amount_pcm || 0), 0);

    const propertyBedsMap = new Map<string, number>();
    for (const p of coreRentalProperties) {
      if (p.total_lettable_rooms) propertyBedsMap.set(p.id, Number(p.total_lettable_rooms));
    }

    const rooms = allRooms || [];
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
      totalDue,
      totalCollected,
      totalOverdue,
    };
  }, [allTenancies, allRooms, rentSchedule, coreRentalProperties]);

  // Lender exposure data — TODO: migrate to use loan_facilities + lenders directly
  const lenderData = useMemo(() => computeLenderData(v1CoreRentalProperties), [v1CoreRentalProperties]);

  // Snapshot KPIs for rental row (Track C — unchanged)
  const snapshotKPIs = useMemo(() => {
    const latestMonth = portfolioMonthlySummary?.[0];
    const monthlyCashPosition = latestMonth?.total_cash_flow ?? null;
    const latestMonthLabel = latestMonth?.snapshot_month
      ? format(new Date(latestMonth.snapshot_month), 'MMM yyyy')
      : null;
    return { monthlyCashPosition, latestMonthLabel };
  }, [portfolioMonthlySummary]);

  // Map adapter for PropertyMap
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
      })) as any[];
  }, [filteredProperties]);

  const hasPropertiesWithCoords = mapProperties.length > 0;

  // Handle metric card click
  const handleMetricClick = useCallback((metricKey: MetricKey) => {
    setSelectedMetric(metricKey);
  }, []);

  // V2 metric breakdown using portfolioKPIs
  const selectedBreakdown = useMemo<MetricBreakdown | null>(() => {
    if (!selectedMetric || !portfolioKPIs) return null;

    const { gross, attributable, properties: propRows, groupParentName } = portfolioKPIs;

    const buildBreakdown = (
      title: string,
      summaryValue: string,
      calculationText: string,
      formula: string,
      columns: MetricBreakdown['columns'],
      rows: MetricBreakdown['rows'],
    ): MetricBreakdown => ({ title, summaryValue, calculationText, formula, columns, rows });

    switch (selectedMetric) {
      case 'equity':
        return buildBreakdown(
          'Portfolio Value & Equity',
          `Gross: ${formatGBP(gross.totalEquity)} | ${groupParentName}: ${formatGBP(attributable.totalEquity)}`,
          `${propRows.length} core rental properties`,
          'Equity = Value − Debt',
          [
            { key: 'address', label: 'Property', align: 'left' },
            { key: 'value', label: 'Value', align: 'right' },
            { key: 'equity', label: 'Equity', align: 'right' },
            { key: 'attrEquity', label: `${groupParentName} Equity`, align: 'right' },
          ],
          [...propRows].sort((a, b) => b.equity - a.equity).map(p => ({
            propertyId: p.propertyId,
            address: `${p.address}, ${p.city}`,
            values: {
              value: formatGBP(p.value),
              equity: formatGBP(p.equity),
              attrEquity: `${formatGBP(p.attrEquity)} (${p.groupOwnershipPct.toFixed(0)}%)`,
            },
          })),
        );
      case 'cashflow':
        return buildBreakdown(
          'Monthly Cashflow',
          `Gross: ${formatGBP(gross.monthlyCashflow)} | ${groupParentName}: ${formatGBP(attributable.monthlyCashflow)}`,
          'After debt service',
          'Cashflow = Rent − Costs − Mortgage',
          [
            { key: 'address', label: 'Property', align: 'left' },
            { key: 'cashflow', label: 'Monthly', align: 'right' },
            { key: 'attrCashflow', label: `${groupParentName}`, align: 'right' },
          ],
          [...propRows].sort((a, b) => b.annualCashflow - a.annualCashflow).map(p => ({
            propertyId: p.propertyId,
            address: `${p.address}, ${p.city}`,
            values: {
              cashflow: formatGBP(p.annualCashflow / 12),
              attrCashflow: `${formatGBP(p.attrCashflow / 12)} (${p.groupOwnershipPct.toFixed(0)}%)`,
            },
            // highlight: p.annualCashflow < 0,
          })),
        );
      case 'ltv':
        return buildBreakdown(
          'Loan-to-Value',
          `Gross: ${formatPercent(gross.weightedLTV)} | ${groupParentName}: ${formatPercent(attributable.weightedLTV)}`,
          'Per property',
          'LTV = Debt ÷ Value × 100',
          [
            { key: 'address', label: 'Property', align: 'left' },
            { key: 'ltv', label: 'LTV', align: 'right' },
            { key: 'debt', label: 'Debt', align: 'right' },
          ],
          [...propRows].filter(p => p.debt > 0).sort((a, b) => b.ltv - a.ltv).map(p => ({
            propertyId: p.propertyId,
            address: `${p.address}, ${p.city}`,
            values: {
              ltv: formatPercent(p.ltv),
              debt: `${formatGBP(p.debt)} on ${formatGBP(p.value)}`,
            },
            // highlight: p.ltv > 80,
          })),
        );
      default:
        return null;
    }
  }, [selectedMetric, portfolioKPIs]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Activation Checklist */}
        <ActivationChecklist />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              {filteredProperties?.length || 0} properties
              {propertiesV2 && filteredProperties.length < propertiesV2.length ? ` (${propertiesV2.length} total)` : ''}
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
            {/* KPI Cards — Gross vs Attributable */}
            {portfolioKPIs && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <DualKpiCard
                    label="Portfolio Value"
                    grossValue={formatGBP(portfolioKPIs.gross.totalValue)}
                    attrValue={formatGBP(portfolioKPIs.attributable.totalValue)}
                    groupParentName={portfolioKPIs.groupParentName}
                    subtitle={`${portfolioKPIs.gross.propertyCount} properties`}
                    icon={TrendingUp}
                    iconClassName="text-primary"
                    grossClassName="text-primary"
                    attrClassName="text-primary"
                    onClick={() => handleMetricClick('equity')}
                  />
                  <DualKpiCard
                    label="Equity"
                    grossValue={formatGBP(portfolioKPIs.gross.totalEquity)}
                    attrValue={formatGBP(portfolioKPIs.attributable.totalEquity)}
                    groupParentName={portfolioKPIs.groupParentName}
                    subtitle={`Debt: ${formatGBP(portfolioKPIs.gross.totalDebt)}`}
                    icon={TrendingUp}
                    iconClassName="text-primary"
                    grossClassName="text-primary"
                    attrClassName="text-primary"
                    onClick={() => handleMetricClick('equity')}
                  />
                  <DualKpiCard
                    label={cashflowPeriod === 'monthly' ? 'Monthly Cashflow' : 'Annual Cashflow'}
                    grossValue={formatGBP(
                      cashflowPeriod === 'monthly'
                        ? portfolioKPIs.gross.monthlyCashflow
                        : portfolioKPIs.gross.annualCashflow
                    )}
                    attrValue={formatGBP(
                      cashflowPeriod === 'monthly'
                        ? portfolioKPIs.attributable.monthlyCashflow
                        : portfolioKPIs.attributable.annualCashflow
                    )}
                    groupParentName={portfolioKPIs.groupParentName}
                    subtitle="After debt service"
                    icon={PoundSterling}
                    iconClassName="text-success"
                    grossClassName={portfolioKPIs.gross.monthlyCashflow >= 0 ? 'text-success' : 'text-destructive'}
                    attrClassName={portfolioKPIs.attributable.monthlyCashflow >= 0 ? 'text-success' : 'text-destructive'}
                    onClick={() => handleMetricClick('cashflow')}
                    headerAction={
                      <button
                        className="text-xs px-2 py-1 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground transition-colors font-medium"
                        onClick={(e) => { e.stopPropagation(); setCashflowPeriod(p => p === 'monthly' ? 'annual' : 'monthly'); }}
                      >
                        {cashflowPeriod === 'monthly' ? '/mo' : '/yr'}
                      </button>
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <DualKpiCard
                    label="Weighted LTV"
                    grossValue={formatPercent(portfolioKPIs.gross.weightedLTV)}
                    attrValue={formatPercent(portfolioKPIs.attributable.weightedLTV)}
                    groupParentName={portfolioKPIs.groupParentName}
                    icon={Percent}
                    grossClassName={
                      portfolioKPIs.gross.weightedLTV > 85 ? 'text-destructive' :
                      portfolioKPIs.gross.weightedLTV > 75 ? 'text-warning' : ''
                    }
                    attrClassName={
                      portfolioKPIs.attributable.weightedLTV > 85 ? 'text-destructive' :
                      portfolioKPIs.attributable.weightedLTV > 75 ? 'text-warning' : ''
                    }
                    onClick={() => handleMetricClick('ltv')}
                  />
                  <DualKpiCard
                    label="Net Yield"
                    grossValue={portfolioKPIs.gross.netYieldPct !== null ? formatPercent(portfolioKPIs.gross.netYieldPct) : '—'}
                    attrValue={portfolioKPIs.attributable.netYieldPct !== null ? formatPercent(portfolioKPIs.attributable.netYieldPct) : '—'}
                    groupParentName={portfolioKPIs.groupParentName}
                    subtitle="Annual NOI ÷ Value"
                    icon={TrendingUp}
                    onClick={() => navigate('/financials')}
                  />
                  <DualKpiCard
                    label="Annual Rent"
                    grossValue={formatGBP(portfolioKPIs.gross.annualRent)}
                    attrValue={formatGBP(portfolioKPIs.attributable.annualRent)}
                    groupParentName={portfolioKPIs.groupParentName}
                    icon={Wallet}
                    iconClassName="text-primary"
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
              </>
            )}

            {/* Rental KPI Cards — Track C, unchanged */}
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
                value={portfolioKPIs?.gross.netYieldPct !== null && portfolioKPIs?.gross.netYieldPct !== undefined ? formatPercent(portfolioKPIs.gross.netYieldPct) : '—'}
                subtitle={portfolioKPIs?.gross.netYieldPct !== null ? 'Annual NOI / valuation' : 'No data yet'}
                icon={TrendingUp}
                iconClassName="text-primary"
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
                <SectionCard
                  title="Property Map"
                  subtitle={`${mapProperties.length} properties plotted`}
                  icon={MapPin}
                  onClick={() => navigate('/dashboard/map')}
                  showArrow
                  noPadding
                  contentClassName="p-0"
                >
                  {hasPropertiesWithCoords ? (
                    <div className="p-4">
                      <Suspense fallback={<Skeleton className="h-[350px] rounded-lg" />}>
                        <PropertyMap
                          properties={mapProperties}
                          className="h-[350px] rounded-lg"
                        />
                      </Suspense>
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

                <div className="grid gap-6 lg:grid-cols-3">
                  <ErrorBoundary><ThisMonthWidget /></ErrorBoundary>
                  <ErrorBoundary><ActionsRequiredWidget /></ErrorBoundary>
                  <ErrorBoundary><DashboardCalendarWidget /></ErrorBoundary>
                </div>

                <div className="grid gap-6 lg:grid-cols-4">
                  <ErrorBoundary><RentCollectionWidget /></ErrorBoundary>
                  <ErrorBoundary><OccupancyWidget /></ErrorBoundary>
                  <ErrorBoundary><VoidCostWidget /></ErrorBoundary>
                  <ErrorBoundary><TenancyPipelineWidget /></ErrorBoundary>
                </div>

                <ErrorBoundary><MaintenanceWidget /></ErrorBoundary>
                <ErrorBoundary><ComplianceTasksWidget /></ErrorBoundary>
                <ErrorBoundary><TenancyEventsWidget /></ErrorBoundary>
                <ErrorBoundary><WorkOrdersWidget /></ErrorBoundary>
                <ErrorBoundary><RecentActivityWidget /></ErrorBoundary>
              </TabsContent>

              {/* HEALTH TAB */}
              <TabsContent value="health" className="space-y-6 mt-4">
                {v1CoreRentalProperties.length > 0 && (
                  <ErrorBoundary>
                    <PortfolioHealthWidget
                      properties={v1CoreRentalProperties}
                      onClick={() => handleMetricClick('health')}
                    />
                  </ErrorBoundary>
                )}
                <div className="grid gap-6 lg:grid-cols-2">
                  <ErrorBoundary><MissingComplianceWidget /></ErrorBoundary>
                  <ErrorBoundary><CHFilingAlertsWidget /></ErrorBoundary>
                </div>
                <ErrorBoundary><DashboardCalendarWidget /></ErrorBoundary>
                <ErrorBoundary>
                  {v1Properties && v1Properties.length > 0 && (
                    <DataQualityWidget properties={v1Properties} />
                  )}
                </ErrorBoundary>
                <ErrorBoundary><StockConditionSection /></ErrorBoundary>
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
                      <Suspense fallback={<Skeleton className="h-[400px] rounded-lg" />}>
                        <PropertyMap
                          properties={mapProperties}
                          className="h-[400px] rounded-lg pointer-events-none"
                        />
                      </Suspense>
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
                    {v1Properties && <AreaExposureChart properties={v1Properties} />}
                  </ErrorBoundary>
                </div>

                <ErrorBoundary>
                  <BeneficialOwnerWidget />
                </ErrorBoundary>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Shareholders Tab */}
          <TabsContent value="shareholders">
            <DashboardShareholdersTab />
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
