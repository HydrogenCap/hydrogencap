import { useState, useMemo } from 'react';
import { AlertTriangle, Filter, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ComplianceItemRow } from './ComplianceItemRow';
import { AddComplianceItemDialog } from './AddComplianceItemDialog';
import { usePropertyCompliance } from '@/hooks/useCompliance';
import { 
  getComplianceItemStatus, 
  COMPLIANCE_TYPES,
  type ComplianceStatus 
} from '@/lib/complianceTypes';

interface ComplianceTabProps {
  propertyId: string;
  propertyAddress: string;
}

export function ComplianceTab({ propertyId, propertyAddress }: ComplianceTabProps) {
  const { data: items, isLoading } = usePropertyCompliance(propertyId);
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [cohoOnlyFilter, setCohoOnlyFilter] = useState(false);

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

  // Check for expired items to show banner
  const hasExpired = summary.expired > 0;

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
      {/* Alert banner for expired compliance */}
      {hasExpired && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Compliance Alert</AlertTitle>
          <AlertDescription>
            {summary.expired} compliance item{summary.expired !== 1 ? 's have' : ' has'} expired. 
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

          <div className="flex items-center gap-2">
            <Switch
              id="coho-only"
              checked={cohoOnlyFilter}
              onCheckedChange={setCohoOnlyFilter}
            />
            <label htmlFor="coho-only" className="text-sm">COHO Required Only</label>
          </div>
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
    </div>
  );
}
