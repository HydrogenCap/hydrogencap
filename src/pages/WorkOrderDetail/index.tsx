import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState, MobileDetailsSheet } from '@/components/common';
import { useWorkOrderDetailState } from './hooks/useWorkOrderDetailState';
import { WorkOrderHeader } from './components/WorkOrderHeader';
import { ActionButtons } from './components/ActionButtons';
import { DetailsTab } from './components/DetailsTab';
import { CostsTab } from './components/CostsTab';
import { MaterialsTab } from './components/MaterialsTab';
import { WarrantyTab } from './components/WarrantyTab';
import { WorkOrderDialogs } from './components/WorkOrderDialogs';

export default function WorkOrderDetail() {
  const state = useWorkOrderDetailState();
  const { wo, isLoading } = state;

  if (isLoading) return <AppLayout><LoadingState text="Loading work order..." /></AppLayout>;
  if (!wo) return <AppLayout><div className="container py-6">Work order not found.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="container py-6 space-y-6 pb-24 lg:pb-6">
        <WorkOrderHeader state={state} />

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="overflow-x-auto max-w-full justify-start">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="warranty">Warranty</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-6"><DetailsTab state={state} /></TabsContent>
          <TabsContent value="costs" className="space-y-6"><CostsTab state={state} /></TabsContent>
          <TabsContent value="materials" className="space-y-6"><MaterialsTab state={state} /></TabsContent>
          <TabsContent value="warranty" className="space-y-6"><WarrantyTab state={state} /></TabsContent>
        </Tabs>
      </div>

      <MobileDetailsSheet title="Work Order Actions" triggerLabel="Actions">
        <ActionButtons state={state} />
      </MobileDetailsSheet>

      <WorkOrderDialogs state={state} />
    </AppLayout>
  );
}
