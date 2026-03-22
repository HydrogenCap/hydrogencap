import { useMemo } from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { useShareholderSession } from '@/hooks/useShareholderSession';
import { useShareholderPortfolioData } from '@/hooks/useShareholderPortfolioData';
import { LoadingState } from '@/components/common/LoadingState';
import { Navigate } from 'react-router-dom';
import { formatPercent } from '@/lib/calculations';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';

export default function PortalCompliance() {
  const { canViewCompliance } = useShareholderSession();
  const { properties, complianceRows, isLoading } = useShareholderPortfolioData({
    includeFinancials: false,
    includeCompliance: canViewCompliance,
    includePhotos: false,
  });

  // Derive which doc types exist in the matrix
  const activeDocTypes = useMemo(() => {
    if (!complianceRows?.length) return [];
    const types = new Set<string>();
    complianceRows.forEach(r => {
      if (r.document_type && r.is_required) types.add(r.document_type);
    });
    return Array.from(types).sort();
  }, [complianceRows]);

  const stats = useMemo(() => {
    if (!complianceRows?.length) return { valid: 0, expiring: 0, expired: 0, missing: 0, notRequired: 0, total: 0 };

    const required = complianceRows.filter(r => r.is_required);
    let valid = 0, expiring = 0, expired = 0, missing = 0;

    required.forEach((row) => {
      const status = row.calculated_status;
      if (status === 'valid') valid++;
      else if (status === 'expiring_soon') expiring++;
      else if (status === 'expired') expired++;
      else if (status === 'missing') missing++;
    });

    return { valid, expiring, expired, missing, notRequired: complianceRows.length - required.length, total: required.length };
  }, [complianceRows]);

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
                Expired / Missing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.expired + stats.missing}</div>
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
                    {activeDocTypes.map((type) => (
                      <th key={type} className="text-center py-3 px-2 font-medium text-xs">
                        {(DOC_TYPE_DISPLAY_NAMES as Record<string, string>)[type] || type}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {properties?.map((property) => {
                    const propertyRows = complianceRows?.filter(r => r.property_id === property.id && r.is_required) || [];

                    return (
                      <tr key={property.id} className="border-b last:border-0">
                        <td className="py-3 px-2">
                          <div className="font-medium">{property.address_line_1}</div>
                          <div className="text-xs text-muted-foreground">{property.postcode}</div>
                        </td>
                        {activeDocTypes.map((docType) => {
                          const row = propertyRows.find(r => r.document_type === docType);
                          const status = row?.calculated_status || 'missing';
                          return (
                            <td key={docType} className="py-3 px-2 text-center">
                              <StatusBadge status={status} expiryDate={row?.expiry_date} />
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
    case 'expiring_soon':
      return (
        <Badge variant="default" className="bg-warning hover:bg-warning/90">
          {expiryDate && format(new Date(expiryDate), 'MMM yy')}
        </Badge>
      );
    case 'expired':
      return <Badge variant="destructive">Expired</Badge>;
    case 'not_required':
      return <Badge variant="outline">N/A</Badge>;
    case 'missing':
    default:
      return <Badge variant="secondary">Missing</Badge>;
  }
}
