import { AppLayout } from '@/components/layout/AppLayout';
import { OwnershipFlowchart } from '@/components/ownership/OwnershipFlowchart';

export default function Ownership() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Ownership Structure</h1>
          <p className="text-muted-foreground text-sm">
            Click a person or company to filter · Double-click for full details
          </p>
        </div>
        <OwnershipFlowchart />
      </div>
    </AppLayout>
  );
}
