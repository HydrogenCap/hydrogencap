import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Search, Building2, AlertTriangle, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
type ActionableStatus = 'expired' | 'unknown';

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
    
    // Convert properties to the expected format
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

  // Calculate summary stats (missing items count in 'expired')
  const summary = useMemo(() => {
    return calculateComplianceStats(allItemsWithMissing);
  }, [allItemsWithMissing]);

  // Filter items - exclude not_required/optional from expired filter
  const filteredItems = useMemo(() => {
    return allItemsWithMissing.filter(item => {
      // Never show not_required items in the expired/missing filter
      if (statusFilter === 'expired') {
        if (item.status === 'not_required' || item.status === 'optional') return false;
        // Show both expired and unknown (missing) items
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

  // Group items by property - sort missing items to top within each group
  const groupedByProperty = useMemo(() => {
    const groups = new Map<string, ComplianceItemWithMissing[]>();
    
    filteredItems.forEach(item => {
      const existing = groups.get(item.property_id) || [];
      existing.push(item);
      groups.set(item.property_id, existing);
    });
    
    // Sort each group: missing/expired items first, then expiring, then valid, then optional/not_required
    groups.forEach((groupItems, propertyId) => {
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

  // Check for items needing action (expired OR missing)
  const hasItemsNeedingAction = summary.expired > 0;

  const handleStatusFilterClick = (status: FilterStatus) => {
    setStatusFilter(prev => prev === status ? 'all' : status);
  };

  const handleUploadClick = async (item: ComplianceItemWithMissing) => {
    const property = propertyMap.get(item.property_id);
    
    // If it's a missing item, we need to create it first when uploading
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

  if (isLoading || propertiesLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Compliance Register</h1>
            <p className="text-muted-foreground">
              Portfolio-wide compliance tracking and document management
            </p>
          </div>
        </div>

        {/* Alert banner for expired OR missing compliance */}
        {hasItemsNeedingAction && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Compliance Alert</AlertTitle>
            <AlertDescription>
              {summary.expired} compliance item{summary.expired !== 1 ? 's have' : ' has'} expired or {summary.expired !== 1 ? 'are' : 'is'} missing across your portfolio. 
              Immediate action required.
            </AlertDescription>
          </Alert>
        )}

        {/* Clickable Status Filter Boxes */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
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

        {/* Search and Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by property, postcode, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
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
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Showing {filteredItems.length} {statusFilter !== 'all' ? getStatusLabel(statusFilter) : ''} item{filteredItems.length !== 1 ? 's' : ''}
            </span>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto py-1 px-2">
              <X className="h-3 w-3 mr-1" />
              Clear filters
            </Button>
          </div>
        )}

        {/* Compliance items grouped by property */}
        {groupedByProperty.size === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No items found</h3>
              <p className="text-muted-foreground text-center">
                {allItemsWithMissing.length === 0 
                  ? "Start tracking compliance by adding items to your properties."
                  : "Try adjusting your filters or search query."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Array.from(groupedByProperty.entries()).map(([propertyId, propertyItems]) => {
              const property = propertyMap.get(propertyId);
              // Count items needing action (expired + missing)
              const needsActionCount = propertyItems.filter(
                i => i.status === 'expired' || i.status === 'unknown'
              ).length;
              const expiringCount = propertyItems.filter(
                i => i.status === 'expiring_soon'
              ).length;
              
              return (
                <Card key={propertyId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Link 
                            to={`/properties/${propertyId}`}
                            className="font-semibold hover:underline"
                          >
                            {property?.address_line || 'Unknown Property'}
                          </Link>
                          {property?.postcode && (
                            <span className="text-sm text-muted-foreground ml-2">
                              {property.postcode}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {needsActionCount > 0 && (
                          <Badge variant="destructive">{needsActionCount} Need Action</Badge>
                        )}
                        {expiringCount > 0 && (
                          <Badge className="bg-amber-500 text-white hover:bg-amber-600">{expiringCount} Expiring</Badge>
                        )}
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/properties/${propertyId}?tab=compliance`}>
                            View All
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y">
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
                    </div>
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
