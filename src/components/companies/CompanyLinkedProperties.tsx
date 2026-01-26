import React from 'react';
import { Link } from 'react-router-dom';
import { Building, ExternalLink, MapPin, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyProperties, calculateCompanyPropertyStats } from '@/hooks/useCompanyProperties';
import { formatGBP, formatPercent } from '@/lib/calculations';

interface CompanyLinkedPropertiesProps {
  companyId: string;
}

export function CompanyLinkedProperties({ companyId }: CompanyLinkedPropertiesProps) {
  const { data: properties, isLoading, error } = useCompanyProperties(companyId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Linked Properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Linked Properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load linked properties</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = properties ? calculateCompanyPropertyStats(properties) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Linked Properties
          </div>
          {properties && properties.length > 0 && (
            <Badge variant="secondary">{properties.length} properties</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!properties || properties.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No properties linked to this company
          </p>
        ) : (
          <div className="space-y-4">
            {/* Stats summary */}
            {stats && (
              <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.legallyOwnedCount}</p>
                  <p className="text-xs text-muted-foreground">Legal Owner</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.beneficiallyOwnedCount}</p>
                  <p className="text-xs text-muted-foreground">Beneficial</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{formatGBP(stats.totalValueExposure)}</p>
                  <p className="text-xs text-muted-foreground">Exposure</p>
                </div>
              </div>
            )}

            {/* Properties list */}
            <div className="space-y-3">
              {properties.map((property) => (
                <Link
                  key={property.id}
                  to={`/properties/${property.id}`}
                  className="block p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium">{property.address_line}</p>
                        <p className="text-sm text-muted-foreground">
                          {[property.area_name, property.postcode].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  
                  {/* Financial details */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    {property.current_value_gbp !== null && (
                      <div>
                        <p className="text-muted-foreground text-xs">Value</p>
                        <p className="font-medium">{formatGBP(property.current_value_gbp)}</p>
                      </div>
                    )}
                    {property.isLegalOwner && (
                      <div>
                        <p className="text-muted-foreground text-xs">Ownership</p>
                        <Badge variant="default" className="text-xs">
                          Legal Owner {property.legalOwnerPercent !== null && property.legalOwnerPercent !== 100 
                            ? `(${formatPercent(property.legalOwnerPercent)})` 
                            : '(100%)'}
                        </Badge>
                      </div>
                    )}
                    {property.beneficialPercent !== null && (
                      <div>
                        <p className="text-muted-foreground text-xs">Beneficial</p>
                        <Badge variant="outline" className="text-xs">
                          {formatPercent(property.beneficialPercent)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
