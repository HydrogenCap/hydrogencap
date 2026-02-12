import { useMemo } from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { format, isPast, addDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { useShareholderSession } from '@/hooks/useShareholderSession';
import { useShareholderPortfolioData } from '@/hooks/useShareholderPortfolioData';
import { LoadingState } from '@/components/common/LoadingState';
import { Navigate } from 'react-router-dom';
import { formatPercent } from '@/lib/calculations';

const COMPLIANCE_TYPES = [
  'gas_safety',
  'eicr',
  'epc',
  'fire_alarm',
  'emergency_lighting',
  'legionella',
  'hmo_licence',
];

const COMPLIANCE_LABELS: Record<string, string> = {
  gas_safety: 'Gas Safety',
  eicr: 'EICR',
  epc: 'EPC',
  fire_alarm: 'Fire Alarm',
  emergency_lighting: 'Emergency Lighting',
  legionella: 'Legionella',
  hmo_licence: 'HMO Licence',
};

function getComplianceStatus(expiryDate: string | null, isExcluded: boolean) {
  if (isExcluded) return 'excluded';
  if (!expiryDate) return 'missing';
  const expiry = new Date(expiryDate);
  if (isPast(expiry)) return 'expired';
  if (isPast(addDays(expiry, -30))) return 'expiring';
  return 'valid';
}

export default function PortalCompliance() {
  const { canViewCompliance } = useShareholderSession();
  const { properties, complianceItems, isLoading } = useShareholderPortfolioData();

  const stats = useMemo(() => {
    if (!complianceItems?.length) return { valid: 0, expiring: 0, expired: 0, missing: 0, total: 0 };

    let valid = 0, expiring = 0, expired = 0, missing = 0;

    complianceItems.forEach((item) => {
      const status = getComplianceStatus(item.expiry_date, item.is_manually_excluded || false);
      if (status === 'valid') valid++;
      else if (status === 'expiring') expiring++;
      else if (status === 'expired') expired++;
      else if (status === 'missing') missing++;
    });

    return { valid, expiring, expired, missing, total: complianceItems.length };
  }, [complianceItems]);

  const complianceRate = stats.total > 0 
    ? ((stats.valid + stats.expiring) / stats.total) * 100 
    : 0;

  if (!canViewCompliance) {
    return <Navigate to="/portal" replace />;
  }

  if (isLoading) {
    return (
      <PortalLayout>
        <LoadingState text="Loading compliance..." />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Compliance Status</h1>
          <p className="text-muted-foreground">
            Overview of compliance certificates across the portfolio
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                Valid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.valid}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Expiring Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.expiring}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                Expired
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.expired}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercent(complianceRate, 0)}</div>
              <Progress value={complianceRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Compliance by Property */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance by Property</CardTitle>
            <CardDescription>Certificate status for each property</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Property</th>
                    {COMPLIANCE_TYPES.map((type) => (
                      <th key={type} className="text-center py-3 px-2 font-medium">
                        {COMPLIANCE_LABELS[type]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {properties?.map((property) => {
                    const propertyCompliance = complianceItems?.filter(
                      (c) => c.property_id === property.id
                    );

                    return (
                      <tr key={property.id} className="border-b last:border-0">
                        <td className="py-3 px-2">
                          <div className="font-medium">{property.address_line}</div>
                          <div className="text-xs text-muted-foreground">
                            {property.postcode}
                          </div>
                        </td>
                        {COMPLIANCE_TYPES.map((type) => {
                          const item = propertyCompliance?.find(
                            (c) => c.compliance_type === type
                          );
                          const status = item
                            ? getComplianceStatus(item.expiry_date, item.is_manually_excluded || false)
                            : 'missing';

                          return (
                            <td key={type} className="py-3 px-2 text-center">
                              <StatusBadge status={status} expiryDate={item?.expiry_date} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

function StatusBadge({ status, expiryDate }: { status: string; expiryDate?: string | null }) {
  switch (status) {
    case 'valid':
      return (
        <Badge variant="default" className="bg-primary hover:bg-primary/90">
          {expiryDate && format(new Date(expiryDate), 'MMM yy')}
        </Badge>
      );
    case 'expiring':
      return (
        <Badge variant="default" className="bg-warning hover:bg-warning/90">
          {expiryDate && format(new Date(expiryDate), 'MMM yy')}
        </Badge>
      );
    case 'expired':
      return <Badge variant="destructive">Expired</Badge>;
    case 'excluded':
      return <Badge variant="outline">N/A</Badge>;
    default:
      return <Badge variant="secondary">Missing</Badge>;
  }
}
