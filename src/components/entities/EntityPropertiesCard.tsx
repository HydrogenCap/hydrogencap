import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PROPERTY_TYPES, LIFECYCLE_STAGES, type PropertyV2 } from '@/hooks/usePropertiesV2';
import { usePropertyRoomSummaries } from '@/hooks/useRoomsV2';

interface EntityPropertiesCardProps {
  entityProperties: PropertyV2[] | undefined;
  onNavigateToProperty: (propertyId: string) => void;
}

function formatGBP(value: number | null | undefined) {
  if (value == null || value === 0) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getPropertyMonthlyRent(property: PropertyV2, roomSummaries: ReturnType<typeof usePropertyRoomSummaries>['data']) {
  if (property.rent_basis === 'whole_house') return property.whole_house_rent_pcm || 0;
  return roomSummaries?.get(property.id)?.gross_rent_pcm || 0;
}

export function EntityPropertiesCard({
  entityProperties,
  onNavigateToProperty,
}: EntityPropertiesCardProps) {
  const { data: roomSummaries } = usePropertyRoomSummaries();
  const properties = entityProperties || [];

  const summary = useMemo(() => ({
    propertyCount: properties.length,
    totalValuation: properties.reduce((sum, property) => sum + (property.current_valuation || 0), 0),
    totalMonthlyRent: properties.reduce((sum, property) => sum + getPropertyMonthlyRent(property, roomSummaries), 0),
  }), [properties, roomSummaries]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Properties <Badge variant="secondary" className="ml-2">{summary.propertyCount}</Badge></CardTitle>
        {summary.propertyCount > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Value: </span>
              <span className="font-semibold text-foreground">{formatGBP(summary.totalValuation)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Monthly rent: </span>
              <span className="font-semibold text-foreground">{formatGBP(summary.totalMonthlyRent)}</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {properties.map(p => {
              const typeLabel = PROPERTY_TYPES.find(t => t.value === p.property_type)?.label || p.property_type;
              const stageLabel = LIFECYCLE_STAGES.find(s => s.value === p.lifecycle_stage)?.label || p.lifecycle_stage;
              return (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onNavigateToProperty(p.id)}
                >
                  <CardContent className="pt-3 pb-2 space-y-2">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{p.address_line_1}, {p.city}</p>
                      <p className="text-xs text-muted-foreground">{p.postcode}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Value</span>
                        <p className="font-semibold text-foreground">{formatGBP(p.current_valuation)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rent</span>
                        <p className="font-semibold text-foreground">{formatGBP(getPropertyMonthlyRent(p, roomSummaries))}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
                      <Badge variant="secondary" className="text-xs">{stageLabel}</Badge>
                      <span className="text-xs text-muted-foreground">{p.total_lettable_rooms || 0} rooms</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-6">
            No properties linked to this entity yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
