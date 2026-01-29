import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addMonths, isBefore, parseISO } from 'date-fns';
import { Plus, Search, Building2, Eye, Settings2, Image, RotateCcw, ChevronDown, Edit2, Zap, Loader2, PoundSterling, Download, Upload } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useProperties, PropertyWithFinancials } from '@/hooks/useProperties';
import { usePropertyPassports, type PropertyPassport, calculatePassportCompleteness } from '@/hooks/usePropertyPassport';
import { Skeleton } from '@/components/ui/skeleton';
import { useBulkEpcEnrich } from '@/hooks/useBulkEpcEnrich';
import { useBulkPricePaidEnrich } from '@/hooks/useBulkPricePaidEnrich';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatGBP, formatGBPDecimal, formatPercent, formatDateUK } from '@/lib/calculations';
import { downloadCSV } from '@/lib/csvExporter';
import { useToast } from '@/hooks/use-toast';

// Extracted modules
import { 
  ALL_COLUMNS, 
  VIEW_PRESETS, 
  FILTER_LABELS,
  type ColumnKey, 
  type ViewPreset, 
  type SortDirection 
} from '@/lib/propertiesTableConfig';
import { getPropertyMetrics, calculatePropertyRisk, RISK_ORDER, type RiskLevel } from '@/lib/propertyMetrics';
import { usePropertyPhotos, useLegalOwnerCompanies } from '@/hooks/usePropertiesTableData';
import { 
  SortableHeader, 
  ExpiryBadge, 
  LTVBadge, 
  EPCBadge, 
  RiskBadge, 
  OwnershipDisplay,
  CashflowValue,
  MeterDisplay
} from '@/components/properties/PropertiesTableCells';

function PropertiesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: properties, isLoading, error } = useProperties();
  const { data: photoMap } = usePropertyPhotos();
  const { data: companyMap } = useLegalOwnerCompanies();
  const { data: passports } = usePropertyPassports();
  const { enrichAll: enrichEpc, isEnriching: isEnrichingEpc } = useBulkEpcEnrich();
  const { enrichAll: enrichPricePaid, isEnriching: isEnrichingPricePaid } = useBulkPricePaidEnrich();
  const { toast } = useToast();
  
  // Calculate properties missing data
  const propertiesMissingEpc = useMemo(() => {
    return properties?.filter(p => !p.epc_rating && p.postcode).length || 0;
  }, [properties]);
  
  const propertiesMissingPurchasePrice = useMemo(() => {
    return properties?.filter(p => !p.purchase_price_gbp && p.postcode).length || 0;
  }, [properties]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const activeFilter = searchParams.get('filter');

  const clearFilter = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);
  
  // Load saved view from localStorage
  const [activeView, setActiveView] = useState<ViewPreset>(() => {
    const saved = localStorage.getItem('properties_view');
    return (saved as ViewPreset) || 'default';
  });
  
  const [sortField, setSortField] = useState<ColumnKey>(() => {
    return VIEW_PRESETS[activeView].defaultSort || 'address';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    return VIEW_PRESETS[activeView].sortDir || 'asc';
  });
  
  // Column visibility per view (starts with preset columns)
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
    return new Set(VIEW_PRESETS[activeView].columns);
  });

  // Save view to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('properties_view', activeView);
  }, [activeView]);

  // Switch view preset
  const switchView = useCallback((view: ViewPreset) => {
    setActiveView(view);
    const preset = VIEW_PRESETS[view];
    setVisibleColumns(new Set(preset.columns));
    setSortField(preset.defaultSort || 'address');
    setSortDirection(preset.sortDir || 'asc');
  }, []);

  // Reset current view to preset defaults
  const resetView = useCallback(() => {
    const preset = VIEW_PRESETS[activeView];
    setVisibleColumns(new Set(preset.columns));
    setSortField(preset.defaultSort || 'address');
    setSortDirection(preset.sortDir || 'asc');
  }, [activeView]);

  // Create passport map for quick lookup
  const passportMap = useMemo(() => {
    const map = new Map<string, PropertyPassport>();
    passports?.forEach(p => map.set(p.property_id, p));
    return map;
  }, [passports]);

  // Helper to get ownership name for sorting
  const getOwnershipNameForSort = useCallback((property: PropertyWithFinancials): string => {
    if (property.legal_owner_company_id && companyMap) {
      return companyMap.get(property.legal_owner_company_id) || '';
    }
    return property.ownership_entity || '';
  }, [companyMap]);

  // Filter and sort properties - memoized with stable dependencies
  const filteredAndSortedProperties = useMemo(() => {
    if (!properties) return [];

    // First apply text search filter
    let result = properties.filter(p => 
      p.address_line.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.area_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.postcode?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Then apply URL-based filters
    if (activeFilter) {
      const now = new Date();
      result = result.filter(p => {
        const metrics = getPropertyMetrics(p);
        const passport = passportMap.get(p.id);
        
        switch (activeFilter) {
          case 'rate_expiry_3m': {
            const expiryDate = metrics.loan?.fixed_rate_expires;
            if (!expiryDate) return false;
            return isBefore(parseISO(expiryDate), addMonths(now, 3));
          }
          case 'rate_expiry_6m': {
            const expiryDate = metrics.loan?.fixed_rate_expires;
            if (!expiryDate) return false;
            return isBefore(parseISO(expiryDate), addMonths(now, 6));
          }
          case 'rate_expiry_12m': {
            const expiryDate = metrics.loan?.fixed_rate_expires;
            if (!expiryDate) return false;
            return isBefore(parseISO(expiryDate), addMonths(now, 12));
          }
          case 'ltv_above_75':
            return (metrics.ltv || 0) > 75;
          case 'ltv_above_85':
            return (metrics.ltv || 0) > 85;
          case 'epc_below_c': {
            const epc = p.epc_rating?.toUpperCase();
            return epc && ['D', 'E', 'F', 'G'].includes(epc);
          }
          case 'negative_cashflow':
            return (metrics.monthlyCashflow || 0) < 0;
          case 'missing_passport': {
            if (!passport) return true;
            return calculatePassportCompleteness(passport).percentage < 50;
          }
          default:
            return true;
        }
      });
    }

    // Sort
    result.sort((a, b) => {
      const metricsA = getPropertyMetrics(a);
      const metricsB = getPropertyMetrics(b);
      const passportA = passportMap.get(a.id);
      const passportB = passportMap.get(b.id);

      let comparison = 0;
      switch (sortField) {
        case 'address':
          comparison = a.address_line.localeCompare(b.address_line);
          break;
        case 'area':
          comparison = (a.area_name || '').localeCompare(b.area_name || '');
          break;
        case 'ownership':
          comparison = getOwnershipNameForSort(a).localeCompare(getOwnershipNameForSort(b));
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
        case 'monthlyCashflow':
          comparison = (metricsA.monthlyCashflow || 0) - (metricsB.monthlyCashflow || 0);
          break;
        case 'riskStatus': {
          const riskA = calculatePropertyRisk(a, passportA, metricsA);
          const riskB = calculatePropertyRisk(b, passportB, metricsB);
          comparison = RISK_ORDER[riskA.level] - RISK_ORDER[riskB.level];
          break;
        }
        case 'hmoLicenceExpiry':
          comparison = (passportA?.hmo_licence_expiry || '').localeCompare(passportB?.hmo_licence_expiry || '');
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [properties, searchQuery, sortField, sortDirection, passportMap, activeFilter, getOwnershipNameForSort]);

  const handleSort = useCallback((field: ColumnKey) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const toggleColumn = useCallback((key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleRowClick = useCallback((propertyId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    navigate(`/properties/${propertyId}`);
  }, [navigate]);

  const handleDownloadCSV = useCallback(() => {
    if (!properties || properties.length === 0) {
      toast({
        title: 'No properties to export',
        description: 'Add some properties first before exporting.',
        variant: 'destructive',
      });
      return;
    }
    const filename = `properties-export-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(properties, filename);
    toast({
      title: 'Export complete',
      description: `Downloaded ${properties.length} properties to ${filename}`,
    });
  }, [properties, toast]);

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
          <div className="flex items-center gap-2">
            {propertiesMissingEpc > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={() => enrichEpc('missing-only')}
                      disabled={isEnrichingEpc || isEnrichingPricePaid}
                      className="gap-2"
                    >
                      {isEnrichingEpc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      {isEnrichingEpc ? 'Enriching...' : `Enrich EPC (${propertiesMissingEpc})`}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Fetch EPC ratings from gov.uk for {propertiesMissingEpc} properties missing data</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {propertiesMissingPurchasePrice > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      onClick={() => enrichPricePaid('missing-only')}
                      disabled={isEnrichingEpc || isEnrichingPricePaid}
                      className="gap-2"
                    >
                      {isEnrichingPricePaid ? <Loader2 className="h-4 w-4 animate-spin" /> : <PoundSterling className="h-4 w-4" />}
                      {isEnrichingPricePaid ? 'Enriching...' : `Price Paid (${propertiesMissingPurchasePrice})`}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Fetch historical sold prices from Land Registry for {propertiesMissingPurchasePrice} properties</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={handleDownloadCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download all properties as CSV for editing</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" asChild>
                    <Link to="/import">
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Import or update properties from CSV</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button asChild>
              <Link to="/properties/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Link>
            </Button>
          </div>
        </div>

        {/* View Switcher + Search + Column Settings */}
        <div className="flex flex-wrap items-center gap-4">
          {/* View Preset Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-[180px] justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {VIEW_PRESETS[activeView].label}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Table Views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={activeView} onValueChange={(v) => switchView(v as ViewPreset)}>
                <DropdownMenuRadioItem value="default">Default (Sheet View)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="finance">Finance View</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="risk">Risk View</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ops">Ops View</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetView}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by address, area, or postcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-input border-border"
            />
          </div>
          
          {/* Column Settings */}
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
              {ALL_COLUMNS.map(col => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleColumns.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={resetView}>
                Reset to Preset
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active Filter Banner */}
        {activeFilter && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Filtering by:</span>
              <Badge variant="secondary">{FILTER_LABELS[activeFilter] || activeFilter}</Badge>
              <span className="text-muted-foreground">
                ({filteredAndSortedProperties.length} {filteredAndSortedProperties.length === 1 ? 'property' : 'properties'})
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilter}>
              Clear filter
            </Button>
          </div>
        )}

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
                    {visibleColumns.has('address') && <SortableHeader field="address" onSort={handleSort}>Address</SortableHeader>}
                    {visibleColumns.has('area') && <SortableHeader field="area" onSort={handleSort}>Area</SortableHeader>}
                    {visibleColumns.has('ownership') && <SortableHeader field="ownership" onSort={handleSort}>Ownership</SortableHeader>}
                    {visibleColumns.has('propertyType') && <SortableHeader field="propertyType" onSort={handleSort}>Type</SortableHeader>}
                    {visibleColumns.has('beds') && <SortableHeader field="beds" onSort={handleSort}>Beds</SortableHeader>}
                    {visibleColumns.has('value') && <SortableHeader field="value" align="right" onSort={handleSort}>Value</SortableHeader>}
                    {visibleColumns.has('purchasePrice') && <SortableHeader field="purchasePrice" align="right" onSort={handleSort}>Purchase Price</SortableHeader>}
                    {visibleColumns.has('purchaseDate') && <SortableHeader field="purchaseDate" onSort={handleSort}>Purchase Date</SortableHeader>}
                    {visibleColumns.has('lender') && <SortableHeader field="lender" onSort={handleSort}>Lender</SortableHeader>}
                    {visibleColumns.has('interestRate') && <SortableHeader field="interestRate" align="right" onSort={handleSort}>Rate</SortableHeader>}
                    {visibleColumns.has('fixedOrVariable') && <TableHead>Fixed/Variable</TableHead>}
                    {visibleColumns.has('mortgageType') && <TableHead>Mortgage Type</TableHead>}
                    {visibleColumns.has('capitalOrInterest') && <TableHead>Capital/Interest</TableHead>}
                    {visibleColumns.has('fixedRateExpires') && <SortableHeader field="fixedRateExpires" onSort={handleSort}>Rate Expires</SortableHeader>}
                    {visibleColumns.has('insuranceExpire') && <TableHead>Insurance Expire</TableHead>}
                    {visibleColumns.has('mortgageBalance') && <SortableHeader field="mortgageBalance" align="right" onSort={handleSort}>Balance</SortableHeader>}
                    {visibleColumns.has('mortgagePayment') && <SortableHeader field="mortgagePayment" align="right" onSort={handleSort}>Mortgage/m</SortableHeader>}
                    {visibleColumns.has('rentalIncome') && <SortableHeader field="rentalIncome" align="right" onSort={handleSort}>Rent/yr</SortableHeader>}
                    {visibleColumns.has('billsManagement') && <TableHead className="text-right">Bills & Mgmt</TableHead>}
                    {visibleColumns.has('netRent') && <SortableHeader field="netRent" align="right" onSort={handleSort}>Net Rent</SortableHeader>}
                    {visibleColumns.has('yield') && <SortableHeader field="yield" align="right" onSort={handleSort}>Yield</SortableHeader>}
                    {visibleColumns.has('ltv') && <SortableHeader field="ltv" align="right" onSort={handleSort}>LTV</SortableHeader>}
                    {visibleColumns.has('equity') && <SortableHeader field="equity" align="right" onSort={handleSort}>Equity</SortableHeader>}
                    {visibleColumns.has('epc') && <TableHead>EPC</TableHead>}
                    {visibleColumns.has('monthlyCashflow') && <SortableHeader field="monthlyCashflow" align="right" onSort={handleSort}>Cashflow/m</SortableHeader>}
                    {visibleColumns.has('riskStatus') && <SortableHeader field="riskStatus" onSort={handleSort}>Risk</SortableHeader>}
                    {visibleColumns.has('keysafeCode') && <TableHead>Keysafe</TableHead>}
                    {visibleColumns.has('waterStopTap') && <TableHead>Stop Tap</TableHead>}
                    {visibleColumns.has('electricMeter') && <TableHead>Electric Meter</TableHead>}
                    {visibleColumns.has('gasMeter') && <TableHead>Gas Meter</TableHead>}
                    {visibleColumns.has('waterMeter') && <TableHead>Water Meter</TableHead>}
                    {visibleColumns.has('constructionDateBand') && <TableHead>Construction</TableHead>}
                    {visibleColumns.has('hmoLicenceNumber') && <TableHead>HMO #</TableHead>}
                    {visibleColumns.has('hmoLicenceExpiry') && <SortableHeader field="hmoLicenceExpiry" onSort={handleSort}>HMO Expiry</SortableHeader>}
                    {visibleColumns.has('managementCompany') && <TableHead>Mgmt Co.</TableHead>}
                    {visibleColumns.has('actions') && <TableHead className="w-24 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedProperties.map((property) => {
                    const metrics = getPropertyMetrics(property);
                    const coverPhoto = photoMap?.get(property.id);
                    const passport = passportMap.get(property.id);
                    const risk = calculatePropertyRisk(property, passport, metrics);
                    
                    return (
                      <TableRow 
                        key={property.id} 
                        className="border-border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={(e) => handleRowClick(property.id, e)}
                      >
                        {visibleColumns.has('photo') && (
                          <TableCell className="w-16 p-2">
                            {coverPhoto ? (
                              <img src={coverPhoto} alt="" className="w-12 h-12 object-cover rounded-md" />
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
                          <TableCell className="text-muted-foreground">{property.area_name || '—'}</TableCell>
                        )}
                        {visibleColumns.has('ownership') && (
                          <TableCell className="max-w-[180px] truncate">
                            <OwnershipDisplay property={property} companyMap={companyMap} />
                          </TableCell>
                        )}
                        {visibleColumns.has('propertyType') && (
                          <TableCell className="text-muted-foreground">{property.property_type || '—'}</TableCell>
                        )}
                        {visibleColumns.has('beds') && (
                          <TableCell className="text-center">{property.beds ?? '—'}</TableCell>
                        )}
                        {visibleColumns.has('value') && (
                          <TableCell className="text-right font-medium">{formatGBPDecimal(metrics.currentValue)}</TableCell>
                        )}
                        {visibleColumns.has('purchasePrice') && (
                          <TableCell className="text-right text-muted-foreground">{formatGBPDecimal(metrics.purchasePrice)}</TableCell>
                        )}
                        {visibleColumns.has('purchaseDate') && (
                          <TableCell className="text-muted-foreground">{formatDateUK(property.original_purchase_date)}</TableCell>
                        )}
                        {visibleColumns.has('lender') && (
                          <TableCell className="text-muted-foreground">{metrics.loan?.lender || '—'}</TableCell>
                        )}
                        {visibleColumns.has('interestRate') && (
                          <TableCell className="text-right">
                            {metrics.loan?.interest_rate_percent ? `${Number(metrics.loan.interest_rate_percent).toFixed(2)}%` : '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('fixedOrVariable') && (
                          <TableCell className="text-muted-foreground capitalize">{metrics.loan?.fixed_or_variable || '—'}</TableCell>
                        )}
                        {visibleColumns.has('mortgageType') && (
                          <TableCell className="text-muted-foreground">{metrics.loan?.mortgage_type || '—'}</TableCell>
                        )}
                        {visibleColumns.has('capitalOrInterest') && (
                          <TableCell className="text-muted-foreground capitalize">
                            {metrics.loan?.capital_or_interest === 'interest' ? 'Interest-only' : 
                             metrics.loan?.capital_or_interest === 'repayment' ? 'Repayment' : '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('fixedRateExpires') && (
                          <TableCell><ExpiryBadge date={metrics.loan?.fixed_rate_expires} /></TableCell>
                        )}
                        {visibleColumns.has('insuranceExpire') && (
                          <TableCell><ExpiryBadge date={null} /></TableCell>
                        )}
                        {visibleColumns.has('mortgageBalance') && (
                          <TableCell className="text-right text-muted-foreground">{formatGBPDecimal(metrics.mortgageBalance)}</TableCell>
                        )}
                        {visibleColumns.has('mortgagePayment') && (
                          <TableCell className="text-right">
                            {metrics.mortgagePayment !== null ? formatGBPDecimal(metrics.mortgagePayment) : '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('rentalIncome') && (
                          <TableCell className="text-right">{formatGBPDecimal(metrics.annualRent)}</TableCell>
                        )}
                        {visibleColumns.has('billsManagement') && (
                          <TableCell className="text-right text-muted-foreground">{formatGBPDecimal(metrics.billsManagement)}</TableCell>
                        )}
                        {visibleColumns.has('netRent') && (
                          <TableCell className="text-right"><CashflowValue value={metrics.netRent} /></TableCell>
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
                          <TableCell className="text-right"><LTVBadge ltv={metrics.ltv} /></TableCell>
                        )}
                        {visibleColumns.has('equity') && (
                          <TableCell className="text-right font-medium text-primary">{formatGBPDecimal(metrics.equity)}</TableCell>
                        )}
                        {visibleColumns.has('epc') && (
                          <TableCell><EPCBadge rating={property.epc_rating} required={property.epc_required} /></TableCell>
                        )}
                        {visibleColumns.has('monthlyCashflow') && (
                          <TableCell className="text-right"><CashflowValue value={metrics.monthlyCashflow} /></TableCell>
                        )}
                        {visibleColumns.has('riskStatus') && (
                          <TableCell><RiskBadge level={risk.level} issues={risk.issues} /></TableCell>
                        )}
                        {visibleColumns.has('keysafeCode') && (
                          <TableCell className={passport?.keysafe_code ? '' : 'text-destructive'}>
                            {passport?.keysafe_code || 'Missing'}
                          </TableCell>
                        )}
                        {visibleColumns.has('waterStopTap') && (
                          <TableCell className={passport?.water_stop_tap_location ? 'text-muted-foreground' : 'text-warning'}>
                            {passport?.water_stop_tap_location || 'Missing'}
                          </TableCell>
                        )}
                        {visibleColumns.has('electricMeter') && (
                          <TableCell className="text-muted-foreground text-xs max-w-[120px]">
                            <MeterDisplay location={passport?.electric_meter_location} number={passport?.electric_meter_number} />
                          </TableCell>
                        )}
                        {visibleColumns.has('gasMeter') && (
                          <TableCell className="text-muted-foreground text-xs max-w-[120px]">
                            <MeterDisplay location={passport?.gas_meter_location} number={passport?.gas_meter_number} />
                          </TableCell>
                        )}
                        {visibleColumns.has('waterMeter') && (
                          <TableCell className="text-muted-foreground text-xs max-w-[120px]">
                            <MeterDisplay location={passport?.water_meter_location} number={passport?.water_meter_number} />
                          </TableCell>
                        )}
                        {visibleColumns.has('constructionDateBand') && (
                          <TableCell className="text-muted-foreground">
                            {passport?.construction_date_band || passport?.built_in_year || '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('hmoLicenceNumber') && (
                          <TableCell className="text-muted-foreground">{passport?.hmo_licence_number || '—'}</TableCell>
                        )}
                        {visibleColumns.has('hmoLicenceExpiry') && (
                          <TableCell><ExpiryBadge date={passport?.hmo_licence_expiry} /></TableCell>
                        )}
                        {visibleColumns.has('managementCompany') && (
                          <TableCell className="text-muted-foreground max-w-[150px] truncate">
                            {passport?.property_management_company || '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('actions') && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                <Link to={`/properties/${property.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                <Link to={`/properties/${property.id}/edit`}>
                                  <Edit2 className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
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
