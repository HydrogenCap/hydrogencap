import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Filter, AlertTriangle, Building2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import { ComplianceStatusBadge } from '@/components/compliance/ComplianceStatusBadge';
import { useAllCompliance } from '@/hooks/useCompliance';
import { useProperties } from '@/hooks/useProperties';
import { 
  getComplianceItemStatus, 
  COMPLIANCE_TYPES,
  type ComplianceStatus 
} from '@/lib/complianceTypes';

export default function Compliance() {
  const { data: items, isLoading } = useAllCompliance();
  const { data: properties } = useProperties();
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [cohoOnlyFilter, setCohoOnlyFilter] = useState(false);

  // Create property lookup map
  const propertyMap = useMemo(() => {
    if (!properties) return new Map();
    return new Map(properties.map(p => [p.id, p]));
  }, [properties]);

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
      
      // COHO only filter
      if (cohoOnlyFilter && !item.is_coho_required) {
        return false;
      }
      
      return true;
    });
  }, [items, statusFilter, typeFilter, cohoOnlyFilter]);

  // Group items by property
  const groupedByProperty = useMemo(() => {
    const groups = new Map<string, typeof filteredItems>();
    
    filteredItems.forEach(item => {
      const existing = groups.get(item.property_id) || [];
      existing.push(item);
      groups.set(item.property_id, existing);
    });
    
    return groups;
  }, [filteredItems]);

  // Check for expired items to show banner
  const hasExpired = summary.expired > 0;

  if (isLoading) {
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

        {/* Alert banner for expired compliance */}
        {hasExpired && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Compliance Alert</AlertTitle>
            <AlertDescription>
              {summary.expired} compliance item{summary.expired !== 1 ? 's have' : ' has'} expired across your portfolio. 
              Immediate action required.
            </AlertDescription>
          </Alert>
        )}

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
              <CardTitle className="text-sm font-medium text-green-600">Valid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.valid}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-600">Expiring Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{summary.expiring}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.expired}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
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

          <div className="flex items-center gap-2">
            <Switch
              id="coho-only"
              checked={cohoOnlyFilter}
              onCheckedChange={setCohoOnlyFilter}
            />
            <label htmlFor="coho-only" className="text-sm">COHO Required Only</label>
          </div>
        </div>

        {/* Compliance items grouped by property */}
        {groupedByProperty.size === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Compliance Items</h3>
              <p className="text-muted-foreground text-center">
                {items?.length === 0 
                  ? "Start tracking compliance by adding items to your properties."
                  : "No items match your current filters."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Array.from(groupedByProperty.entries()).map(([propertyId, propertyItems]) => {
              const property = propertyMap.get(propertyId);
              const expiredCount = propertyItems.filter(i => getComplianceItemStatus(i.expiry_date) === 'expired').length;
              const expiringCount = propertyItems.filter(i => getComplianceItemStatus(i.expiry_date) === 'expiring_soon').length;
              
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
                        {expiredCount > 0 && (
                          <Badge variant="destructive">{expiredCount} Expired</Badge>
                        )}
                        {expiringCount > 0 && (
                          <Badge className="bg-amber-500 hover:bg-amber-600">{expiringCount} Expiring</Badge>
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
                        <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{item.compliance_type}</span>
                            {item.is_coho_required && (
                              <Badge variant="outline" className="text-xs">COHO</Badge>
                            )}
                          </div>
                          <ComplianceStatusBadge expiryDate={item.expiry_date} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
