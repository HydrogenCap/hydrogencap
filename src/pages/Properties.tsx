import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, ArrowUpDown, Eye } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProperties, PropertyWithFinancials } from '@/hooks/useProperties';
import {
  formatGBP,
  formatPercent,
  calculateLTV,
  calculateEquity,
  calculateTotalCosts,
  calculateNetRent,
  calculateYield,
  calculateROCE,
  calculateHealthScore,
  calculateMonthlyMortgagePayment,
  calculateMonthlyCashflowAfterDebt,
  getLTVStatus,
  getEPCStatus,
  HealthScoreBreakdown,
} from '@/lib/calculations';
import { Skeleton } from '@/components/ui/skeleton';
import { HealthScoreBadge } from '@/components/property/HealthScoreBadge';

type SortField = 'address' | 'area' | 'value' | 'mortgage' | 'ltv' | 'yield' | 'roce' | 'health' | 'cashflow';
type SortDirection = 'asc' | 'desc';

function PropertiesPage() {
  const { data: properties, isLoading, error } = useProperties();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('health');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const getPropertyMetrics = (property: PropertyWithFinancials) => {
    const currentYear = new Date().getFullYear();
    const loan = property.loans?.[0];
    const income = property.income?.find(i => i.year === currentYear);
    const costs = property.costs?.find(c => c.year === currentYear);

    const mortgageBalance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
    const currentValue = property.current_value_gbp ? Number(property.current_value_gbp) : null;
    const annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
    const totalCosts = costs ? calculateTotalCosts({
      management_gbp: costs.management_gbp ? Number(costs.management_gbp) : null,
      bills_gbp: costs.bills_gbp ? Number(costs.bills_gbp) : null,
      insurance_gbp: costs.insurance_gbp ? Number(costs.insurance_gbp) : null,
      maintenance_gbp: costs.maintenance_gbp ? Number(costs.maintenance_gbp) : null,
      compliance_gbp: costs.compliance_gbp ? Number(costs.compliance_gbp) : null,
      other_gbp: costs.other_gbp ? Number(costs.other_gbp) : null,
    }) : 0;

    const ltv = calculateLTV(mortgageBalance, currentValue);
    const equity = calculateEquity(currentValue, mortgageBalance);
    const netRent = calculateNetRent(annualRent, totalCosts);
    const yieldPercent = calculateYield(netRent, currentValue);
    const roce = calculateROCE(netRent, equity);

    // Calculate effective monthly mortgage payment
    const mortgagePaymentResult = calculateMonthlyMortgagePayment({
      balance: mortgageBalance,
      interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
      termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
      isInterestOnly: loan?.capital_or_interest === 'interest',
      paymentOverride: loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : null,
    });
    const effectiveMortgagePayment = mortgagePaymentResult.effective;

    // Calculate monthly cashflow after debt
    const monthlyCashflow = calculateMonthlyCashflowAfterDebt(annualRent, totalCosts, effectiveMortgagePayment);

    // Calculate health score with proper mortgage payment
    const isInterestOnly = loan?.capital_or_interest === 'interest';
    const healthScore = calculateHealthScore({
      annualRent,
      totalCosts,
      mortgagePayment: effectiveMortgagePayment,
      ltv,
      fixedRateExpires: loan?.fixed_rate_expires || null,
      isInterestOnly,
      epcRating: property.epc_rating,
      epcRequired: property.epc_required !== false,
    });

    return { mortgageBalance, currentValue, ltv, equity, yieldPercent, roce, healthScore, monthlyCashflow };
  };

  const filteredAndSortedProperties = useMemo(() => {
    if (!properties) return [];

    let result = properties.filter(p => 
      p.address_line.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.area_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.postcode?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      const metricsA = getPropertyMetrics(a);
      const metricsB = getPropertyMetrics(b);

      let comparison = 0;
      switch (sortField) {
        case 'address':
          comparison = a.address_line.localeCompare(b.address_line);
          break;
        case 'area':
          comparison = (a.area_name || '').localeCompare(b.area_name || '');
          break;
        case 'value':
          comparison = (metricsA.currentValue || 0) - (metricsB.currentValue || 0);
          break;
        case 'mortgage':
          comparison = (metricsA.mortgageBalance || 0) - (metricsB.mortgageBalance || 0);
          break;
        case 'ltv':
          comparison = (metricsA.ltv || 0) - (metricsB.ltv || 0);
          break;
        case 'yield':
          comparison = (metricsA.yieldPercent || 0) - (metricsB.yieldPercent || 0);
          break;
        case 'roce':
          comparison = (metricsA.roce || 0) - (metricsB.roce || 0);
          break;
        case 'health':
          comparison = metricsA.healthScore.total - metricsB.healthScore.total;
          break;
        case 'cashflow':
          comparison = (metricsA.monthlyCashflow || 0) - (metricsB.monthlyCashflow || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [properties, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button 
      variant="ghost" 
      size="sm" 
      className="-ml-3 h-8 hover:bg-transparent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );

  const getLTVBadge = (ltv: number | null) => {
    const status = getLTVStatus(ltv);
    if (!ltv) return null;
    
    return (
      <Badge 
        variant="outline" 
        className={
          status === 'danger' ? 'status-danger border' :
          status === 'warning' ? 'status-warning border' :
          'text-foreground'
        }
      >
        {formatPercent(ltv)}
      </Badge>
    );
  };

  const getEPCBadge = (rating: string | null | undefined) => {
    const status = getEPCStatus(rating);
    if (!rating) return null;

    return (
      <Badge 
        variant="outline"
        className={status === 'warning' ? 'status-warning border' : 'text-foreground'}
      >
        {rating}
      </Badge>
    );
  };

  if (error) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-destructive">
          Error loading properties: {error.message}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Properties</h1>
            <p className="text-muted-foreground">
              {properties?.length || 0} properties in your portfolio
            </p>
          </div>
          <Button asChild>
            <Link to="/properties/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Link>
          </Button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by address, area, or postcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-input border-border"
            />
          </div>
        </div>

        {/* Properties Table */}
        {isLoading ? (
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : filteredAndSortedProperties.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {searchQuery ? 'No properties found' : 'No properties yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try a different search term' : 'Get started by adding your first property'}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <Link to="/properties/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Property
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead><SortButton field="address">Address</SortButton></TableHead>
                  <TableHead><SortButton field="area">Area</SortButton></TableHead>
                  <TableHead>Beds</TableHead>
                  <TableHead>Baths</TableHead>
                  <TableHead className="text-right"><SortButton field="value">Value</SortButton></TableHead>
                  <TableHead className="text-right"><SortButton field="mortgage">Mortgage</SortButton></TableHead>
                  <TableHead className="text-right"><SortButton field="ltv">LTV</SortButton></TableHead>
                  <TableHead className="text-right"><SortButton field="cashflow">Cashflow</SortButton></TableHead>
                  <TableHead><SortButton field="health">Health</SortButton></TableHead>
                  <TableHead>EPC</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedProperties.map((property) => {
                  const metrics = getPropertyMetrics(property);
                  
                  return (
                    <TableRow key={property.id} className="border-border">
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {property.address_line}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {property.area_name || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {property.beds ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {property.bathrooms ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatGBP(metrics.currentValue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatGBP(metrics.mortgageBalance)}
                      </TableCell>
                      <TableCell className="text-right">
                        {getLTVBadge(metrics.ltv)}
                      </TableCell>
                      <TableCell className="text-right">
                        {metrics.monthlyCashflow !== null ? (
                          <span className={metrics.monthlyCashflow >= 0 ? 'text-success' : 'text-destructive'}>
                            {formatGBP(metrics.monthlyCashflow)}/m
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <HealthScoreBadge score={metrics.healthScore} />
                      </TableCell>
                      <TableCell>
                        {getEPCBadge(property.epc_rating)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/properties/${property.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

export default PropertiesPage;
