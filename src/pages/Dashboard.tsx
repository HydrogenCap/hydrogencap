import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Building2, PoundSterling, TrendingUp, Percent, AlertTriangle, ExternalLink, Activity } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProperties, PropertyWithFinancials } from '@/hooks/useProperties';
import { useRecentActivity } from '@/hooks/useActivityLog';
import { RecentActivityWidget } from '@/components/activity/RecentActivityWidget';
import { PortfolioHealthWidget } from '@/components/dashboard/PortfolioHealthWidget';
import { StockConditionSection } from '@/components/dashboard/StockConditionSection';
import {
  formatGBP,
  formatPercent,
  calculateLTV,
  calculateEquity,
  calculateTotalCosts,
  calculateMonthlyCashflowAfterDebt,
  calculateMonthlyMortgagePayment,
  getLTVStatus,
  getEPCStatus,
  getExpiryStatus,
  daysUntil,
} from '@/lib/calculations';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

// Import passport hooks for risk calculations
import { usePropertyPassports, getHMOLicenceStatus, calculatePassportCompleteness, type PropertyPassport } from '@/hooks/usePropertyPassport';

function DashboardPage() {
  const { data: properties, isLoading } = useProperties();
  const { data: passports } = usePropertyPassports();

  // Create a map of passports by property_id for quick lookup
  const passportMap = useMemo(() => {
    const map = new Map<string, PropertyPassport>();
    passports?.forEach(p => map.set(p.property_id, p));
    return map;
  }, [passports]);

  // Calculate portfolio totals
  const portfolioStats = useMemo(() => {
    if (!properties?.length) {
      return {
        totalValue: 0,
        totalMortgage: 0,
        totalEquity: 0,
        averageLTV: 0,
        monthlyCashflow: 0,
      };
    }

    const currentYear = new Date().getFullYear();
    let totalValue = 0;
    let totalMortgage = 0;
    let totalMonthlyCashflowAfterDebt = 0;

    properties.forEach(property => {
      const loan = property.loans?.[0];
      const income = property.income?.find(i => i.year === currentYear);
      const costs = property.costs?.find(c => c.year === currentYear);

      const value = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
      const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
      const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
      const totalCosts = costs ? calculateTotalCosts({
        management_gbp: costs.management_gbp ? Number(costs.management_gbp) : null,
        bills_gbp: costs.bills_gbp ? Number(costs.bills_gbp) : null,
        insurance_gbp: costs.insurance_gbp ? Number(costs.insurance_gbp) : null,
        maintenance_gbp: costs.maintenance_gbp ? Number(costs.maintenance_gbp) : null,
        compliance_gbp: costs.compliance_gbp ? Number(costs.compliance_gbp) : null,
        other_gbp: costs.other_gbp ? Number(costs.other_gbp) : null,
      }) : 0;

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

    return { totalValue, totalMortgage, totalEquity, averageLTV, monthlyCashflow: totalMonthlyCashflowAfterDebt };
  }, [properties]);

  // Calculate risks (including passport data)
  const risks = useMemo<RiskItem[]>(() => {
    if (!properties?.length) return [];

    const riskItems: RiskItem[] = [];
    const currentYear = new Date().getFullYear();

    properties.forEach(property => {
      const loan = property.loans?.[0];
      const income = property.income?.find(i => i.year === currentYear);
      const costs = property.costs?.find(c => c.year === currentYear);
      const passport = passportMap.get(property.id);

      const value = property.current_value_gbp ? Number(property.current_value_gbp) : null;
      const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
      const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
      const totalCosts = costs ? calculateTotalCosts({
        management_gbp: costs.management_gbp ? Number(costs.management_gbp) : null,
        bills_gbp: costs.bills_gbp ? Number(costs.bills_gbp) : null,
        insurance_gbp: costs.insurance_gbp ? Number(costs.insurance_gbp) : null,
        maintenance_gbp: costs.maintenance_gbp ? Number(costs.maintenance_gbp) : null,
        compliance_gbp: costs.compliance_gbp ? Number(costs.compliance_gbp) : null,
        other_gbp: costs.other_gbp ? Number(costs.other_gbp) : null,
      }) : 0;

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
  }, [properties, passportMap]);

  // Lender exposure data
  const lenderData = useMemo(() => {
    if (!properties?.length) return [];

    const lenderMap: Record<string, number> = {};
    properties.forEach(property => {
      const loan = property.loans?.[0];
      if (loan?.lender && loan.current_mortgage_balance_gbp) {
        const lender = loan.lender;
        lenderMap[lender] = (lenderMap[lender] || 0) + Number(loan.current_mortgage_balance_gbp);
      }
    });

    return Object.entries(lenderMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [properties]);

  // Area exposure data
  const areaData = useMemo(() => {
    if (!properties?.length) return [];

    const areaMap: Record<string, number> = {};
    properties.forEach(property => {
      const area = property.area_name || 'Unknown';
      const value = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
      areaMap[area] = (areaMap[area] || 0) + value;
    });

    return Object.entries(areaMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [properties]);

  // Properties with coordinates for map
  const propertiesWithCoords = useMemo(() => {
    if (!properties?.length) return [];
    return properties.filter(p => p.latitude && p.longitude);
  }, [properties]);

  // UK center coordinates
  const mapCenter: [number, number] = [52.3555, -1.1743];

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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            {properties?.length || 0} properties in your portfolio
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Portfolio Value
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatGBP(portfolioStats.totalValue)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Mortgage
              </CardTitle>
              <PoundSterling className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatGBP(portfolioStats.totalMortgage)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Equity
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatGBP(portfolioStats.totalEquity)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average LTV
              </CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatPercent(portfolioStats.averageLTV)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Cashflow
              </CardTitle>
              <PoundSterling className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${portfolioStats.monthlyCashflow >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatGBP(portfolioStats.monthlyCashflow)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Portfolio Health */}
          {properties && properties.length > 0 && (
            <PortfolioHealthWidget properties={properties} />
          )}

          {/* Risks Panel */}
          <Card className={`bg-card border-border ${properties && properties.length > 0 ? '' : 'lg:col-span-1'}`}>
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
          {/* Property Map */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle>Property Map</CardTitle>
            </CardHeader>
            <CardContent>
              {propertiesWithCoords.length > 0 ? (
                <div className="h-[300px] rounded-lg overflow-hidden">
                  <MapContainer
                    center={mapCenter}
                    zoom={6}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {propertiesWithCoords.map(property => (
                      <Marker
                        key={property.id}
                        position={[Number(property.latitude), Number(property.longitude)]}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p className="font-medium">{property.address_line}</p>
                            <p className="text-muted-foreground">
                              {formatGBP(property.current_value_gbp ? Number(property.current_value_gbp) : null)}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
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
                        }}
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

          {/* Area Exposure */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Area Exposure</CardTitle>
            </CardHeader>
            <CardContent>
              {areaData.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={areaData.slice(0, 6)} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={100}
                        tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: number) => formatGBP(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(222 47% 8%)',
                          border: '1px solid hsl(220 25% 16%)',
                          borderRadius: '0.5rem',
                        }}
                      />
                      <Bar dataKey="value" fill="hsl(174, 72%, 45%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <p>Add properties to see geographic distribution</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stock Condition Section */}
        <StockConditionSection />

        {/* Recent Activity */}
        <RecentActivityWidget />
      </div>
    </AppLayout>
  );
}

export default DashboardPage;
