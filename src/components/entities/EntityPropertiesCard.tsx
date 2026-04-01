import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PROPERTY_TYPES, LIFECYCLE_STAGES, type PropertyV2 } from '@/hooks/usePropertiesV2';

interface EntityPropertiesCardProps {
  entityProperties: PropertyV2[] | undefined;
  onNavigateToProperty: (propertyId: string) => void;
}

export function EntityPropertiesCard({
  entityProperties,
  onNavigateToProperty,
}: EntityPropertiesCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Properties <Badge variant="secondary" className="ml-2">{entityProperties?.length || 0}</Badge></CardTitle>
      </CardHeader>
      <CardContent>
        {entityProperties && entityProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entityProperties.map(p => {
              const typeLabel = PROPERTY_TYPES.find(t => t.value === p.property_type)?.label || p.property_type;
              const stageLabel = LIFECYCLE_STAGES.find(s => s.value === p.lifecycle_stage)?.label || p.lifecycle_stage;
              return (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onNavigateToProperty(p.id)}
                >
                  <CardContent className="pt-3 pb-2 space-y-1">
                    <p className="font-semibold text-sm text-foreground">{p.address_line_1}, {p.city}</p>
                    <p className="text-xs text-muted-foreground">{p.postcode}</p>
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
