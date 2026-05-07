import { Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DensityToggle } from '@/components/DensityToggle';
import { useReportsState } from './hooks/useReportsState';
import { ReportFiltersCard } from './components/ReportFiltersCard';
import { ReportTemplatesGrid } from './components/ReportTemplatesGrid';
import { ReportHistoryTable } from './components/ReportHistoryTable';
import { BrokerPackDialog } from './components/BrokerPackDialog';
import { RoomPerformanceSection } from './components/RoomPerformanceSection';
import { SEO } from '@/components/SEO';

export default function Reports() {
  const s = useReportsState();

  if (s.isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SEO title="Reports — TenureIQ" description="Lender-ready reports in two clicks — portfolio summaries, rent rolls, and bank presentations." />
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground">
              Generate professional PDF reports for compliance, brokers, and stakeholders
            </p>
          </div>
          <DensityToggle />
        </div>

        <Tabs defaultValue="generate" className="space-y-6">
          <TabsList>
            <TabsTrigger value="generate">Generate Reports</TabsTrigger>
            <TabsTrigger value="history">Report History</TabsTrigger>
            <TabsTrigger value="room-performance">Room Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-6">
            <ReportFiltersCard
              lifecycleType={s.lifecycleType}
              setLifecycleType={s.setLifecycleType}
              selectionMode={s.selectionMode}
              setSelectionMode={s.setSelectionMode}
              selectedPropertyId={s.selectedPropertyId}
              setSelectedPropertyId={s.setSelectedPropertyId}
              includeAttachments={s.includeAttachments}
              setIncludeAttachments={s.setIncludeAttachments}
              lifecycleFilteredProperties={s.lifecycleFilteredProperties}
              filteredProperties={s.filteredProperties}
            />
            <ReportTemplatesGrid
              filteredProperties={s.filteredProperties}
              isPending={s.generateReport.isPending}
              onGenerate={s.handleGenerateReport}
            />
          </TabsContent>

          <TabsContent value="history">
            <ReportHistoryTable
              reportHistory={s.reportHistory}
              historyLoading={s.historyLoading}
              deletingPath={s.deletingPath}
              onDelete={s.handleDeleteReport}
            />
          </TabsContent>

          <TabsContent value="room-performance">
            <RoomPerformanceSection />
          </TabsContent>
        </Tabs>

        <BrokerPackDialog
          open={s.showBrokerPackDialog}
          onOpenChange={s.setShowBrokerPackDialog}
          propertyForBrokerPack={s.propertyForBrokerPack}
          companyForBrokerPack={s.companyForBrokerPack}
          brokerPackValidation={s.brokerPackValidation}
          loanPurpose={s.loanPurpose}
          setLoanPurpose={s.setLoanPurpose}
          targetLoanAmount={s.targetLoanAmount}
          setTargetLoanAmount={s.setTargetLoanAmount}
          targetLTV={s.targetLTV}
          setTargetLTV={s.setTargetLTV}
          preparedFor={s.preparedFor}
          setPreparedFor={s.setPreparedFor}
          brokerNotes={s.brokerNotes}
          setBrokerNotes={s.setBrokerNotes}
          isPending={s.generateReport.isPending}
          onGenerate={s.handleGenerateBrokerPack}
        />
      </div>
    </AppLayout>
  );
}
