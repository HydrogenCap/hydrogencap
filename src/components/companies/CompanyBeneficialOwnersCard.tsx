import React from 'react';
import { Link } from 'react-router-dom';
import { Users, MapPin, ExternalLink, AlertTriangle, Building2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCompanyPropertiesWithBeneficialOwners } from '@/hooks/useCompanyProperties';
import { formatPercent } from '@/lib/calculations';

interface CompanyBeneficialOwnersCardProps {
  companyId: string;
}

export function CompanyBeneficialOwnersCard({ companyId }: CompanyBeneficialOwnersCardProps) {
  const { data: properties, isLoading } = useCompanyPropertiesWithBeneficialOwners(companyId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficial Ownership Split
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficial Ownership Split
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            This company is not the legal owner of any properties
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Beneficial Ownership Split
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Showing beneficial ownership for properties where this company is the legal owner (SPV).
        </p>

        {properties.map((property) => {
          const totalPercent = property.beneficialOwners.reduce(
            (sum, bo) => sum + bo.beneficial_percent,
            0
          );
          const isComplete = Math.abs(totalPercent - 100) < 0.01;

          return (
            <div
              key={property.id}
              className="border rounded-lg p-4 space-y-3"
            >
              {/* Property Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Link
                      to={`/properties/${property.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {property.address_line}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[property.area_name, property.postcode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
                <Link to={`/properties/${property.id}#ownership`}>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Edit on Property
                  </Button>
                </Link>
              </div>

              {/* Beneficial Owners List */}
              {property.beneficialOwners.length === 0 ? (
                <Alert variant="destructive" className="bg-warning/10 border-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No beneficial owners recorded for this property
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {property.beneficialOwners.map((bo) => (
                    <div
                      key={bo.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        {bo.owner_type === 'COMPANY' ? (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">
                          {bo.company?.legal_name || bo.party?.display_name || 'Unknown'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {bo.owner_type === 'COMPANY' ? 'Company' : bo.party?.party_type || 'Person'}
                        </Badge>
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {formatPercent(bo.beneficial_percent)}
                      </Badge>
                    </div>
                  ))}

                  {/* Total Row */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium">Total</span>
                    <Badge
                      variant={isComplete ? 'default' : 'destructive'}
                      className="font-mono"
                    >
                      {formatPercent(totalPercent)}
                    </Badge>
                  </div>

                  {!isComplete && (
                    <Alert variant="destructive" className="bg-warning/10 border-warning mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Beneficial ownership must total 100%
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
