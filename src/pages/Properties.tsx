// DEPRECATED: Redirected to V2 (PropertiesV2). Safe to delete after confirming V2 is stable.
import React, { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addMonths, isBefore, parseISO } from 'date-fns';
import { Plus, Search, Building2, Eye, Settings2, Image, RotateCcw, ChevronDown, Edit2, Zap, Loader2, PoundSterling, Download, Upload, AlertTriangle } from 'lucide-react';
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
import { useUnitUsage } from '@/hooks/useUnitUsage';

// Extracted modules
import { 
  ALL_COLUMNS, 
  VIEW_PRESETS, 
  FILTER_LABELS,
  type ColumnKey, 
  type ViewPreset, 
  type SortDirection 
} from '@/lib/propertiesTableConfig';
import { getPropertyMetrics, calculatePropertyRisk, RISK_ORDER, type RiskLevel, type PropertyMetrics } from '@/lib/propertyMetrics';
import { calculatePortfolioStats } from '@/lib/portfolioStats';
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
import { PortfolioTotalsRow } from '@/components/properties/PortfolioTotalsRow';
import { PortfolioMetricsFooter } from '@/components/properties/PortfolioMetricsFooter';
import { PropertyTableRow } from '@/components/properties/PropertyTableRow';

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
  const { atLimit, totalUnits, limit } = useUnitUsage();
  
  // Calculate properties missing data
  const propertiesMissingEpc = useMemo(() => {
    return properties?.filter(p => !p.epc_rating && p.postcode).length || 0;
  }, [properties]);
  
  const propertiesMissingPurchasePrice = useMemo(() => {
    return properties?.filter(p => !p.purchase_price_gbp && p.postcode).length || 0;
  }, [properties]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
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

  // Create metrics map for quick lookup and portfolio stats
  const { metricsMap, portfolioStats } = useMemo(() => {
    if (!properties) return { metricsMap: new Map<string, PropertyMetrics>(), portfolioStats: calculatePortfolioStats([], new Map()) };
    
    const map = new Map<string, PropertyMetrics>();
    properties.forEach(p => {
      map.set(p.id, getPropertyMetrics(p));
    });
    
    return {
      metricsMap: map,
      portfolioStats: calculatePortfolioStats(properties, map),
    };
  }, [properties]);

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
      p.address_line.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      p.area_name?.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      p.postcode?.toLowerCase().includes(deferredSearch.toLowerCase())
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
        case 'fixedOrVariable':
          comparison = (metricsA.loan?.fixed_or_variable || '').localeCompare(metricsB.loan?.fixed_or_variable || '');
          break;
        case 'mortgageType':
          comparison = (metricsA.loan?.mortgage_type || '').localeCompare(metricsB.loan?.mortgage_type || '');
          break;
        case 'capitalOrInterest':
          comparison = (metricsA.loan?.capital_or_interest || '').localeCompare(metricsB.loan?.capital_or_interest || '');
          break;
        case 'fixedRateExpires':
          comparison = (metricsA.loan?.fixed_rate_expires || '').localeCompare(metricsB.loan?.fixed_rate_expires || '');
          break;
        case 'insuranceExpire':
          // Insurance expiry from insurance_policies table if available (null fallback for now)
          comparison = 0;
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
        case 'billsManagement':
          comparison = (metricsA.billsManagement || 0) - (metricsB.billsManagement || 0);
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
        case 'epc':
          comparison = (a.epc_rating || '').localeCompare(b.epc_rating || '');
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
        case 'keysafeCode':
          comparison = (passportA?.keysafe_code || '').localeCompare(passportB?.keysafe_code || '');
          break;
        case 'waterStopTap':
          comparison = (passportA?.water_stop_tap_location || '').localeCompare(passportB?.water_stop_tap_location || '');
          break;
        case 'electricMeter':
          comparison = (passportA?.electric_meter_location || '').localeCompare(passportB?.electric_meter_location || '');
          break;
        case 'gasMeter':
          comparison = (passportA?.gas_meter_location || '').localeCompare(passportB?.gas_meter_location || '');
          break;
        case 'waterMeter':
          comparison = (passportA?.water_meter_location || '').localeCompare(passportB?.water_meter_location || '');
          break;
        case 'constructionDateBand':
          comparison = (passportA?.construction_date_band || passportA?.built_in_year?.toString() || '').localeCompare(
            passportB?.construction_date_band || passportB?.built_in_year?.toString() || ''
          );
          break;
        case 'hmoLicenceNumber':
          comparison = (passportA?.hmo_licence_number || '').localeCompare(passportB?.hmo_licence_number || '');
          break;
        case 'hmoLicenceExpiry':
          comparison = (passportA?.hmo_licence_expiry || '').localeCompare(passportB?.hmo_licence_expiry || '');
          break;
        case 'managementCompany':
          comparison = (passportA?.management_company_id || passportA?.management_company_text || '').localeCompare(
            passportB?.management_company_id || passportB?.management_company_text || ''
          );
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [properties, deferredSearch, sortField, sortDirection, passportMap, activeFilter, getOwnershipNameForSort]);

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
            <Button asChild={!atLimit} disabled={atLimit} title={atLimit ? `Plan limit reached (${totalUnits}/${limit === Infinity ? '∞' : limit} units)` : undefined}>
              {atLimit ? (
                <span><Plus className="h-4 w-4 mr-2" />Add Property</span>
              ) : (
                <Link to="/properties/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Link>
              )}
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
              aria-label="Search properties"
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
        ) : error ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-lg font-semibold mb-2">Failed to load properties</h2>
              <p className="text-muted-foreground mb-4">{error?.message}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
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
              {!searchQuery && !atLimit && (
                <Button asChild>
                  <Link to="/properties/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Property
                  </Link>
                </Button>
              )}
              {!searchQuery && atLimit && (
                <p className="text-sm text-muted-foreground">
                  You've reached your plan limit ({totalUnits}/{limit === Infinity ? '∞' : limit} units).{' '}
                  <Link to="/settings" className="underline font-medium text-primary">Upgrade your plan</Link>
                </p>
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
                    {visibleColumns.has('fixedOrVariable') && <SortableHeader field="fixedOrVariable" onSort={handleSort}>Fixed/Variable</SortableHeader>}
                    {visibleColumns.has('mortgageType') && <SortableHeader field="mortgageType" onSort={handleSort}>Mortgage Type</SortableHeader>}
                    {visibleColumns.has('capitalOrInterest') && <SortableHeader field="capitalOrInterest" onSort={handleSort}>Capital/Interest</SortableHeader>}
                    {visibleColumns.has('fixedRateExpires') && <SortableHeader field="fixedRateExpires" onSort={handleSort}>Rate Expires</SortableHeader>}
                    {visibleColumns.has('insuranceExpire') && <SortableHeader field="insuranceExpire" onSort={handleSort}>Insurance Expire</SortableHeader>}
                    {visibleColumns.has('mortgageBalance') && <SortableHeader field="mortgageBalance" align="right" onSort={handleSort}>Balance</SortableHeader>}
                    {visibleColumns.has('mortgagePayment') && <SortableHeader field="mortgagePayment" align="right" onSort={handleSort}>Mortgage/m</SortableHeader>}
                    {visibleColumns.has('rentalIncome') && <SortableHeader field="rentalIncome" align="right" onSort={handleSort}>Rent/yr</SortableHeader>}
                    {visibleColumns.has('billsManagement') && <SortableHeader field="billsManagement" align="right" onSort={handleSort}>Bills & Mgmt</SortableHeader>}
                    {visibleColumns.has('netRent') && <SortableHeader field="netRent" align="right" onSort={handleSort}>Net Rent</SortableHeader>}
                    {visibleColumns.has('yield') && <SortableHeader field="yield" align="right" onSort={handleSort}>Yield</SortableHeader>}
                    {visibleColumns.has('ltv') && <SortableHeader field="ltv" align="right" onSort={handleSort}>LTV</SortableHeader>}
                    {visibleColumns.has('equity') && <SortableHeader field="equity" align="right" onSort={handleSort}>Equity</SortableHeader>}
                    {visibleColumns.has('epc') && <SortableHeader field="epc" onSort={handleSort}>EPC</SortableHeader>}
                    {visibleColumns.has('monthlyCashflow') && <SortableHeader field="monthlyCashflow" align="right" onSort={handleSort}>Cashflow/m</SortableHeader>}
                    {visibleColumns.has('riskStatus') && <SortableHeader field="riskStatus" onSort={handleSort}>Risk</SortableHeader>}
                    {visibleColumns.has('keysafeCode') && <SortableHeader field="keysafeCode" onSort={handleSort}>Keysafe</SortableHeader>}
                    {visibleColumns.has('waterStopTap') && <SortableHeader field="waterStopTap" onSort={handleSort}>Stop Tap</SortableHeader>}
                    {visibleColumns.has('electricMeter') && <SortableHeader field="electricMeter" onSort={handleSort}>Electric Meter</SortableHeader>}
                    {visibleColumns.has('gasMeter') && <SortableHeader field="gasMeter" onSort={handleSort}>Gas Meter</SortableHeader>}
                    {visibleColumns.has('waterMeter') && <SortableHeader field="waterMeter" onSort={handleSort}>Water Meter</SortableHeader>}
                    {visibleColumns.has('constructionDateBand') && <SortableHeader field="constructionDateBand" onSort={handleSort}>Construction</SortableHeader>}
                    {visibleColumns.has('hmoLicenceNumber') && <SortableHeader field="hmoLicenceNumber" onSort={handleSort}>HMO #</SortableHeader>}
                    {visibleColumns.has('hmoLicenceExpiry') && <SortableHeader field="hmoLicenceExpiry" onSort={handleSort}>HMO Expiry</SortableHeader>}
                    {visibleColumns.has('managementCompany') && <SortableHeader field="managementCompany" onSort={handleSort}>Mgmt Co.</SortableHeader>}
                    {visibleColumns.has('actions') && <TableHead className="w-24 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedProperties.map((property) => (
                    <PropertyTableRow
                      key={property.id}
                      property={property}
                      visibleColumns={visibleColumns}
                      photoMap={photoMap}
                      companyMap={companyMap}
                      passport={passportMap.get(property.id)}
                      onRowClick={handleRowClick}
                    />
                  ))}
                  
                  {/* Portfolio Totals Row */}
                  {filteredAndSortedProperties.length > 0 && (
                    <PortfolioTotalsRow stats={portfolioStats} visibleColumns={visibleColumns} />
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
        
        {/* Portfolio Metrics Footer - shown when we have properties */}
        {filteredAndSortedProperties.length > 0 && (
          <PortfolioMetricsFooter stats={portfolioStats} />
        )}
      </div>
    </AppLayout>
  );
}

export default PropertiesPage;
