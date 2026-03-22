import { Building2, MapPin, Home, Bed, ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { useShareholderSession } from '@/hooks/useShareholderSession';
import { useShareholderPortfolioData } from '@/hooks/useShareholderPortfolioData';
import { LoadingState } from '@/components/common/LoadingState';
import { formatGBP } from '@/lib/calculations';

export default function PortalProperties() {
  const { canViewFinancials } = useShareholderSession();
  const { properties, loansByProperty, coverPhotoMap, isLoading } = useShareholderPortfolioData({
    includeFinancials: canViewFinancials,
    includeCompliance: false,
    includePhotos: true,
  });

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
            const propertyLoans = loansByProperty.get(property.id) || [];
            const debt = propertyLoans.reduce((sum, l) => sum + l.current_balance, 0);
            const ltv = property.current_valuation && debt
              ? (debt / property.current_valuation) * 100
              : 0;

            const coverPhotoUrl = coverPhotoMap.get(property.id);

            return (
              <Card key={property.id} className="overflow-hidden">
                {coverPhotoUrl ? (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img
                      src={coverPhotoUrl}
                      alt={property.address_line_1}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{property.address_line_1}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {property.city}, {property.postcode}
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
                    {property.total_lettable_rooms && (
                      <div className="flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        {property.total_lettable_rooms} rooms
                      </div>
                    )}
                  </div>

                  {/* Financial Summary */}
                  {canViewFinancials && (
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Value</span>
                        <span className="font-medium">
                          {formatGBP(property.current_valuation || 0)}
                        </span>
                      </div>
                      {debt > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">LTV</span>
                          <span className="font-medium">{ltv.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lifecycle */}
                  {property.lifecycle_stage && (
                    <Badge variant="outline" className="capitalize">
                      {property.lifecycle_stage.replace('_', ' ')}
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
