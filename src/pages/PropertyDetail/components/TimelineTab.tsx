import { Card, CardContent } from '@/components/ui/card';
import { PropertyTimeline } from '@/components/property-detail/PropertyTimeline';
import { InlineAuditHistory } from '@/components/audit/InlineAuditHistory';

export function TimelineTab({ propertyId }: { propertyId: string }) {
  return (
    <div className="space-y-6">
      <PropertyTimeline propertyId={propertyId} />
      <Card>
        <CardContent className="pt-4">
          <InlineAuditHistory tableName="properties_v2" recordId={propertyId} title="Property Change History" />
        </CardContent>
      </Card>
    </div>
  );
}
