import { useState, useMemo } from 'react';
import { AlertTriangle, Filter, Shield, Settings2, Construction, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ComplianceItemRow } from './ComplianceItemRow';
import { AddComplianceItemDialog } from './AddComplianceItemDialog';
import { ComplianceChecklist } from './ComplianceChecklist';
import { PropertyFeaturesEditor } from './PropertyFeaturesEditor';
import { AIComplianceChecker } from './AIComplianceChecker';
import { usePropertyCompliance } from '@/hooks/useCompliance';
import { usePropertyWithFeatures } from '@/hooks/useComplianceRequirements';
import { 
  getComplianceItemStatus, 
  COMPLIANCE_TYPES,
  type ComplianceStatus 
} from '@/lib/complianceTypes';
import { LifecycleType } from '@/contexts/LifecycleFilterContext';

interface ComplianceTabProps {
  propertyId: string;
  propertyAddress: string;
  lifecycleType?: LifecycleType;
}

export function ComplianceTab({ propertyId, propertyAddress, lifecycleType = 'core_rental' }: ComplianceTabProps) {
  const { data: items, isLoading: loadingItems } = usePropertyCompliance(propertyId);
  const { data: propertyFeatures, isLoading: loadingFeatures } = usePropertyWithFeatures(propertyId);
  const [viewMode, setViewMode] = useState<'checklist' | 'items'>('checklist');
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAIChecker, setShowAIChecker] = useState(false);
  
  // Check if property is in development mode
  const isDevelopment = lifecycleType === 'development';

  // Calculate summary stats
  const summary = useMemo(() => {
    if (!items) return { valid: 0, expiring: 0, expired: 0, total: 0 };
    
    return items.reduce(
      (acc, item) => {
        const status = getComplianceItemStatus(item.expiry_date);
        acc.total++;
        if (status === 'valid') acc.valid++;
        else if (status === 'expiring_soon') acc.expiring++;
        else if (status === 'expired') acc.expired++;
        return acc;
      },
      { valid: 0, expiring: 0, expired: 0, total: 0 }
    );
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    return items.filter(item => {
      // Status filter
      if (statusFilter !== 'all') {
        const status = getComplianceItemStatus(item.expiry_date);
        if (status !== statusFilter) return false;
      }
      
      // Type filter
      if (typeFilter !== 'all' && item.compliance_type !== typeFilter) {
        return false;
      }
      
      return true;
    });
  }, [items, statusFilter, typeFilter]);

  const hasExpired = summary.expired > 0;
  const isLoading = loadingItems || loadingFeatures;
  
  // Default property features
  const defaultFeatures = {
    has_gas: propertyFeatures?.has_gas ?? true,
    has_fire_alarm_system: propertyFeatures?.has_fire_alarm_system ?? false,
    fire_alarm_grade: propertyFeatures?.fire_alarm_grade ?? null,
    has_emergency_lighting: propertyFeatures?.has_emergency_lighting ?? false,
    asset_category: propertyFeatures?.asset_category ?? 'Single Let',
    occupancy_status: propertyFeatures?.occupancy_status ?? 'Occupied',
    is_hmo_licensed: propertyFeatures?.is_hmo_licensed ?? false,
    selective_licence_required: propertyFeatures?.selective_licence_required ?? false,
    co_alarm_required: propertyFeatures?.co_alarm_required ?? true,
    is_grade_listed: propertyFeatures?.is_grade_listed ?? false,
    listing_grade: propertyFeatures?.listing_grade ?? null,
    has_solar: propertyFeatures?.has_solar ?? false,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Development mode banner */}
      {isDevelopment && (
        <Alert className="border-warning/30">
          <Construction className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Compliance Tracking Paused</AlertTitle>
          <AlertDescription>
            This property is currently in <strong>Development</strong> mode. Compliance tracking activates 
            once the property becomes operational. Switch to <strong>Core Rental</strong> mode to enable 
            full compliance enforcement, expiry reminders, and weekly compliance emails.
          </AlertDescription>
        </Alert>
      )}

      {/* Alert banner for expired compliance - only for core rental */}
      {!isDevelopment && hasExpired && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Compliance Alert</AlertTitle>
          <AlertDescription>
            {summary.expired} compliance item{summary.expired !== 1 ? 's have' : ' has'} expired. 
            Immediate action required.
          </AlertDescription>
        </Alert>
      )}

      {/* AI Compliance Checker */}
      <Collapsible open={showAIChecker} onOpenChange={setShowAIChecker}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Compliance Checker
            </span>
            <span className="text-xs text-muted-foreground">
              {showAIChecker ? 'Hide' : 'Show'} AI Analysis
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <AIComplianceChecker propertyId={propertyId} />
        </CollapsibleContent>
      </Collapsible>

      {/* Property features configuration */}
      <div className="flex items-center justify-between">
        <PropertyFeaturesEditor 
          propertyId={propertyId}
          initialFeatures={defaultFeatures}
        />
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'checklist' | 'items')}>
          <TabsList>
            <TabsTrigger value="checklist">Requirements Checklist</TabsTrigger>
            <TabsTrigger value="items">Uploaded Items</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {viewMode === 'checklist' ? (
        <ComplianceChecklist 
          propertyId={propertyId}
          propertyAddress={propertyAddress}
        />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-success">Valid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{summary.valid}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-warning">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{summary.expiring}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and add button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ComplianceStatus | 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="valid">Valid</SelectItem>
              <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {COMPLIANCE_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AddComplianceItemDialog propertyId={propertyId} />
      </div>

      {/* Compliance items list */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Compliance Items</h3>
            <p className="text-muted-foreground text-center mb-4">
              {items?.length === 0 
                ? "Start tracking compliance for this property by adding your first item."
                : "No items match your current filters."
              }
            </p>
            {items?.length === 0 && (
              <AddComplianceItemDialog propertyId={propertyId} />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => (
            <ComplianceItemRow 
              key={item.id} 
              item={item} 
              propertyId={propertyId}
              propertyAddress={propertyAddress}
            />
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
