import { PropertyLoansSection } from '@/components/lending/PropertyLoansSection';

interface Props {
  propertyId: string;
  entityId: string;
  entities: { id: string; entity_name: string }[];
  propertyValuation: number | null;
}

export function LendingTab({ propertyId, entityId, entities, propertyValuation }: Props) {
  return (
    <div className="space-y-6">
      <PropertyLoansSection
        propertyId={propertyId}
        entityId={entityId}
        entities={entities}
        propertyValuation={propertyValuation}
      />
    </div>
  );
}
