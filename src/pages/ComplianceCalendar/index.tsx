import { CalendarCheck, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComplianceItemDrawer } from '@/components/compliance/ComplianceItemDrawer';
import { RenewalWorkflowDialog } from '@/components/compliance/RenewalWorkflowDialog';
import { RenewalQueue } from '@/components/compliance/RenewalQueue';
import { useComplianceCalendar } from './hooks/useComplianceCalendar';
import { ComplianceCalendarSkeleton } from './components/ComplianceCalendarSkeleton';
import { CalendarHeader } from './components/CalendarHeader';
import { StatusCardsRow } from './components/StatusCardsRow';
import { CalendarGrid } from './components/CalendarGrid';
import { UpcomingEventsList } from './components/UpcomingEventsList';
import { CalendarLegend } from './components/CalendarLegend';
import { SEO } from '@/components/SEO';
import { ComplianceHubTabs } from '@/components/compliance/ComplianceHubTabs';

export default function ComplianceCalendar() {
  const c = useComplianceCalendar();

  if (c.isLoading) {
    return <ComplianceCalendarSkeleton />;
  }

  return (
    <AppLayout>
      <SEO title="Compliance Calendar — TenureIQ" description="Never miss a compliance deadline — gas, EICR, EPC, insurance, and refinancing in one calendar." />
      <div className="space-y-6">
        <CalendarHeader visibleEventTypes={c.visibleEventTypes} toggleEventType={c.toggleEventType} />

        <StatusCardsRow stats={c.stats} selectedStatus={c.selectedStatus} onClick={c.handleStatusClick} />

        <Tabs value={c.activeTab} onValueChange={c.setActiveTab}>
          <TabsList>
            <TabsTrigger value="calendar" className="flex items-center gap-1.5">
              <CalendarCheck className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="renewals" className="flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Renewal Queue
              {c.renewalQueueCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] h-5 min-w-[20px] px-1">
                  {c.renewalQueueCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <CalendarGrid
                currentMonth={c.currentMonth}
                paddedDays={c.paddedDays}
                filteredEventsByDate={c.filteredEventsByDate}
                isInRenewalWindow={c.isInRenewalWindow}
                handleExpiryClick={c.handleExpiryClick}
                navigateMonth={c.navigateMonth}
                setCurrentMonth={c.setCurrentMonth}
              />
              <UpcomingEventsList upcomingEvents={c.upcomingEvents} handleExpiryClick={c.handleExpiryClick} />
            </div>

            <CalendarLegend />
          </TabsContent>

          <TabsContent value="renewals" className="mt-4">
            <RenewalQueue />
          </TabsContent>
        </Tabs>
      </div>

      <ComplianceItemDrawer
        open={c.drawerOpen}
        onOpenChange={c.setDrawerOpen}
        selectedStatus={c.selectedStatus}
        items={c.filteredItems}
        onItemUpdated={c.handleItemUpdated}
      />

      {c.renewalDialogItem && (
        <RenewalWorkflowDialog
          open={!!c.renewalDialogItem}
          onOpenChange={(open) => { if (!open) c.setRenewalDialogItem(null); }}
          complianceItem={c.renewalDialogItem}
          propertyAddress={c.renewalDialogItem.propertyAddress}
          onComplete={c.handleRenewalComplete}
        />
      )}
    </AppLayout>
  );
}
