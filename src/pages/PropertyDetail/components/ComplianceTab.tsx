import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyComplianceSection } from '@/components/compliance-v2/PropertyComplianceSection';
import { RequirementsEditor } from '@/components/compliance-v2/RequirementsEditor';
import { usePropertyComplianceV2 } from '@/hooks/useComplianceV2';

export function ComplianceTab({ propertyId, orgId }: { propertyId: string; orgId: string }) {
  const { data: matrixRows, isLoading } = usePropertyComplianceV2(propertyId);
  if (isLoading) return <Skeleton className="h-48" />;
  if (!matrixRows || matrixRows.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Compliance</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-center py-6">No compliance requirements generated yet.</p></CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <PropertyComplianceSection matrixRows={matrixRows} propertyId={propertyId} orgId={orgId} />
      <RequirementsEditor matrixRows={matrixRows} />
    </div>
  );
}
