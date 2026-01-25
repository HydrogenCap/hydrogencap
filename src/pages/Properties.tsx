import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, ArrowUpDown, Eye, Settings2, Image } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProperties, PropertyWithFinancials } from '@/hooks/useProperties';
import { usePropertyPassports, type PropertyPassport } from '@/hooks/usePropertyPassport';
import { supabase } from '@/integrations/supabase/client';
import {
  formatGBP,
  formatGBPDecimal,
  formatPercent,
  formatDateUK,
  calculateLTV,
  calculateEquity,
  calculateTotalCosts,
  calculateNetRent,
  calculateYield,
  calculateMonthlyMortgagePayment,
  getLTVStatus,
  getExpiryStatus,
  daysUntil,
} from '@/lib/calculations';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';

// Column definitions in exact order
const COLUMNS = [
  { key: 'photo', label: 'Photo', defaultVisible: true },
  { key: 'address', label: 'Property Address', defaultVisible: true },
  { key: 'area', label: 'Area', defaultVisible: true },
  { key: 'ownership', label: 'Ownership', defaultVisible: true },
  { key: 'propertyType', label: 'Property Type', defaultVisible: true },
  { key: 'beds', label: 'Beds', defaultVisible: true },
  { key: 'value', label: 'Property Value', defaultVisible: true },
  { key: 'purchasePrice', label: 'Purchase Price', defaultVisible: true },
  { key: 'purchaseDate', label: 'Original Purchase Date', defaultVisible: false },
  { key: 'lender', label: 'Lender', defaultVisible: true },
  { key: 'interestRate', label: 'Interest Rate', defaultVisible: true },
  { key: 'fixedOrVariable', label: 'Fixed or Variable', defaultVisible: false },
  { key: 'mortgageType', label: 'Mortgage Type', defaultVisible: false },
  { key: 'capitalOrInterest', label: 'Capital / Interest', defaultVisible: false },
  { key: 'fixedRateExpires', label: 'Fixed Rate Expires', defaultVisible: true },
  { key: 'insuranceExpire', label: 'Insurance Expire', defaultVisible: false },
  { key: 'mortgageBalance', label: 'Current Mortgage Balance', defaultVisible: true },
  { key: 'mortgagePayment', label: 'Mortgage', defaultVisible: true },
  { key: 'rentalIncome', label: 'Rental Income', defaultVisible: true },
  { key: 'billsManagement', label: 'Bills & Management', defaultVisible: false },
  { key: 'netRent', label: 'Net Rent', defaultVisible: true },
  { key: 'yield', label: 'Yield', defaultVisible: true },
  { key: 'ltv', label: 'LTV', defaultVisible: true },
  { key: 'equity', label: 'Equity', defaultVisible: true },
] as const;

type ColumnKey = typeof COLUMNS[number]['key'];
type SortDirection = 'asc' | 'desc';

// Fetch photos for properties
function usePropertyPhotos() {
  return useQuery({
    queryKey: ['property_photos_covers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('property_id, file_url, is_cover')
        .eq('is_cover', true);
      
      if (error) throw error;
      
      // Create a map of property_id -> cover photo URL
      const photoMap = new Map<string, string>();
      data?.forEach(photo => {
        photoMap.set(photo.property_id, photo.file_url);
      });
      return photoMap;
    },
  });
}

// Fetch property ownership data
function usePropertyOwnerships() {
  return useQuery({
    queryKey: ['property_ownerships_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_ownership')
        .select(`
          property_id,
          ownership_percent,
          ownership_entity_id,
          ownership_entities(name)
        `);
      
      if (error) throw error;
      
      // Group by property_id
      const ownershipMap = new Map<string, Array<{ name: string; percent: number }>>();
      data?.forEach(row => {
        const list = ownershipMap.get(row.property_id) || [];
        list.push({
          name: (row.ownership_entities as any)?.name || 'Unknown',
          percent: Number(row.ownership_percent),
        });
        ownershipMap.set(row.property_id, list);
      });
      return ownershipMap;
    },
  });
}

function PropertiesPage() {
  const navigate = useNavigate();
  const { data: properties, isLoading, error } = useProperties();
  const { data: photoMap } = usePropertyPhotos();
  const { data: ownershipMap } = usePropertyOwnerships();
  const { data: passports } = usePropertyPassports();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<ColumnKey>('address');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  );

  // Create passport map for quick lookup
  const passportMap = useMemo(() => {
    const map = new Map<string, PropertyPassport>();
    passports?.forEach(p => map.set(p.property_id, p));
    return map;
  }, [passports]);

  const getPropertyMetrics = (property: PropertyWithFinancials) => {
    const currentYear = new Date().getFullYear();
    const loan = property.loans?.[0];
    const income = property.income?.find(i => i.year === currentYear);
    const costs = property.costs?.find(c => c.year === currentYear);

    const mortgageBalance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
    const currentValue = property.current_value_gbp ? Number(property.current_value_gbp) : null;
    const purchasePrice = property.purchase_price_gbp ? Number(property.purchase_price_gbp) : null;
    const annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
    
    const managementCost = costs?.management_gbp ? Number(costs.management_gbp) : 0;
    const billsCost = costs?.bills_gbp ? Number(costs.bills_gbp) : 0;
    const billsManagement = managementCost + billsCost;
    
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

    // Calculate effective monthly mortgage payment
    const mortgagePaymentResult = calculateMonthlyMortgagePayment({
      balance: mortgageBalance,
      interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
      termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
      isInterestOnly: loan?.capital_or_interest === 'interest',
      paymentOverride: loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : null,
    });

    return {
      mortgageBalance,
      currentValue,
      purchasePrice,
      annualRent,
      billsManagement,
      ltv,
      equity,
      netRent,
      yieldPercent,
      mortgagePayment: mortgagePaymentResult.effective,
      loan,
    };
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
        case 'propertyType':
          comparison = (a.property_type || '').localeCompare(b.property_type || '');
          break;
        case 'beds':
          comparison = (a.beds || 0) - (b.beds || 0);
          break;
        case 'value':
          comparison = (metricsA.currentValue || 0) - (metricsB.currentValue || 0);
          break;
        case 'purchasePrice':
          comparison = (metricsA.purchasePrice || 0) - (metricsB.purchasePrice || 0);
          break;
        case 'purchaseDate':
          comparison = (a.original_purchase_date || '').localeCompare(b.original_purchase_date || '');
          break;
        case 'lender':
          comparison = (metricsA.loan?.lender || '').localeCompare(metricsB.loan?.lender || '');
          break;
        case 'interestRate':
          comparison = (Number(metricsA.loan?.interest_rate_percent) || 0) - (Number(metricsB.loan?.interest_rate_percent) || 0);
          break;
        case 'fixedRateExpires':
          comparison = (metricsA.loan?.fixed_rate_expires || '').localeCompare(metricsB.loan?.fixed_rate_expires || '');
          break;
        case 'mortgageBalance':
          comparison = (metricsA.mortgageBalance || 0) - (metricsB.mortgageBalance || 0);
          break;
        case 'mortgagePayment':
          comparison = (metricsA.mortgagePayment || 0) - (metricsB.mortgagePayment || 0);
          break;
        case 'rentalIncome':
          comparison = (metricsA.annualRent || 0) - (metricsB.annualRent || 0);
          break;
        case 'netRent':
          comparison = (metricsA.netRent || 0) - (metricsB.netRent || 0);
          break;
        case 'yield':
          comparison = (metricsA.yieldPercent || 0) - (metricsB.yieldPercent || 0);
          break;
        case 'ltv':
          comparison = (metricsA.ltv || 0) - (metricsB.ltv || 0);
          break;
        case 'equity':
          comparison = (metricsA.equity || 0) - (metricsB.equity || 0);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [properties, searchQuery, sortField, sortDirection]);

  const handleSort = (field: ColumnKey) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const resetColumns = () => {
    setVisibleColumns(new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key)));
  };

  const SortableHeader = ({ field, children, align = 'left' }: { field: ColumnKey; children: React.ReactNode; align?: 'left' | 'right' }) => (
    <TableHead className={align === 'right' ? 'text-right' : ''}>
      <Button 
        variant="ghost" 
        size="sm" 
        className={`-ml-3 h-8 hover:bg-transparent ${align === 'right' ? 'ml-auto -mr-3' : ''}`}
        onClick={(e) => { e.stopPropagation(); handleSort(field); }}
      >
        {children}
        <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
      </Button>
    </TableHead>
  );

  const getExpiryBadge = (date: string | null | undefined) => {
    if (!date) return <span className="text-muted-foreground">—</span>;
    
    const status = getExpiryStatus(date);
    const days = daysUntil(date);
    
    let colorClass = 'text-success';
    if (status === 'expired') colorClass = 'text-destructive';
    else if (status === 'critical' || status === 'warning') colorClass = 'text-warning';
    
    return (
      <span className={colorClass}>
        {formatDateUK(date)}
      </span>
    );
  };

  const getLTVBadge = (ltv: number | null) => {
    if (ltv === null) return <span className="text-muted-foreground">—</span>;
    
    const status = getLTVStatus(ltv);
    let colorClass = '';
    if (status === 'danger') colorClass = 'text-destructive';
    else if (status === 'warning') colorClass = 'text-warning';
    
    return <span className={colorClass}>{formatPercent(ltv)}</span>;
  };

  const getOwnershipDisplay = (propertyId: string) => {
    const owners = ownershipMap?.get(propertyId);
    if (!owners || owners.length === 0) return <span className="text-muted-foreground">—</span>;
    
    const primary = owners[0];
    if (owners.length === 1) {
      return <span>{primary.name} – {primary.percent}%</span>;
    }
    return (
      <span>
        {primary.name} – {primary.percent}%
        <span className="text-muted-foreground ml-1">+ others</span>
      </span>
    );
  };

  const handleRowClick = (propertyId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on a button or link
    if ((e.target as HTMLElement).closest('button, a')) return;
    navigate(`/properties/${propertyId}`);
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

        {/* Search and Column Settings */}
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-y-auto">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.map(col => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleColumns.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={resetColumns}>
                Reset to Default
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="border-border hover:bg-transparent">
                    {visibleColumns.has('photo') && <TableHead className="w-16">Photo</TableHead>}
                    {visibleColumns.has('address') && <SortableHeader field="address">Address</SortableHeader>}
                    {visibleColumns.has('area') && <SortableHeader field="area">Area</SortableHeader>}
                    {visibleColumns.has('ownership') && <TableHead>Ownership</TableHead>}
                    {visibleColumns.has('propertyType') && <SortableHeader field="propertyType">Type</SortableHeader>}
                    {visibleColumns.has('beds') && <SortableHeader field="beds">Beds</SortableHeader>}
                    {visibleColumns.has('value') && <SortableHeader field="value" align="right">Value</SortableHeader>}
                    {visibleColumns.has('purchasePrice') && <SortableHeader field="purchasePrice" align="right">Purchase Price</SortableHeader>}
                    {visibleColumns.has('purchaseDate') && <SortableHeader field="purchaseDate">Purchase Date</SortableHeader>}
                    {visibleColumns.has('lender') && <SortableHeader field="lender">Lender</SortableHeader>}
                    {visibleColumns.has('interestRate') && <SortableHeader field="interestRate" align="right">Rate</SortableHeader>}
                    {visibleColumns.has('fixedOrVariable') && <TableHead>Fixed/Variable</TableHead>}
                    {visibleColumns.has('mortgageType') && <TableHead>Mortgage Type</TableHead>}
                    {visibleColumns.has('capitalOrInterest') && <TableHead>Capital/Interest</TableHead>}
                    {visibleColumns.has('fixedRateExpires') && <SortableHeader field="fixedRateExpires">Rate Expires</SortableHeader>}
                    {visibleColumns.has('insuranceExpire') && <TableHead>Insurance Expire</TableHead>}
                    {visibleColumns.has('mortgageBalance') && <SortableHeader field="mortgageBalance" align="right">Balance</SortableHeader>}
                    {visibleColumns.has('mortgagePayment') && <SortableHeader field="mortgagePayment" align="right">Mortgage/m</SortableHeader>}
                    {visibleColumns.has('rentalIncome') && <SortableHeader field="rentalIncome" align="right">Rent/yr</SortableHeader>}
                    {visibleColumns.has('billsManagement') && <TableHead className="text-right">Bills & Mgmt</TableHead>}
                    {visibleColumns.has('netRent') && <SortableHeader field="netRent" align="right">Net Rent</SortableHeader>}
                    {visibleColumns.has('yield') && <SortableHeader field="yield" align="right">Yield</SortableHeader>}
                    {visibleColumns.has('ltv') && <SortableHeader field="ltv" align="right">LTV</SortableHeader>}
                    {visibleColumns.has('equity') && <SortableHeader field="equity" align="right">Equity</SortableHeader>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedProperties.map((property) => {
                    const metrics = getPropertyMetrics(property);
                    const coverPhoto = photoMap?.get(property.id);
                    const passport = passportMap.get(property.id);
                    
                    // Get insurance expiry from passport if available
                    // For now we don't have insurance_expiry in passport, show placeholder
                    const insuranceExpiry = null; // TODO: Add to passport if needed
                    
                    return (
                      <TableRow 
                        key={property.id} 
                        className="border-border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={(e) => handleRowClick(property.id, e)}
                      >
                        {visibleColumns.has('photo') && (
                          <TableCell className="w-16 p-2">
                            {coverPhoto ? (
                              <img 
                                src={coverPhoto} 
                                alt="" 
                                className="w-12 h-12 object-cover rounded-md"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                                <Image className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.has('address') && (
                          <TableCell className="font-medium max-w-[200px]">
                            <span className="truncate block">{property.address_line}</span>
                            {property.postcode && (
                              <span className="text-xs text-muted-foreground">{property.postcode}</span>
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.has('area') && (
                          <TableCell className="text-muted-foreground">
                            {property.area_name || '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('ownership') && (
                          <TableCell className="max-w-[180px] truncate">
                            {getOwnershipDisplay(property.id)}
                          </TableCell>
                        )}
                        {visibleColumns.has('propertyType') && (
                          <TableCell className="text-muted-foreground">
                            {property.property_type || '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('beds') && (
                          <TableCell className="text-center">
                            {property.beds ?? '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('value') && (
                          <TableCell className="text-right font-medium">
                            {formatGBPDecimal(metrics.currentValue)}
                          </TableCell>
                        )}
                        {visibleColumns.has('purchasePrice') && (
                          <TableCell className="text-right text-muted-foreground">
                            {formatGBPDecimal(metrics.purchasePrice)}
                          </TableCell>
                        )}
                        {visibleColumns.has('purchaseDate') && (
                          <TableCell className="text-muted-foreground">
                            {formatDateUK(property.original_purchase_date)}
                          </TableCell>
                        )}
                        {visibleColumns.has('lender') && (
                          <TableCell className="text-muted-foreground">
                            {metrics.loan?.lender || '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('interestRate') && (
                          <TableCell className="text-right">
                            {metrics.loan?.interest_rate_percent 
                              ? `${Number(metrics.loan.interest_rate_percent).toFixed(2)}%` 
                              : '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('fixedOrVariable') && (
                          <TableCell className="text-muted-foreground capitalize">
                            {metrics.loan?.fixed_or_variable || '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('mortgageType') && (
                          <TableCell className="text-muted-foreground">
                            {metrics.loan?.mortgage_type || '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('capitalOrInterest') && (
                          <TableCell className="text-muted-foreground capitalize">
                            {metrics.loan?.capital_or_interest === 'interest' ? 'Interest-only' : 
                             metrics.loan?.capital_or_interest === 'repayment' ? 'Repayment' : '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('fixedRateExpires') && (
                          <TableCell>
                            {getExpiryBadge(metrics.loan?.fixed_rate_expires)}
                          </TableCell>
                        )}
                        {visibleColumns.has('insuranceExpire') && (
                          <TableCell>
                            {getExpiryBadge(insuranceExpiry)}
                          </TableCell>
                        )}
                        {visibleColumns.has('mortgageBalance') && (
                          <TableCell className="text-right text-muted-foreground">
                            {formatGBPDecimal(metrics.mortgageBalance)}
                          </TableCell>
                        )}
                        {visibleColumns.has('mortgagePayment') && (
                          <TableCell className="text-right">
                            {metrics.mortgagePayment !== null 
                              ? formatGBPDecimal(metrics.mortgagePayment)
                              : '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('rentalIncome') && (
                          <TableCell className="text-right">
                            {formatGBPDecimal(metrics.annualRent)}
                          </TableCell>
                        )}
                        {visibleColumns.has('billsManagement') && (
                          <TableCell className="text-right text-muted-foreground">
                            {formatGBPDecimal(metrics.billsManagement)}
                          </TableCell>
                        )}
                        {visibleColumns.has('netRent') && (
                          <TableCell className="text-right">
                            {metrics.netRent !== null ? (
                              <span className={metrics.netRent >= 0 ? 'text-success' : 'text-destructive'}>
                                {formatGBPDecimal(metrics.netRent)}
                              </span>
                            ) : '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('yield') && (
                          <TableCell className="text-right">
                            {metrics.yieldPercent !== null ? (
                              <span className={metrics.yieldPercent >= 0 ? 'text-success' : 'text-destructive'}>
                                {formatPercent(metrics.yieldPercent)}
                              </span>
                            ) : '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('ltv') && (
                          <TableCell className="text-right">
                            {getLTVBadge(metrics.ltv)}
                          </TableCell>
                        )}
                        {visibleColumns.has('equity') && (
                          <TableCell className="text-right font-medium text-primary">
                            {formatGBPDecimal(metrics.equity)}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

export default PropertiesPage;
