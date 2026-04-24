import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { HardHat } from 'lucide-react';
import { useJobCounts, useContractorJobs } from '@/hooks/useContractorJobs';
import { useMaintenanceStats } from '@/hooks/useMaintenanceRequests';
import { useWorkOrderCounts } from '@/hooks/useWorkOrders';
import JobsTab from '@/components/jobs-works/JobsTab';
import MaintenanceTab from '@/components/jobs-works/MaintenanceTab';
import WorkOrdersTab from '@/components/jobs-works/WorkOrdersTab';
import { SLATracker } from '@/components/jobs-works/SLATracker';
import { QuoteComparison } from '@/components/jobs-works/QuoteComparison';
import { JobEvidenceGallery } from '@/components/jobs-works/JobEvidenceGallery';
import { RateContractorDialog } from '@/components/contractors/RateContractorDialog';

export default function JobsAndWorks() {
  const [activeTab, setActiveTab] = useState('jobs');
  const { data: jobCounts } = useJobCounts();
  const maintenanceStats = useMaintenanceStats();
  const { data: woCounts } = useWorkOrderCounts();
  const [selectedJobId, _setSelectedJobId] = useState<string | null>(null);
  const [ratingData, setRatingData] = useState<{
    contractorId: string;
    contractorName: string;
    jobId: string;
  } | null>(null);

  // Fetch active jobs for the SLA tracker
  const { data: activeJobsData } = useContractorJobs({
    status: ['requested', 'quoted', 'accepted', 'booked', 'in_progress'],
  });

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

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2">
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

            {/* Quote Comparison & Evidence for selected job */}
            {selectedJobId && (
              <div className="mt-6 space-y-6">
                <QuoteComparison jobId={selectedJobId} />
                <JobEvidenceGallery jobId={selectedJobId} />
              </div>
            )}
          </div>

          {/* Sidebar - SLA Tracker */}
          <div className="space-y-6">
            <SLATracker jobs={activeJobsData?.items || []} />
          </div>
        </div>
      </div>

      <RateContractorDialog
        contractorId={ratingData?.contractorId ?? null}
        contractorName={ratingData?.contractorName}
        jobId={ratingData?.jobId ?? null}
        open={!!ratingData}
        onOpenChange={(open) => !open && setRatingData(null)}
      />
    </AppLayout>
  );
}
