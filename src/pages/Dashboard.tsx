import React, { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PoundSterling, TrendingUp, Percent, AlertTriangle, ExternalLink, AlertCircle, ArrowRight, Users, User, Building2 } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProperties, PropertyWithFinancials } from '@/hooks/useProperties';
import { usePortfolioAttribution } from '@/hooks/useOwnershipAttribution';
import { useLifecycleFilter } from '@/contexts/LifecycleFilterContext';
import { RecentActivityWidget } from '@/components/activity/RecentActivityWidget';
import { PortfolioHealthWidget } from '@/components/dashboard/PortfolioHealthWidget';
import { AreaExposureChart } from '@/components/dashboard/AreaExposureChart';
import { BeneficialOwnerWidget } from '@/components/dashboard/BeneficialOwnerWidget';
import { DataQualityWidget } from '@/components/dashboard/DataQualityWidget';
import { MissingComplianceWidget } from '@/components/dashboard/MissingComplianceWidget';
import { LifecycleFilterToggle } from '@/components/dashboard/LifecycleFilterToggle';
import { ClickableStatCard } from '@/components/dashboard/ClickableStatCard';
import { MetricDetailsSheet } from '@/components/dashboard/MetricDetailsSheet';
import { PropertyMap } from '@/components/maps/PropertyMap';
import {
  formatGBP,
  formatPercent,
  calculateLTV,
  getEffectiveCosts,
  calculateMonthlyCashflowAfterDebt,
  calculateMonthlyMortgagePayment,
  getLTVStatus,
  getEPCStatus,
  getExpiryStatus,
  daysUntil,
} from '@/lib/calculations';
import { calculatePortfolioRentPerBedroom } from '@/lib/mortgageCalculations';
import { getPropertyMetrics } from '@/lib/propertyMetrics';
import { StockConditionSection } from '@/components/dashboard/StockConditionSection';
import { MetricKey, METRICS_CONFIG, MetricBreakdown } from '@/lib/metricsConfig';

const CHART_COLORS = [
  'hsl(174, 72%, 45%)',
  'hsl(190, 80%, 50%)',
  'hsl(200, 85%, 55%)',
  'hsl(280, 70%, 55%)',
  'hsl(320, 75%, 50%)',
  'hsl(38, 92%, 50%)',
  'hsl(142, 70%, 45%)',
];

interface RiskItem {
  id: string;
  propertyId: string;
  address: string;
  type: 'ltv' | 'epc' | 'rate_expiry' | 'negative_cashflow' | 'hmo_licence' | 'operational_data';
  severity: 'critical' | 'warning';
  message: string;
}

import { usePropertyPassports, getHMOLicenceStatus, calculatePassportCompleteness, type PropertyPassport } from '@/hooks/usePropertyPassport';
import { useMissingInfo } from '@/hooks/useMissingInfo';

const SHAREHOLDER_COLORS = [
  'hsl(174, 72%, 45%)',
  'hsl(190, 80%, 50%)',
  'hsl(200, 85%, 55%)',
  'hsl(280, 70%, 55%)',
  'hsl(320, 75%, 50%)',
  'hsl(38, 92%, 50%)',
  'hsl(142, 70%, 45%)',
  'hsl(350, 80%, 55%)',
];

function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const { data: properties, isLoading } = useProperties();
  const { data: passports } = usePropertyPassports();
  const { stats: missingStats } = useMissingInfo();
  const { lifecycleFilter, filterProperties } = useLifecycleFilter();
  
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

  // Create a map of passports by property_id for quick lookup
  const passportMap = useMemo(() => {
    const map = new Map<string, PropertyPassport>();
    passports?.forEach(p => map.set(p.property_id, p));
    return map;
  }, [passports]);

  // Calculate portfolio totals - ONLY from core rental properties for income KPIs
  const portfolioStats = useMemo(() => {
    // Use core rental properties for financial KPIs (never skewed by development)
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
      
      // Use effective costs (auto-calculated with manual overrides)
      const effectiveCosts = getEffectiveCosts(rent, value, costs);
      const totalCosts = effectiveCosts.total;

      // Calculate effective monthly mortgage payment
      const mortgagePaymentResult = calculateMonthlyMortgagePayment({
        balance: mortgage || null,
        interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
        termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
        isInterestOnly: loan?.capital_or_interest === 'interest',
        paymentOverride: loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : null,
      });

      totalValue += value;
      totalMortgage += mortgage;
      
      // Use cashflow after debt
      const monthlyCashflow = calculateMonthlyCashflowAfterDebt(rent, totalCosts, mortgagePaymentResult.effective);
      totalMonthlyCashflowAfterDebt += monthlyCashflow || 0;
    });

    const totalEquity = totalValue - totalMortgage;
    const averageLTV = totalValue > 0 ? (totalMortgage / totalValue) * 100 : 0;

    // Calculate portfolio rent per bedroom
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

  // Calculate risks - ONLY from core rental properties (development shouldn't flag risks)
  const risks = useMemo<RiskItem[]>(() => {
    // Only show risks for core rental properties
    if (!coreRentalProperties?.length) return [];

    const riskItems: RiskItem[] = [];
    const currentYear = new Date().getFullYear();

    coreRentalProperties.forEach(property => {
      const loan = property.loans?.[0];
      const income = property.income?.find(i => i.year === currentYear);
      const costs = property.costs?.find(c => c.year === currentYear);
      const passport = passportMap.get(property.id);

      const value = property.current_value_gbp ? Number(property.current_value_gbp) : null;
      const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
      const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
      
      // Use effective costs (auto-calculated with manual overrides)
      const effectiveCostsRisk = getEffectiveCosts(rent, value, costs);
      const totalCosts = effectiveCostsRisk.total;

      // Calculate effective monthly mortgage payment
      const mortgagePaymentResult = calculateMonthlyMortgagePayment({
        balance: mortgage,
        interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
        termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
        isInterestOnly: loan?.capital_or_interest === 'interest',
        paymentOverride: loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : null,
      });

      const ltv = calculateLTV(mortgage, value);
      // Calculate annual cashflow after debt for risk assessment
      const annualCashflowAfterDebt = rent !== null 
        ? (rent - totalCosts - (mortgagePaymentResult.effective || 0) * 12)
        : null;

      // LTV risks
      const ltvStatus = getLTVStatus(ltv);
      if (ltvStatus === 'danger') {
        riskItems.push({
          id: `ltv-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'ltv',
          severity: 'critical',
          message: `LTV at ${formatPercent(ltv)} (>85%)`,
        });
      } else if (ltvStatus === 'warning') {
        riskItems.push({
          id: `ltv-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'ltv',
          severity: 'warning',
          message: `LTV at ${formatPercent(ltv)} (>75%)`,
        });
      }

      // EPC risks (only if EPC is required)
      const epcRequired = property.epc_required !== false;
      const epcStatus = getEPCStatus(property.epc_rating, epcRequired);
      if (epcStatus === 'warning') {
        riskItems.push({
          id: `epc-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'epc',
          severity: 'warning',
          message: `EPC rating ${property.epc_rating} (below C)`,
        });
      }

      // Rate expiry risks
      if (loan?.fixed_rate_expires) {
        const days = daysUntil(loan.fixed_rate_expires);
        const status = getExpiryStatus(loan.fixed_rate_expires);
        
        if (status === 'expired') {
          riskItems.push({
            id: `rate-${property.id}`,
            propertyId: property.id,
            address: property.address_line,
            type: 'rate_expiry',
            severity: 'critical',
            message: 'Fixed rate has expired',
          });
        } else if (status === 'critical') {
          riskItems.push({
            id: `rate-${property.id}`,
            propertyId: property.id,
            address: property.address_line,
            type: 'rate_expiry',
            severity: 'critical',
            message: `Fixed rate expires in ${days} days`,
          });
        } else if (status === 'warning') {
          riskItems.push({
            id: `rate-${property.id}`,
            propertyId: property.id,
            address: property.address_line,
            type: 'rate_expiry',
            severity: 'warning',
            message: `Fixed rate expires in ${days} days`,
          });
        }
      }

      // Negative cashflow (after debt)
      if (annualCashflowAfterDebt !== null && annualCashflowAfterDebt < 0) {
        riskItems.push({
          id: `cashflow-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'negative_cashflow',
          severity: 'warning',
          message: `Negative cashflow: ${formatGBP(annualCashflowAfterDebt)}/year`,
        });
      }

      // ========== PASSPORT-BASED RISKS ==========
      
      // HMO licence risks
      const hmoStatus = getHMOLicenceStatus(passport);
      if (hmoStatus === 'overdue') {
        riskItems.push({
          id: `hmo-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'hmo_licence',
          severity: 'critical',
          message: 'HMO licence has expired',
        });
      } else if (hmoStatus === 'expiring_soon') {
        riskItems.push({
          id: `hmo-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'hmo_licence',
          severity: 'warning',
          message: 'HMO licence expires within 30 days',
        });
      } else if (hmoStatus === 'missing') {
        riskItems.push({
          id: `hmo-missing-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'hmo_licence',
          severity: 'critical',
          message: 'HMO licence required but not recorded',
        });
      }

      // Operational data risks (from passport completeness)
      if (passport) {
        const completeness = calculatePassportCompleteness(passport);
        if (completeness.criticalMissing.length > 0) {
          // Only show top 2 missing items in risk message
          const missingItems = completeness.criticalMissing.slice(0, 2).join(', ');
          const moreCount = completeness.criticalMissing.length > 2 
            ? ` +${completeness.criticalMissing.length - 2} more` 
            : '';
          riskItems.push({
            id: `ops-${property.id}`,
            propertyId: property.id,
            address: property.address_line,
            type: 'operational_data',
            severity: 'warning',
            message: `Missing: ${missingItems}${moreCount}`,
          });
        }
      }
    });

    // Sort by severity
    return riskItems.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return 0;
    });
  }, [coreRentalProperties, passportMap]);

  // Lender exposure data - from core rental only
  const lenderData = useMemo(() => {
    if (!coreRentalProperties?.length) return [];

    const lenderMap: Record<string, number> = {};
    const canonicalNames: Record<string, string> = {}; // Store original casing
    
    coreRentalProperties.forEach(property => {
      const loan = property.loans?.[0];
      if (loan?.lender && loan.current_mortgage_balance_gbp) {
        // Normalize lender name for grouping (case-insensitive, trim whitespace)
        const normalizedKey = loan.lender.trim().toLowerCase().replace(/\s+/g, ' ');
        
        // Keep the first version of the name we encounter as the display name
        if (!canonicalNames[normalizedKey]) {
          canonicalNames[normalizedKey] = loan.lender.trim();
        }
        
        lenderMap[normalizedKey] = (lenderMap[normalizedKey] || 0) + Number(loan.current_mortgage_balance_gbp);
      }
    });

    return Object.entries(lenderMap)
      .map(([key, value]) => ({ name: canonicalNames[key], value }))
      .sort((a, b) => b.value - a.value);
  }, [coreRentalProperties]);

  // Properties with coordinates for map - show filtered properties
  const hasPropertiesWithCoords = useMemo(() => {
    if (!filteredProperties?.length) return false;
    return filteredProperties.some(p => p.latitude && p.longitude);
  }, [filteredProperties]);

  // Calculate shareholder data for breakdown tab
  const shareholderData = useMemo(() => {
    if (!attribution || attribution.length === 0) return [];

    const totalEquity = attribution.reduce(
      (sum, owner) => sum + owner.totals.totalAttributableEquity,
      0
    );

    return attribution.map((owner, index) => {
      const equityPercent = totalEquity > 0
        ? (owner.totals.totalAttributableEquity / totalEquity) * 100
        : 0;

      return {
        id: owner.ownerId,
        name: owner.ownerName,
        type: owner.ownerType,
        equityPercent,
        equity: owner.totals.totalAttributableEquity,
        cashflow: owner.totals.totalAttributableCashflow,
        properties: owner.totals.propertyCount,
        color: SHAREHOLDER_COLORS[index % SHAREHOLDER_COLORS.length],
      };
    }).sort((a, b) => b.equityPercent - a.equityPercent);
  }, [attribution]);

  // Handle metric card click - compute breakdown on demand
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
          <LifecycleFilterToggle />
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

        {/* KPI Cards - All clickable with detail breakdowns */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ClickableStatCard
            title="Attributable Equity"
            value={formatGBP(portfolioStats.totalEquity)}
            subtitle={`Value: ${formatGBP(portfolioStats.totalValue)}`}
            icon={TrendingUp}
            iconClassName="text-primary"
            valueClassName="text-primary"
            onClick={() => handleMetricClick('equity')}
            aria-label="View details for Attributable Equity"
          />

          <ClickableStatCard
            title="Monthly Cashflow"
            value={formatGBP(portfolioStats.monthlyCashflow)}
            subtitle="After debt service"
            icon={PoundSterling}
            iconClassName="text-success"
            valueClassName={portfolioStats.monthlyCashflow >= 0 ? 'text-success' : 'text-destructive'}
            onClick={() => handleMetricClick('cashflow')}
            aria-label="View details for Monthly Cashflow"
          />

          <ClickableStatCard
            title="Average LTV"
            value={formatPercent(portfolioStats.averageLTV)}
            subtitle={`Debt: ${formatGBP(portfolioStats.totalMortgage)}`}
            icon={Percent}
            iconClassName="text-muted-foreground"
            valueClassName={
              portfolioStats.averageLTV > 85 ? 'text-destructive' : 
              portfolioStats.averageLTV > 75 ? 'text-warning' : ''
            }
            onClick={() => handleMetricClick('ltv')}
            aria-label="View details for Average LTV"
          />

          <ClickableStatCard
            title="Action Required"
            value={risks.length === 0 ? '✓' : risks.length}
            subtitle={risks.length === 0 ? 'All clear' : `${risks.filter(r => r.severity === 'critical').length} critical`}
            icon={AlertTriangle}
            iconClassName={risks.length > 0 ? 'text-warning' : 'text-success'}
            valueClassName={risks.length > 0 ? 'text-warning' : 'text-success'}
            borderClassName={risks.length > 0 ? 'border-warning/50' : 'border-success/50'}
            onClick={() => navigate('/actions')}
            aria-label="View actions required"
          />
        </div>

        {/* Missing Info Shortcut Card */}
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

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Portfolio Health - uses core rental only */}
          {coreRentalProperties && coreRentalProperties.length > 0 && (
            <PortfolioHealthWidget properties={coreRentalProperties} />
          )}

          {/* Risks Panel - core rental only */}
          <Card className={`bg-card border-border ${coreRentalProperties && coreRentalProperties.length > 0 ? '' : 'lg:col-span-1'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Portfolio Risks
                {risks.length > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {risks.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {risks.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-success">✓ All clear</p>
                  <p className="text-sm mt-1">No risks detected</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {risks.slice(0, 10).map(risk => (
                    <Link
                      key={risk.id}
                      to={`/properties/${risk.propertyId}`}
                      className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <Badge
                          variant="outline"
                          className={risk.severity === 'critical' ? 'status-danger border' : 'status-warning border'}
                        >
                          {risk.severity === 'critical' ? '🔴' : '🟡'}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{risk.address}</p>
                          <p className="text-xs text-muted-foreground">{risk.message}</p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                  {risks.length > 10 && (
                    <p className="text-center text-xs text-muted-foreground">
                      +{risks.length - 10} more risks
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          {/* Property Map - Uses shared PropertyMap component */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Property Map</CardTitle>
              <Link 
                to="/dashboard/map"
                className="text-xs text-primary hover:underline"
              >
                View Full Map →
              </Link>
            </CardHeader>
            <CardContent>
              {hasPropertiesWithCoords ? (
                <PropertyMap
                  properties={filteredProperties || []}
                  className="h-[300px] rounded-lg"
                />
              ) : (
                <div className="h-[300px] rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Add properties with coordinates to see them on the map</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Lender Exposure */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Lender Exposure</CardTitle>
            </CardHeader>
            <CardContent>
              {lenderData.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={lenderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {lenderData.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatGBP(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(222 47% 8%)',
                          border: '1px solid hsl(220 25% 16%)',
                          borderRadius: '0.5rem',
                          color: 'hsl(210 40% 98%)',
                        }}
                        labelStyle={{ color: 'hsl(210 40% 98%)' }}
                        itemStyle={{ color: 'hsl(210 40% 98%)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <p>Add properties with mortgages to see lender breakdown</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Area Exposure - filtered properties for geographic distribution */}
          {filteredProperties && <AreaExposureChart properties={filteredProperties} />}
        </div>

        {/* Data Quality Row - all properties */}
        {filteredProperties && filteredProperties.length > 0 && (
          <DataQualityWidget properties={filteredProperties} />
        )}

        {/* Beneficial Owner Details - core rental only */}
        {coreRentalProperties && coreRentalProperties.length > 0 && (
          <BeneficialOwnerWidget properties={coreRentalProperties} />
        )}

        {/* Stock Condition Section */}
        <StockConditionSection />

        {/* Compliance Overview */}
        <MissingComplianceWidget />

        {/* Recent Activity */}
        <RecentActivityWidget />
          </TabsContent>

          {/* Shareholders Tab */}
          <TabsContent value="shareholders" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Shareholder Breakdown
                </CardTitle>
                <CardDescription>
                  {shareholderData.length} beneficial owner{shareholderData.length !== 1 ? 's' : ''} across the portfolio
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isAttributionLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-[300px] w-full" />
                    <Skeleton className="h-[200px] w-full" />
                  </div>
                ) : shareholderData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="font-medium text-lg">No shareholders defined</p>
                    <p className="text-sm mt-2">Set up company shareholders to see the breakdown</p>
                  </div>
                ) : (
                  <div className="grid lg:grid-cols-2 gap-8">
                    {/* Pie Chart */}
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={shareholderData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={120}
                            dataKey="equityPercent"
                            nameKey="name"
                            paddingAngle={2}
                            label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                            labelLine={true}
                          >
                            {shareholderData.map((entry) => (
                              <Cell key={entry.id} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string, props: any) => [
                              `${value.toFixed(1)}% equity`,
                              props.payload.name
                            ]}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '0.5rem',
                              color: 'hsl(var(--foreground))',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legend with colored dots */}
                    <div className="space-y-2">
                      {shareholderData.map((owner) => (
                        <div
                          key={owner.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: owner.color }}
                          />
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {owner.type === 'INDIVIDUAL' || owner.type === 'Person' ? (
                              <User className="h-4 w-4" />
                            ) : (
                              <Building2 className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{owner.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {owner.properties} propert{owner.properties !== 1 ? 'ies' : 'y'}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-primary">
                              {formatPercent(owner.equityPercent, 1)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shareholders Table */}
            {shareholderData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Breakdown</CardTitle>
                  <CardDescription>
                    Financial attribution by beneficial owner
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Owner</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Equity %</TableHead>
                        <TableHead className="text-right">Attributable Equity</TableHead>
                        <TableHead className="text-right">Monthly Cashflow</TableHead>
                        <TableHead className="text-right">Properties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shareholderData.map((owner) => (
                        <TableRow key={owner.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: owner.color }}
                              />
                              <span className="font-medium">{owner.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {owner.type === 'INDIVIDUAL' || owner.type === 'Person' ? 'Individual' : 'Company'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {formatPercent(owner.equityPercent, 1)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatGBP(owner.equity)}
                          </TableCell>
                          <TableCell className={`text-right ${owner.cashflow >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatGBP(owner.cashflow)}
                          </TableCell>
                          <TableCell className="text-right">
                            {owner.properties}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
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
