import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { HardHat } from 'lucide-react';
import { useJobCounts } from '@/hooks/useContractorJobs';
import { useMaintenanceStats } from '@/hooks/useMaintenanceRequests';
import { useWorkOrderCounts } from '@/hooks/useWorkOrders';
import JobsTab from '@/components/jobs-works/JobsTab';
import MaintenanceTab from '@/components/jobs-works/MaintenanceTab';
import WorkOrdersTab from '@/components/jobs-works/WorkOrdersTab';

export default function JobsAndWorks() {
  const [activeTab, setActiveTab] = useState('jobs');
  const { data: jobCounts } = useJobCounts();
  const maintenanceStats = useMaintenanceStats();
  const { data: woCounts } = useWorkOrderCounts();

  const activeJobCount = (jobCounts?.total || 0) - (jobCounts?.draft || 0);
  const openMaintenanceCount = maintenanceStats?.open || 0;
  const activeWOCount = (woCounts?.awaitingApproval || 0) + (woCounts?.inProgress || 0);

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardHat className="h-6 w-6" />
            Jobs &amp; Works
          </h1>
          <p className="text-muted-foreground">
            Manage contractor jobs, maintenance requests, and work orders in one place
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="jobs" className="gap-2">
              Jobs
              {activeJobCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                  {activeJobCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="gap-2">
              Maintenance
              {openMaintenanceCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                  {openMaintenanceCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="work-orders" className="gap-2">
              Work Orders
              {activeWOCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                  {activeWOCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="mt-6">
            <JobsTab />
          </TabsContent>
          <TabsContent value="maintenance" className="mt-6">
            <MaintenanceTab />
          </TabsContent>
          <TabsContent value="work-orders" className="mt-6">
            <WorkOrdersTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
