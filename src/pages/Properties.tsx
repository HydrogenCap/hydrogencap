import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, ArrowUpDown, Eye, Settings2, Image, RotateCcw, ChevronDown, Edit2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import {
  formatGBP,
  formatGBPDecimal,
  formatPercent,
  formatDateUK,
  calculateLTV,
  calculateEquity,
  getEffectiveCosts,
  calculateNetRent,
  calculateYield,
  calculateMonthlyMortgagePayment,
  getLTVStatus,
  getExpiryStatus,
  getEPCStatus,
  daysUntil,
} from '@/lib/calculations';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';

// ============================================
// VIEW PRESET DEFINITIONS
// ============================================

type ViewPreset = 'default' | 'finance' | 'risk' | 'ops';

// All available columns with their labels
const ALL_COLUMNS = [
  { key: 'photo', label: 'Photo' },
  { key: 'address', label: 'Property Address' },
  { key: 'area', label: 'Area' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'propertyType', label: 'Property Type' },
  { key: 'beds', label: 'Beds' },
  { key: 'value', label: 'Property Value' },
  { key: 'purchasePrice', label: 'Purchase Price' },
  { key: 'purchaseDate', label: 'Original Purchase Date' },
  { key: 'lender', label: 'Lender' },
  { key: 'interestRate', label: 'Interest Rate' },
  { key: 'fixedOrVariable', label: 'Fixed or Variable' },
  { key: 'mortgageType', label: 'Mortgage Type' },
  { key: 'capitalOrInterest', label: 'Capital / Interest' },
  { key: 'fixedRateExpires', label: 'Fixed Rate Expires' },
  { key: 'insuranceExpire', label: 'Insurance Expire' },
  { key: 'mortgageBalance', label: 'Current Mortgage Balance' },
  { key: 'mortgagePayment', label: 'Mortgage' },
  { key: 'rentalIncome', label: 'Rental Income' },
  { key: 'billsManagement', label: 'Bills & Management' },
  { key: 'netRent', label: 'Net Rent' },
  { key: 'yield', label: 'Yield' },
  { key: 'ltv', label: 'LTV' },
  { key: 'equity', label: 'Equity' },
  // Additional columns for specific views
  { key: 'epc', label: 'EPC' },
  { key: 'monthlyCashflow', label: 'Monthly Cashflow' },
  { key: 'riskStatus', label: 'Risk Status' },
  { key: 'keysafeCode', label: 'Keysafe Code' },
  { key: 'waterStopTap', label: 'Water Stop Tap' },
  { key: 'electricMeter', label: 'Electric Meter' },
  { key: 'gasMeter', label: 'Gas Meter' },
  { key: 'waterMeter', label: 'Water Meter' },
  { key: 'constructionDateBand', label: 'Construction' },
  { key: 'hmoLicenceNumber', label: 'HMO Licence #' },
  { key: 'hmoLicenceExpiry', label: 'HMO Licence Expiry' },
  { key: 'managementCompany', label: 'Management Company' },
  { key: 'actions', label: 'Actions' },
] as const;

type ColumnKey = typeof ALL_COLUMNS[number]['key'];
type SortDirection = 'asc' | 'desc';

// Preset configurations
const VIEW_PRESETS: Record<ViewPreset, { label: string; columns: ColumnKey[]; defaultSort?: ColumnKey; sortDir?: SortDirection }> = {
  default: {
    label: 'Default (Sheet View)',
    columns: [
      'photo', 'address', 'area', 'ownership', 'propertyType', 'beds', 'value', 'purchasePrice',
      'purchaseDate', 'lender', 'interestRate', 'fixedOrVariable', 'mortgageType', 'capitalOrInterest',
      'fixedRateExpires', 'insuranceExpire', 'mortgageBalance', 'mortgagePayment', 'rentalIncome',
      'billsManagement', 'netRent', 'yield', 'ltv', 'equity'
    ],
    defaultSort: 'address',
    sortDir: 'asc',
  },
  finance: {
    label: 'Finance View',
    columns: [
      'photo', 'address', 'area', 'ownership', 'beds', 'value', 'mortgageBalance', 'mortgagePayment',
      'interestRate', 'fixedOrVariable', 'mortgageType', 'capitalOrInterest', 'rentalIncome',
      'billsManagement', 'netRent', 'yield', 'ltv', 'equity'
    ],
    defaultSort: 'equity',
    sortDir: 'desc',
  },
  risk: {
    label: 'Risk View',
    columns: [
      'photo', 'address', 'area', 'lender', 'ltv', 'fixedRateExpires', 'insuranceExpire',
      'epc', 'monthlyCashflow', 'netRent', 'riskStatus'
    ],
    defaultSort: 'riskStatus',
    sortDir: 'desc',
  },
  ops: {
    label: 'Ops View',
    columns: [
      'photo', 'address', 'area', 'keysafeCode', 'waterStopTap', 'electricMeter', 'gasMeter',
      'waterMeter', 'constructionDateBand', 'hmoLicenceNumber', 'hmoLicenceExpiry', 'managementCompany'
    ],
    defaultSort: 'address',
    sortDir: 'asc',
  },
};

// Default visible columns for the default view
const DEFAULT_VISIBLE = new Set<ColumnKey>([
  'photo', 'address', 'area', 'ownership', 'propertyType', 'beds', 'value', 'purchasePrice',
  'lender', 'interestRate', 'fixedRateExpires', 'mortgageBalance', 'mortgagePayment',
  'rentalIncome', 'netRent', 'yield', 'ltv', 'equity', 'actions'
]);

// ============================================
// DATA HOOKS
// ============================================

function usePropertyPhotos() {
  return useQuery({
    queryKey: ['property_photos_covers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('property_id, file_url, is_cover')
        .eq('is_cover', true);
      
      if (error) throw error;
      
      const photoMap = new Map<string, string>();
      data?.forEach(photo => {
        photoMap.set(photo.property_id, photo.file_url);
      });
      return photoMap;
    },
  });
}

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

// ============================================
// RISK CALCULATION
// ============================================

type RiskLevel = 'critical' | 'warning' | 'ok';

function calculatePropertyRisk(
  property: PropertyWithFinancials,
  passport: PropertyPassport | undefined,
  metrics: ReturnType<typeof getPropertyMetrics>
): { level: RiskLevel; issues: string[] } {
  const issues: string[] = [];
  let level: RiskLevel = 'ok';

  // LTV > 85% = critical, > 75% = warning
  if (metrics.ltv !== null) {
    if (metrics.ltv > 85) {
      issues.push('LTV > 85%');
      level = 'critical';
    } else if (metrics.ltv > 75) {
      issues.push('LTV > 75%');
      if (level === 'ok') level = 'warning';
    }
  }

  // Fixed rate expiry
  if (metrics.loan?.fixed_rate_expires) {
    const status = getExpiryStatus(metrics.loan.fixed_rate_expires);
    if (status === 'expired') {
      issues.push('Fixed rate expired');
      level = 'critical';
    } else if (status === 'critical' || status === 'warning') {
      issues.push('Fixed rate expiring soon');
      if (level === 'ok') level = 'warning';
    }
  }

  // EPC rating (if not exempt)
  if (property.epc_required !== false) {
    const epcStatus = getEPCStatus(property.epc_rating, property.epc_required ?? true);
    if (epcStatus === 'warning') {
      issues.push('EPC below C');
      if (level === 'ok') level = 'warning';
    }
  }

  // HMO licence (from passport)
  if (passport?.hmo_licence_required && passport.hmo_licence_expiry) {
    const status = getExpiryStatus(passport.hmo_licence_expiry);
    if (status === 'expired') {
      issues.push('HMO licence expired');
      level = 'critical';
    } else if (status === 'critical' || status === 'warning') {
      issues.push('HMO licence expiring');
      if (level === 'ok') level = 'warning';
    }
  }

  // Negative monthly cashflow
  if (metrics.monthlyCashflow !== null && metrics.monthlyCashflow < 0) {
    issues.push('Negative cashflow');
    if (level === 'ok') level = 'warning';
  }

  return { level, issues };
}

// ============================================
// METRICS HELPER
// ============================================

function getPropertyMetrics(property: PropertyWithFinancials) {
  const currentYear = new Date().getFullYear();
  const loan = property.loans?.[0];
  const income = property.income?.find(i => i.year === currentYear);
  const costs = property.costs?.find(c => c.year === currentYear);

  const mortgageBalance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
  const currentValue = property.current_value_gbp ? Number(property.current_value_gbp) : null;
  const purchasePrice = property.purchase_price_gbp ? Number(property.purchase_price_gbp) : null;
  const annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
  
  // Use effective costs (auto-calculated with manual overrides)
  const effectiveCosts = getEffectiveCosts(annualRent, currentValue, costs);
  const managementCost = effectiveCosts.management;
  const billsCost = effectiveCosts.bills;
  const billsManagement = managementCost + billsCost;
  const totalCosts = effectiveCosts.total;

  const ltv = calculateLTV(mortgageBalance, currentValue);
  const equity = calculateEquity(currentValue, mortgageBalance);
  const netRent = calculateNetRent(annualRent, totalCosts);
  const yieldPercent = calculateYield(netRent, currentValue);

  // Calculate monthly mortgage payment
  const mortgagePaymentResult = calculateMonthlyMortgagePayment({
    balance: mortgageBalance,
    interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
    termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
    isInterestOnly: loan?.capital_or_interest === 'interest',
    paymentOverride: loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : null,
  });

  // Monthly cashflow = (net rent / 12) - monthly mortgage
  const monthlyNetRent = netRent !== null ? netRent / 12 : null;
  const monthlyCashflow = monthlyNetRent !== null && mortgagePaymentResult.effective !== null
    ? monthlyNetRent - mortgagePaymentResult.effective
    : monthlyNetRent;

  return {
    mortgageBalance,
    currentValue,
    purchasePrice,
    annualRent,
    billsManagement,
    totalCosts,
    ltv,
    equity,
    netRent,
    yieldPercent,
    mortgagePayment: mortgagePaymentResult.effective,
    monthlyCashflow,
    loan,
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

function PropertiesPage() {
  const navigate = useNavigate();
  const { data: properties, isLoading, error } = useProperties();
  const { data: photoMap } = usePropertyPhotos();
  const { data: ownershipMap } = usePropertyOwnerships();
  const { data: passports } = usePropertyPassports();
  
  const [searchQuery, setSearchQuery] = useState('');
  
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
  const switchView = (view: ViewPreset) => {
    setActiveView(view);
    const preset = VIEW_PRESETS[view];
    setVisibleColumns(new Set(preset.columns));
    setSortField(preset.defaultSort || 'address');
    setSortDirection(preset.sortDir || 'asc');
  };

  // Reset current view to preset defaults
  const resetView = () => {
    const preset = VIEW_PRESETS[activeView];
    setVisibleColumns(new Set(preset.columns));
    setSortField(preset.defaultSort || 'address');
    setSortDirection(preset.sortDir || 'asc');
  };

  // Create passport map for quick lookup
  const passportMap = useMemo(() => {
    const map = new Map<string, PropertyPassport>();
    passports?.forEach(p => map.set(p.property_id, p));
    return map;
  }, [passports]);

  // Filter and sort properties
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
          // Sort by risk level: critical > warning > ok
          const riskA = calculatePropertyRisk(a, passportA, metricsA);
          const riskB = calculatePropertyRisk(b, passportB, metricsB);
          const riskOrder: Record<RiskLevel, number> = { critical: 3, warning: 2, ok: 1 };
          comparison = riskOrder[riskA.level] - riskOrder[riskB.level];
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
  }, [properties, searchQuery, sortField, sortDirection, passportMap]);

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

  const handleRowClick = (propertyId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    navigate(`/properties/${propertyId}`);
  };

  // ============================================
  // HELPER COMPONENTS
  // ============================================

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
    let colorClass = 'text-success';
    if (status === 'expired') colorClass = 'text-destructive';
    else if (status === 'critical' || status === 'warning') colorClass = 'text-warning';
    
    return <span className={colorClass}>{formatDateUK(date)}</span>;
  };

  const getLTVBadge = (ltv: number | null) => {
    if (ltv === null) return <span className="text-muted-foreground">—</span>;
    
    const status = getLTVStatus(ltv);
    let colorClass = '';
    if (status === 'danger') colorClass = 'text-destructive';
    else if (status === 'warning') colorClass = 'text-warning';
    
    return <span className={colorClass}>{formatPercent(ltv)}</span>;
  };

  const getEPCBadge = (rating: string | null, required: boolean | null) => {
    if (required === false) {
      return <Badge variant="outline" className="text-xs">N/A</Badge>;
    }
    if (!rating) return <span className="text-muted-foreground">—</span>;
    
    const status = getEPCStatus(rating, required ?? true);
    let colorClass = 'text-success';
    if (status === 'warning') colorClass = 'text-warning';
    else if (status === 'exempt') colorClass = 'text-muted-foreground';
    
    return <Badge variant="outline" className={`${colorClass} border-current`}>{rating}</Badge>;
  };

  const getRiskBadge = (level: RiskLevel, issues: string[]) => {
    const colors: Record<RiskLevel, string> = {
      critical: 'bg-destructive text-destructive-foreground',
      warning: 'bg-warning text-warning-foreground',
      ok: 'bg-success text-success-foreground',
    };
    const labels: Record<RiskLevel, string> = {
      critical: 'RED',
      warning: 'YELLOW',
      ok: 'GREEN',
    };
    
    return (
      <Badge className={colors[level]} title={issues.join(', ')}>
        {labels[level]}
      </Badge>
    );
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

  const getOpsCompleteness = (passport: PropertyPassport | undefined) => {
    if (!passport) return { complete: false, missing: ['All data missing'] };
    
    const completeness = calculatePassportCompleteness(passport);
    const missing: string[] = [];
    
    if (!passport.keysafe_code) missing.push('Keysafe');
    if (!passport.water_stop_tap_location) missing.push('Stop tap');
    if (!passport.electric_meter_location || !passport.electric_meter_number) missing.push('Electric meter');
    if (!passport.gas_meter_location || !passport.gas_meter_number) missing.push('Gas meter');
    if (!passport.water_meter_location || !passport.water_meter_number) missing.push('Water meter');
    
    return { complete: completeness.percentage === 100, missing };
  };

  // ============================================
  // RENDER
  // ============================================

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
                    {/* Additional columns */}
                    {visibleColumns.has('epc') && <TableHead>EPC</TableHead>}
                    {visibleColumns.has('monthlyCashflow') && <SortableHeader field="monthlyCashflow" align="right">Cashflow/m</SortableHeader>}
                    {visibleColumns.has('riskStatus') && <SortableHeader field="riskStatus">Risk</SortableHeader>}
                    {visibleColumns.has('keysafeCode') && <TableHead>Keysafe</TableHead>}
                    {visibleColumns.has('waterStopTap') && <TableHead>Stop Tap</TableHead>}
                    {visibleColumns.has('electricMeter') && <TableHead>Electric Meter</TableHead>}
                    {visibleColumns.has('gasMeter') && <TableHead>Gas Meter</TableHead>}
                    {visibleColumns.has('waterMeter') && <TableHead>Water Meter</TableHead>}
                    {visibleColumns.has('constructionDateBand') && <TableHead>Construction</TableHead>}
                    {visibleColumns.has('hmoLicenceNumber') && <TableHead>HMO #</TableHead>}
                    {visibleColumns.has('hmoLicenceExpiry') && <SortableHeader field="hmoLicenceExpiry">HMO Expiry</SortableHeader>}
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
                    
                    // Insurance expiry placeholder
                    const insuranceExpiry = null;
                    
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
                          <TableCell className="max-w-[180px] truncate">{getOwnershipDisplay(property.id)}</TableCell>
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
                          <TableCell>{getExpiryBadge(metrics.loan?.fixed_rate_expires)}</TableCell>
                        )}
                        {visibleColumns.has('insuranceExpire') && (
                          <TableCell>{getExpiryBadge(insuranceExpiry)}</TableCell>
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
                          <TableCell className="text-right">{getLTVBadge(metrics.ltv)}</TableCell>
                        )}
                        {visibleColumns.has('equity') && (
                          <TableCell className="text-right font-medium text-primary">{formatGBPDecimal(metrics.equity)}</TableCell>
                        )}
                        {/* Additional columns */}
                        {visibleColumns.has('epc') && (
                          <TableCell>{getEPCBadge(property.epc_rating, property.epc_required)}</TableCell>
                        )}
                        {visibleColumns.has('monthlyCashflow') && (
                          <TableCell className="text-right">
                            {metrics.monthlyCashflow !== null ? (
                              <span className={metrics.monthlyCashflow >= 0 ? 'text-success' : 'text-destructive'}>
                                {formatGBPDecimal(metrics.monthlyCashflow)}
                              </span>
                            ) : '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('riskStatus') && (
                          <TableCell>{getRiskBadge(risk.level, risk.issues)}</TableCell>
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
                            {passport?.electric_meter_location ? (
                              <span className="block truncate" title={passport.electric_meter_location}>
                                {passport.electric_meter_location}
                                {passport.electric_meter_number && <span className="block text-foreground"># {passport.electric_meter_number}</span>}
                              </span>
                            ) : <span className="text-warning">Missing</span>}
                          </TableCell>
                        )}
                        {visibleColumns.has('gasMeter') && (
                          <TableCell className="text-muted-foreground text-xs max-w-[120px]">
                            {passport?.gas_meter_location ? (
                              <span className="block truncate" title={passport.gas_meter_location}>
                                {passport.gas_meter_location}
                                {passport.gas_meter_number && <span className="block text-foreground"># {passport.gas_meter_number}</span>}
                              </span>
                            ) : <span className="text-warning">Missing</span>}
                          </TableCell>
                        )}
                        {visibleColumns.has('waterMeter') && (
                          <TableCell className="text-muted-foreground text-xs max-w-[120px]">
                            {passport?.water_meter_location ? (
                              <span className="block truncate" title={passport.water_meter_location}>
                                {passport.water_meter_location}
                                {passport.water_meter_number && <span className="block text-foreground"># {passport.water_meter_number}</span>}
                              </span>
                            ) : <span className="text-warning">Missing</span>}
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
                          <TableCell>{getExpiryBadge(passport?.hmo_licence_expiry)}</TableCell>
                        )}
                        {visibleColumns.has('managementCompany') && (
                          <TableCell className="text-muted-foreground max-w-[150px] truncate">
                            {passport?.property_management_company || '—'}
                          </TableCell>
                        )}
                        {visibleColumns.has('actions') && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                asChild
                              >
                                <Link to={`/properties/${property.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                asChild
                              >
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
