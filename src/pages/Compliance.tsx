import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, Search, Home, AlertTriangle, X, ChevronRight, 
  Filter, ArrowUpDown, Loader2 
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusFilterBox } from '@/components/compliance/StatusFilterBox';
import { ComplianceRegisterItem } from '@/components/compliance/ComplianceRegisterItem';
import { ComplianceUploadDialog } from '@/components/compliance/ComplianceUploadDialog';
import { useAllCompliance, useCreateComplianceItem } from '@/hooks/useCompliance';
import { useProperties } from '@/hooks/useProperties';
import { COMPLIANCE_TYPES, type ComplianceStatus } from '@/lib/complianceTypes';
import { 
  generateComplianceItemsWithMissing, 
  calculateComplianceStats,
  type ComplianceItemWithMissing,
  type PropertyForCompliance,
} from '@/lib/complianceItemsWithMissing';

type FilterStatus = ComplianceStatus | 'all';

export default function Compliance() {
  const { data: items, isLoading } = useAllCompliance();
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const createComplianceItem = useCreateComplianceItem();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    type: string;
    propertyId: string;
    propertyAddress: string;
    isMissing: boolean;
  } | null>(null);

  // Create property lookup map
  const propertyMap = useMemo(() => {
    if (!properties) return new Map();
    return new Map(properties.map(p => [p.id, p]));
  }, [properties]);

  // Generate all items including missing placeholders
  const allItemsWithMissing = useMemo(() => {
    if (!items || !properties) return [];
    
    const propertiesForCompliance: PropertyForCompliance[] = properties.map(p => ({
      id: p.id,
      address_line: p.address_line || '',
      postcode: p.postcode,
      has_gas: p.has_gas,
      has_fire_alarm_system: p.has_fire_alarm_system,
      fire_alarm_grade: p.fire_alarm_grade,
      has_emergency_lighting: p.has_emergency_lighting,
      asset_category: p.asset_category,
      is_hmo_licensed: p.is_hmo_licensed,
      selective_licence_required: p.selective_licence_required,
      lifecycle_type: p.lifecycle_type,
    }));

    return generateComplianceItemsWithMissing(items, propertiesForCompliance);
  }, [items, properties]);

  // Calculate summary stats
  const summary = useMemo(() => {
    return calculateComplianceStats(allItemsWithMissing);
  }, [allItemsWithMissing]);

  // Filter items
  const filteredItems = useMemo(() => {
    return allItemsWithMissing.filter(item => {
      // Status filter logic
      if (statusFilter === 'expired') {
        if (item.status === 'not_required' || item.status === 'optional') return false;
        if (item.status !== 'expired' && item.status !== 'unknown') return false;
      } else if (statusFilter !== 'all') {
        if (statusFilter !== item.status) return false;
      }
      
      // Type filter
      if (typeFilter !== 'all' && item.compliance_type !== typeFilter) {
        return false;
      }
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const property = propertyMap.get(item.property_id);
        const searchableText = [
          item.compliance_type,
          property?.address_line,
          property?.postcode,
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) return false;
      }
      
      return true;
    });
  }, [allItemsWithMissing, statusFilter, typeFilter, searchQuery, propertyMap]);

  // Group items by property
  const groupedByProperty = useMemo(() => {
    const groups = new Map<string, ComplianceItemWithMissing[]>();
    
    filteredItems.forEach(item => {
      const existing = groups.get(item.property_id) || [];
      existing.push(item);
      groups.set(item.property_id, existing);
    });
    
    // Sort each group by urgency
    groups.forEach((groupItems) => {
      groupItems.sort((a, b) => {
        const statusOrder: Record<ComplianceStatus, number> = { 
          unknown: 0, 
          expired: 1, 
          expiring_soon: 2, 
          valid: 3,
          optional: 4,
          not_required: 5,
        };
        return statusOrder[a.status] - statusOrder[b.status];
      });
    });
    
    return groups;
  }, [filteredItems]);

  const hasItemsNeedingAction = summary.expired > 0;

  const handleStatusFilterClick = (status: FilterStatus) => {
    setStatusFilter(prev => prev === status ? 'all' : status);
  };

  const handleUploadClick = async (item: ComplianceItemWithMissing) => {
    const property = propertyMap.get(item.property_id);
    
    setSelectedItem({
      id: item.id,
      type: item.compliance_type,
      propertyId: item.property_id,
      propertyAddress: property?.address_line || 'Unknown Property',
      isMissing: item.isMissing,
    });
    setUploadDialogOpen(true);
  };

  const handleCreateMissingItem = async (): Promise<string | null> => {
    if (!selectedItem?.isMissing) return selectedItem?.id || null;
    
    try {
      const result = await createComplianceItem.mutateAsync({
        property_id: selectedItem.propertyId,
        compliance_type: selectedItem.type,
        issue_date: null,
        expiry_date: null,
        reminder_days: [90, 60, 30, 0],
        responsible_party: 'Owner',
        notes: null,
      });
      return result.id;
    } catch (error) {
      console.error('Failed to create compliance item:', error);
      return null;
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || searchQuery.trim();

  const getStatusLabel = (status: FilterStatus) => {
    switch (status) {
      case 'valid': return 'valid';
      case 'expiring_soon': return 'expiring';
      case 'expired': return 'expired/missing';
      case 'unknown': return 'missing';
      default: return 'total';
    }
  };

  // Loading state
  if (isLoading || propertiesLoading) {
    return (
      <AppLayout>
        <div className="space-y-8 p-6">
          {/* Header skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
          
          {/* Stat boxes skeleton */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-xl" />
            ))}
          </div>
          
          {/* Search bar skeleton */}
          <div className="flex gap-4">
            <Skeleton className="h-11 flex-1 max-w-md" />
            <Skeleton className="h-11 w-[200px]" />
          </div>
          
          {/* Cards skeleton */}
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 p-4 lg:p-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            Compliance Register
          </h1>
          <p className="text-muted-foreground">
            Portfolio-wide compliance tracking and document management
          </p>
        </div>

        {/* Alert Banner - Redesigned */}
        {hasItemsNeedingAction && (
          <div className="bg-gradient-to-r from-red-950/50 to-red-900/30 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-red-300 mb-1">
                  Compliance Alert
                </h3>
                <p className="text-sm text-red-200/80">
                  {summary.expired} compliance item{summary.expired !== 1 ? 's have' : ' has'} expired or {summary.expired !== 1 ? 'are' : 'is'} missing across your portfolio.
                  <button 
                    onClick={() => handleStatusFilterClick('expired')}
                    className="font-medium underline ml-1.5 hover:text-red-100 transition-colors"
                  >
                    Take action now
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Filter Boxes - Redesigned */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatusFilterBox
            label="Total Items"
            count={summary.total}
            variant="total"
            isActive={statusFilter === 'all' && !hasActiveFilters}
            onClick={() => handleStatusFilterClick('all')}
          />
          <StatusFilterBox
            label="Valid"
            count={summary.valid}
            variant="valid"
            isActive={statusFilter === 'valid'}
            onClick={() => handleStatusFilterClick('valid')}
          />
          <StatusFilterBox
            label="Expiring Soon"
            count={summary.expiring}
            variant="expiring"
            isActive={statusFilter === 'expiring_soon'}
            onClick={() => handleStatusFilterClick('expiring_soon')}
          />
          <StatusFilterBox
            label="Expired / Missing"
            count={summary.expired}
            variant="expired"
            isActive={statusFilter === 'expired'}
            onClick={() => handleStatusFilterClick('expired')}
          />
        </div>

        {/* Search and Filter Bar - Enhanced */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative max-w-lg">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by property, postcode, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-11 bg-card border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[220px] h-11 border-border">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {COMPLIANCE_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active filter indicator */}
        {hasActiveFilters && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Showing {filteredItems.length} {statusFilter !== 'all' ? getStatusLabel(statusFilter) : ''} item{filteredItems.length !== 1 ? 's' : ''}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters} 
              className="h-8 px-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Clear filters
            </Button>
          </div>
        )}

        {/* Compliance items grouped by property */}
        {groupedByProperty.size === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {allItemsWithMissing.length === 0 
                  ? "Start tracking compliance by adding items to your properties."
                  : "Try adjusting your filters or search query."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 transition-opacity duration-200">
            {Array.from(groupedByProperty.entries()).map(([propertyId, propertyItems]) => {
              const property = propertyMap.get(propertyId);
              const needsActionCount = propertyItems.filter(
                i => i.status === 'expired' || i.status === 'unknown'
              ).length;
              const expiringCount = propertyItems.filter(
                i => i.status === 'expiring_soon'
              ).length;
              
              return (
                <Card key={propertyId} className="border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                  {/* Property Header - Redesigned */}
                  <div className="bg-gradient-to-r from-secondary to-card px-5 lg:px-6 py-4 border-b border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left side */}
                      <div className="flex items-center gap-4">
                        {/* Property icon */}
                        <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Home className="h-6 w-6 text-primary" />
                        </div>
                        
                        {/* Address */}
                        <div className="min-w-0">
                          <Link 
                            to={`/properties/${propertyId}`}
                            className="text-lg font-semibold text-foreground hover:text-primary transition-colors truncate block"
                          >
                            {property?.address_line || 'Unknown Property'}
                          </Link>
                          {property?.postcode && (
                            <p className="text-sm text-muted-foreground">{property.postcode}</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Right side - Badges */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {needsActionCount > 0 && (
                          <Badge className="bg-red-500/20 text-red-300 border-red-500/30 px-3 py-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                            {needsActionCount} Need Action
                          </Badge>
                        )}
                        {expiringCount > 0 && (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-3 py-1.5">
                            {expiringCount} Expiring
                          </Badge>
                        )}
                        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                          <Link to={`/properties/${propertyId}?tab=compliance`}>
                            View All
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Compliance Items */}
                  <CardContent className="p-0">
                    {propertyItems.map(item => (
                      <ComplianceRegisterItem
                        key={item.id}
                        id={item.id}
                        complianceType={item.compliance_type}
                        expiryDate={item.expiry_date}
                        status={item.status}
                        daysUntilExpiry={item.daysUntilExpiry}
                        isMissing={item.isMissing}
                        conditionalReason={item.conditionalReason}
                        alternativeType={item.alternativeType}
                        onUpload={() => handleUploadClick(item)}
                      />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Upload Dialog */}
        {selectedItem && (
          <ComplianceUploadDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            complianceType={selectedItem.type}
            propertyAddress={selectedItem.propertyAddress}
            propertyId={selectedItem.propertyId}
            complianceItemId={selectedItem.isMissing ? undefined : selectedItem.id}
            isMissing={selectedItem.isMissing}
            onCreateMissingItem={handleCreateMissingItem}
            onSuccess={() => setSelectedItem(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
