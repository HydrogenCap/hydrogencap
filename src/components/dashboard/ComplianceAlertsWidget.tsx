import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Shield, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllCompliance } from '@/hooks/useCompliance';
import { useProperties } from '@/hooks/useProperties';
import { getComplianceItemStatus, getComplianceStatusColor } from '@/lib/complianceTypes';

export function ComplianceAlertsWidget() {
  const { data: complianceItems, isLoading: loadingCompliance } = useAllCompliance();
  const { data: properties, isLoading: loadingProperties } = useProperties();

  const alerts = useMemo(() => {
    if (!complianceItems || !properties) return [];

    const propertyMap = new Map(properties.map(p => [p.id, p]));

    return complianceItems
      .map(item => {
        const status = getComplianceItemStatus(item.expiry_date);
        const property = propertyMap.get(item.property_id);
        return { item, status, property };
      })
      .filter(({ status }) => status === 'expired' || status === 'expiring_soon')
      .sort((a, b) => {
        // Sort expired first, then by expiry date
        if (a.status === 'expired' && b.status !== 'expired') return -1;
        if (a.status !== 'expired' && b.status === 'expired') return 1;
        
        const dateA = a.item.expiry_date ? new Date(a.item.expiry_date).getTime() : Infinity;
        const dateB = b.item.expiry_date ? new Date(b.item.expiry_date).getTime() : Infinity;
        return dateA - dateB;
      })
      .slice(0, 5); // Show top 5 alerts
  }, [complianceItems, properties]);

  const expiredCount = alerts.filter(a => a.status === 'expired').length;
  const expiringCount = alerts.filter(a => a.status === 'expiring_soon').length;

  if (loadingCompliance || loadingProperties) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-green-600">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">All Clear</p>
              <p className="text-sm text-muted-foreground">No compliance issues detected</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Compliance Alerts
          </span>
          <div className="flex items-center gap-2 text-sm font-normal">
            {expiredCount > 0 && (
              <Badge variant="destructive">{expiredCount} Expired</Badge>
            )}
            {expiringCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                {expiringCount} Expiring
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map(({ item, status, property }) => (
          <Link
            key={item.id}
            to={`/properties/${item.property_id}?tab=compliance`}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{item.compliance_type}</span>
                <Badge className={getComplianceStatusColor(status)}>
                  {status === 'expired' ? 'Expired' : 'Expiring'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {property?.address_line || 'Unknown property'}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </Link>
        ))}

        {(complianceItems?.length || 0) > 5 && (
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/missing-info?tab=compliance">
              View All Compliance Issues
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
