import { Building2, MapPin, Home, Bed } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { useShareholderSession } from '@/hooks/useShareholderSession';
import { useShareholderPortfolioData } from '@/hooks/useShareholderPortfolioData';
import { LoadingState } from '@/components/common/LoadingState';
import { formatGBP } from '@/lib/calculations';

export default function PortalProperties() {
  const { canViewFinancials } = useShareholderSession();
  const { properties, isLoading } = useShareholderPortfolioData();

  if (isLoading) {
    return (
      <PortalLayout>
        <LoadingState text="Loading properties..." />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-muted-foreground">
            Detailed view of all properties in the portfolio
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties?.map((property) => {
            const loan = property.loans?.[0];
            const ltv = property.current_value_gbp && loan?.current_mortgage_balance_gbp
              ? (loan.current_mortgage_balance_gbp / property.current_value_gbp) * 100
              : 0;

            return (
              <Card key={property.id} className="overflow-hidden">
                {/* Property Image Placeholder */}
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <Building2 className="h-12 w-12 text-muted-foreground/50" />
                </div>

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{property.address_line}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {property.town_city}, {property.postcode}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {property.property_type?.replace('_', ' ') || 'Unknown'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Property Details */}
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {property.beds && (
                      <div className="flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        {property.beds} beds
                      </div>
                    )}
                    {property.tenure && (
                      <div className="flex items-center gap-1">
                        <Home className="h-4 w-4" />
                        {property.tenure}
                      </div>
                    )}
                  </div>

                  {/* Financial Summary */}
                  {canViewFinancials && (
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Value</span>
                        <span className="font-medium">
                          {formatGBP(property.current_value_gbp || 0)}
                        </span>
                      </div>
                      {loan?.current_mortgage_balance_gbp && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">LTV</span>
                          <span className="font-medium">{ltv.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lifecycle */}
                  {property.lifecycle_type && (
                    <Badge variant="outline" className="capitalize">
                      {property.lifecycle_type.replace('_', ' ')}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(!properties || properties.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              No properties available to view.
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
