import { format } from 'date-fns';
import { AlertTriangle, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  useUntrackedVoids,
  useCreateVoidPeriod,
} from '@/hooks/useVoidPeriods';
import { VoidDashboard } from '@/components/voids/VoidDashboard';
import { SEO } from '@/components/SEO';

export default function Voids() {
  const { data: untrackedVoids } = useUntrackedVoids();
  const createVoid = useCreateVoidPeriod();

  const handleRecordVoid = (roomId: string, propertyId: string) => {
    createVoid.mutate({
      propertyId,
      roomId,
      startDate: format(new Date(), 'yyyy-MM-dd'),
      reason: 'between_tenants',
    });
  };

  return (
    <AppLayout>
      <SEO title="Voids & Lettings — TenureIQ" description="Track every void, lead, and viewing through to a signed tenancy." />
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Void Management</h1>
            <p className="text-muted-foreground">Track empty rooms and their financial impact</p>
          </div>
        </div>

        {/* Untracked Voids Alert */}
        {untrackedVoids && untrackedVoids.length > 0 && (
          <Alert variant="destructive" className="border-warning bg-warning/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-warning">{untrackedVoids.length} rooms may be void</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="text-sm mb-3">These rooms have no active tenancy and no void period recorded.</p>
              <div className="space-y-2">
                {untrackedVoids.map(uv => (
                  <div key={uv.roomId} className="flex items-center justify-between bg-background/50 rounded-md px-3 py-2">
                    <div>
                      <span className="font-medium">{uv.roomName}</span>
                      <span className="text-muted-foreground text-sm ml-2">{uv.propertyAddress}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecordVoid(uv.roomId, uv.propertyId)}
                      disabled={createVoid.isPending}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Record Void
                    </Button>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* VoidDashboard: KPIs, active table, bar chart, end-void dialog */}
        <VoidDashboard />
      </div>
    </AppLayout>
  );
}
