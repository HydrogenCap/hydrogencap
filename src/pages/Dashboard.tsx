import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, FileText, Home, Users } from 'lucide-react';
import { format } from 'date-fns';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { KpiCardSkeleton, PageSkeleton } from '@/components/common';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BankPresentationDialog } from '@/components/reports/BankPresentationDialog';
import { ActivationChecklist } from '@/components/dashboard/ActivationChecklist';
import { DemoBanner } from '@/components/dashboard/DemoBanner';
import { LifecycleFilterToggle } from '@/components/dashboard/LifecycleFilterToggle';
import { MetricDetailsSheet } from '@/components/dashboard/MetricDetailsSheet';
import { DashboardShareholdersTab } from '@/components/dashboard/DashboardShareholdersTab';
import { computeLenderData } from '@/components/dashboard/LenderExposureChart';

// Zone components
import { TodayStrip } from '@/components/dashboard/TodayStrip';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';

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
import { MetricKey, MetricBreakdown } from '@/lib/metricsConfig';

function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const { lifecycleFilter, filterProperties: _filterProperties } = useLifecycleFilter();

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
    if (!selectedMetric || !portfolioKPIs) return null;
    const { gross, attributable, properties: propRows, groupParentName } = portfolioKPIs;

    const buildBreakdown = (
      title: string, summaryValue: string, calculationText: string, formula: string,
      columns: MetricBreakdown['columns'], rows: MetricBreakdown['rows'],
    ): MetricBreakdown => ({ title, summaryValue, calculationText, formula, columns, rows });

    switch (selectedMetric) {
      case 'equity':
        return buildBreakdown(
          'Portfolio Value & Equity',
          `Gross: ${formatGBP(gross.totalEquity)} | ${groupParentName}: ${formatGBP(attributable.totalEquity)}`,
          `${propRows.length} core rental properties`, 'Equity = Value − Debt',
          [
            { key: 'address', label: 'Property', align: 'left' },
            { key: 'value', label: 'Value', align: 'right' },
            { key: 'equity', label: 'Equity', align: 'right' },
            { key: 'attrEquity', label: `${groupParentName} Equity`, align: 'right' },
          ],
          [...propRows].sort((a, b) => b.equity - a.equity).map(p => ({
            propertyId: p.propertyId, address: `${p.address}, ${p.city}`,
            values: { value: formatGBP(p.value), equity: formatGBP(p.equity), attrEquity: `${formatGBP(p.attrEquity)} (${p.groupOwnershipPct.toFixed(0)}%)` },
          })),
        );
      case 'cashflow':
        return buildBreakdown(
          'Monthly Cashflow',
          `Gross: ${formatGBP(gross.monthlyCashflow)} | ${groupParentName}: ${formatGBP(attributable.monthlyCashflow)}`,
          'After debt service', 'Cashflow = Rent − Costs − Mortgage',
          [
            { key: 'address', label: 'Property', align: 'left' },
            { key: 'cashflow', label: 'Monthly', align: 'right' },
            { key: 'attrCashflow', label: `${groupParentName}`, align: 'right' },
          ],
          [...propRows].sort((a, b) => b.annualCashflow - a.annualCashflow).map(p => ({
            propertyId: p.propertyId, address: `${p.address}, ${p.city}`,
            values: { cashflow: formatGBP(p.annualCashflow / 12), attrCashflow: `${formatGBP(p.attrCashflow / 12)} (${p.groupOwnershipPct.toFixed(0)}%)` },
          })),
        );
      case 'ltv':
        return buildBreakdown(
          'Loan-to-Value',
          `Gross: ${formatPercent(gross.weightedLTV)} | ${groupParentName}: ${formatPercent(attributable.weightedLTV)}`,
          'Per property', 'LTV = Debt ÷ Value × 100',
          [
            { key: 'address', label: 'Property', align: 'left' },
            { key: 'ltv', label: 'LTV', align: 'right' },
            { key: 'debt', label: 'Debt', align: 'right' },
          ],
          [...propRows].filter(p => p.debt > 0).sort((a, b) => b.ltv - a.ltv).map(p => ({
            propertyId: p.propertyId, address: `${p.address}, ${p.city}`,
            values: { ltv: formatPercent(p.ltv), debt: `${formatGBP(p.debt)} on ${formatGBP(p.value)}` },
          })),
        );
      case 'dscr':
        return buildBreakdown(
          'Debt Service Coverage Ratio',
          `Gross: ${gross.dscr !== null ? `${gross.dscr.toFixed(2)}x` : '—'} | ${groupParentName}: ${attributable.dscr !== null ? `${attributable.dscr.toFixed(2)}x` : '—'}`,
          'NOI ÷ Annual Debt Service', 'DSCR = Annual NOI ÷ Annual Mortgage Payments',
          [
            { key: 'address', label: 'Property', align: 'left' },
            { key: 'noi', label: 'Annual NOI', align: 'right' },
            { key: 'debtService', label: 'Annual Debt Service', align: 'right' },
            { key: 'dscr', label: 'DSCR', align: 'right' },
          ],
          [...propRows].filter(p => p.debt > 0).sort((a, b) => {
            const aDscr = a.annualRent > 0 && a.debt > 0 ? a.annualRent / (a.debt * 0.05) : 0;
            const bDscr = b.annualRent > 0 && b.debt > 0 ? b.annualRent / (b.debt * 0.05) : 0;
            return aDscr - bDscr;
          }).map(p => {
            const annualDebtService = p.debt * 0.05;
            const dscr = annualDebtService > 0 ? p.annualRent / annualDebtService : null;
            return {
              propertyId: p.propertyId, address: `${p.address}, ${p.city}`,
              values: { noi: formatGBP(p.annualRent), debtService: formatGBP(annualDebtService), dscr: dscr !== null ? `${dscr.toFixed(2)}x` : '—' },
            };
          }),
        );
      default:
        return null;
    }
  }, [selectedMetric, portfolioKPIs]);

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
      <div className="space-y-6">
        <DemoBanner />
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

        {/* Empty state */}
        {filteredProperties.length === 0 && propertiesV2 !== undefined && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome to Tenure IQ</h2>
            <p className="text-muted-foreground mb-4">Add your first property to see your portfolio dashboard.</p>
            <Button asChild>
              <Link to="/wizards/add-property">Add your first property</Link>
            </Button>
          </div>
        )}

        {/* Top-level tabs: Overview vs Shareholders */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full max-w-md grid grid-cols-2 overflow-x-auto flex-nowrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="shareholders">
              <Users className="h-4 w-4 mr-2" />
              Shareholders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Zone 1 — Today Strip */}
            <TodayStrip
              risks={portfolioRisks}
              criticalCount={portfolioCriticalCount}
              loanAlerts={loanAlerts}
              rentSchedule={rentSchedule}
              complianceEvents={complianceEvents}
            />

            {/* Zone 2 — KPI Cards */}
            {portfolioKPIs && (
              <KpiCards
                portfolioKPIs={portfolioKPIs}
                risks={portfolioRisks}
                criticalCount={portfolioCriticalCount}
                rentalStats={rentalStats}
                snapshotKPIs={snapshotKPIs}
                voidRateData={voidRateData}
                onMetricClick={handleMetricClick}
              />
            )}

            {/* Missing Info Shortcut */}
            {missingStats.totalMissingFields > 0 && (
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
                      <div>
                        <h3 className="font-semibold text-foreground">Missing Information</h3>
                        <p className="text-sm text-muted-foreground">
                          {missingStats.propertiesWithFinanceMissing > 0 && <span>{missingStats.propertiesWithFinanceMissing} finance &bull; </span>}
                          {missingStats.propertiesWithInsuranceMissing > 0 && <span>{missingStats.propertiesWithInsuranceMissing} insurance &bull; </span>}
                          {missingStats.propertiesWithPassportMissing > 0 && <span>{missingStats.propertiesWithPassportMissing} passport &bull; </span>}
                          <span className="font-medium text-warning">{missingStats.totalMissingFields} fields total</span>
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Leasehold Alerts */}
            <LeaseholdAlertWidget />

            {/* Zone 3 — Tabbed Detail */}
            <DashboardTabs
              v1CoreRentalProperties={v1CoreRentalProperties}
              v1Properties={v1Properties}
              lenderData={lenderData}
              mapProperties={mapProperties}
              onHealthMetricClick={() => handleMetricClick('health')}
            />
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
