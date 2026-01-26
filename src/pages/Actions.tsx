import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  ArrowUpDown, 
  Building2, 
  ChevronRight,
  Filter,
  Search,
  TrendingDown,
  Percent,
  Zap,
  Home,
  FileWarning,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProperties } from '@/hooks/useProperties';
import { useAllCompliance } from '@/hooks/useCompliance';
import { 
  calculateLTV, 
  getLTVStatus, 
  formatPercent, 
  getExpiryStatus, 
  daysUntil, 
  getEPCStatus,
  getEffectiveCosts,
  calculateMonthlyMortgagePayment 
} from '@/lib/calculations';

type RiskType = 'all' | 'ltv' | 'epc' | 'rate_expiry' | 'cashflow' | 'hmo' | 'operational';
type SeverityFilter = 'all' | 'critical' | 'warning';
type SortField = 'severity' | 'type' | 'address';
type SortDir = 'asc' | 'desc';

interface RiskItem {
  id: string;
  propertyId: string;
  address: string;
  type: 'ltv' | 'epc' | 'rate_expiry' | 'cashflow' | 'hmo' | 'operational';
  severity: 'critical' | 'warning';
  message: string;
}

const riskTypeLabels: Record<RiskItem['type'], string> = {
  ltv: 'LTV Risk',
  epc: 'EPC Risk',
  rate_expiry: 'Rate Expiry',
  cashflow: 'Negative Cashflow',
  hmo: 'HMO Licence',
  operational: 'Missing Data',
};

const riskTypeIcons: Record<RiskItem['type'], React.ReactNode> = {
  ltv: <Percent className="h-4 w-4" />,
  epc: <Zap className="h-4 w-4" />,
  rate_expiry: <TrendingDown className="h-4 w-4" />,
  cashflow: <TrendingDown className="h-4 w-4" />,
  hmo: <Home className="h-4 w-4" />,
  operational: <FileWarning className="h-4 w-4" />,
};

export default function ActionsPage() {
  const { data: properties, isLoading: loadingProperties } = useProperties();
  const { data: complianceItems, isLoading: loadingCompliance } = useAllCompliance();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<RiskType>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Build compliance map by property
  const complianceByPropertyMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof complianceItems>>();
    complianceItems?.forEach(item => {
      const existing = map.get(item.property_id) || [];
      existing.push(item);
      map.set(item.property_id, existing);
    });
    return map;
  }, [complianceItems]);

  // Get only core rental properties
  const coreRentalProperties = useMemo(() => {
    return properties?.filter(p => p.lifecycle_type === 'core_rental') || [];
  }, [properties]);

  // Calculate all risks (same logic as Dashboard)
  const risks = useMemo<RiskItem[]>(() => {
    if (!coreRentalProperties?.length) return [];

    const riskItems: RiskItem[] = [];
    const currentYear = new Date().getFullYear();

    coreRentalProperties.forEach(property => {
      const loan = property.loans?.[0];
      const income = property.income?.find(i => i.year === currentYear);
      const costs = property.costs?.find(c => c.year === currentYear);
      const propertyComplianceItems = complianceByPropertyMap.get(property.id) || [];

      const value = property.current_value_gbp ? Number(property.current_value_gbp) : null;
      const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
      const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
      
      const effectiveCostsRisk = getEffectiveCosts(rent, value, costs);
      const totalCosts = effectiveCostsRisk.total;

      const mortgagePaymentResult = calculateMonthlyMortgagePayment({
        balance: mortgage,
        interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
        termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
        isInterestOnly: loan?.capital_or_interest === 'interest',
        paymentOverride: loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : null,
      });

      const ltv = calculateLTV(mortgage, value);
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

      // EPC risks
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

      // Negative cashflow
      if (annualCashflowAfterDebt !== null && annualCashflowAfterDebt < 0) {
        riskItems.push({
          id: `cashflow-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'cashflow',
          severity: 'warning',
          message: `Negative cashflow: £${Math.abs(Math.round(annualCashflowAfterDebt)).toLocaleString()}/yr`,
        });
      }

      // HMO licence risks - use compliance_items as source of truth
      if (property.is_hmo_licensed) {
        const hmoItem = propertyComplianceItems.find(item => 
          item.compliance_type.toLowerCase().replace(/\s+/g, '_') === 'hmo_licence' ||
          item.compliance_type === 'HMO Licence'
        );
        
        if (!hmoItem || !hmoItem.expiry_date) {
          riskItems.push({
            id: `hmo-${property.id}`,
            propertyId: property.id,
            address: property.address_line,
            type: 'hmo',
            severity: 'critical',
            message: 'HMO licence required but missing',
          });
        } else {
          const expiry = new Date(hmoItem.expiry_date);
          const now = new Date();
          const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry <= 0) {
            riskItems.push({
              id: `hmo-${property.id}`,
              propertyId: property.id,
              address: property.address_line,
              type: 'hmo',
              severity: 'critical',
              message: 'HMO licence has expired',
            });
          } else if (daysUntilExpiry <= 60) {
            riskItems.push({
              id: `hmo-${property.id}`,
              propertyId: property.id,
              address: property.address_line,
              type: 'hmo',
              severity: 'warning',
              message: `HMO licence expires in ${daysUntilExpiry} days`,
            });
          }
        }
      }

      // Missing operational data
      const criticalMissing: string[] = [];
      if (!property.current_value_gbp) criticalMissing.push('Value');
      if (!rent) criticalMissing.push('Rent');
      if (!mortgage && loan) criticalMissing.push('Mortgage Balance');
      
      if (criticalMissing.length > 0) {
        riskItems.push({
          id: `operational-${property.id}`,
          propertyId: property.id,
          address: property.address_line,
          type: 'operational',
          severity: 'warning',
          message: `Missing: ${criticalMissing.join(', ')}`,
        });
      }
    });

    return riskItems;
  }, [coreRentalProperties, complianceByPropertyMap]);

  // Apply filters and sorting
  const filteredRisks = useMemo(() => {
    let result = [...risks];

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(r => 
        r.address.toLowerCase().includes(searchLower) ||
        r.message.toLowerCase().includes(searchLower)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(r => r.type === typeFilter);
    }

    // Severity filter
    if (severityFilter !== 'all') {
      result = result.filter(r => r.severity === severityFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'severity') {
        cmp = a.severity === 'critical' ? -1 : b.severity === 'critical' ? 1 : 0;
      } else if (sortField === 'type') {
        cmp = riskTypeLabels[a.type].localeCompare(riskTypeLabels[b.type]);
      } else if (sortField === 'address') {
        cmp = a.address.localeCompare(b.address);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [risks, search, typeFilter, severityFilter, sortField, sortDir]);

  const criticalCount = risks.filter(r => r.severity === 'critical').length;
  const warningCount = risks.filter(r => r.severity === 'warning').length;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const isLoading = loadingProperties || loadingCompliance;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Action Required</h1>
          <p className="text-muted-foreground">
            Review and resolve portfolio risks and compliance issues
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Critical</p>
                  <p className="text-3xl font-bold text-destructive">{criticalCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-warning/10 border-warning/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Warning</p>
                  <p className="text-3xl font-bold text-warning">{warningCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50 border-border">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Issues</p>
                  <p className="text-3xl font-bold text-foreground">{risks.length}</p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search address or issue..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={typeFilter} onValueChange={v => setTypeFilter(v as RiskType)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Issue Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ltv">LTV Risk</SelectItem>
                  <SelectItem value="epc">EPC Risk</SelectItem>
                  <SelectItem value="rate_expiry">Rate Expiry</SelectItem>
                  <SelectItem value="cashflow">Negative Cashflow</SelectItem>
                  <SelectItem value="hmo">HMO Licence</SelectItem>
                  <SelectItem value="operational">Missing Data</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={v => setSeverityFilter(v as SeverityFilter)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical Only</SelectItem>
                  <SelectItem value="warning">Warning Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        {filteredRisks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-success/10">
                  <AlertTriangle className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">No Actions Required</h3>
                  <p className="text-sm text-muted-foreground">
                    {risks.length === 0 
                      ? 'Your portfolio is healthy with no identified risks.'
                      : 'No results match your current filters.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleSort('severity')}
                      className="h-auto p-0 font-medium hover:bg-transparent"
                    >
                      Severity
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleSort('type')}
                      className="h-auto p-0 font-medium hover:bg-transparent"
                    >
                      Type
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleSort('address')}
                      className="h-auto p-0 font-medium hover:bg-transparent"
                    >
                      Property
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRisks.map(risk => (
                  <TableRow key={risk.id}>
                    <TableCell>
                      <Badge 
                        variant={risk.severity === 'critical' ? 'destructive' : 'outline'}
                        className={risk.severity === 'warning' ? 'border-warning text-warning bg-warning/10' : ''}
                      >
                        {risk.severity === 'critical' ? 'Critical' : 'Warning'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {riskTypeIcons[risk.type]}
                        </span>
                        <span className="font-medium">{riskTypeLabels[risk.type]}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{risk.address}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{risk.message}</span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/properties/${risk.propertyId}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
