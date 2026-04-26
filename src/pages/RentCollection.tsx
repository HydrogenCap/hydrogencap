import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PoundSterling, Download, FileSpreadsheet, Link2, CalendarDays, AlertTriangle, History, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRentSchedule } from '@/hooks/useRentCollection';
import { exportRentRollCSV } from '@/lib/rentCsvExporter';
import { RentDashboardStrip } from '@/components/rent/RentDashboardStrip';
import { RentRollTable } from '@/components/rent/RentRollTable';
import { ArrearsTracker } from '@/components/rent/ArrearsTracker';
import { ArrearsRiskPanel } from '@/components/rent/ArrearsRiskPanel';
import { RentCalendar } from '@/components/rent/RentCalendar';
import { PaymentHistoryList } from '@/components/rent/PaymentHistoryList';
import { BankStatementImportDialog } from '@/components/rent/BankStatementImportDialog';
import { DensityToggle } from '@/components/DensityToggle';
import { format, startOfMonth } from 'date-fns';

export default function RentCollection() {
  const navigate = useNavigate();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('rent-roll');

  const monthStr = format(startOfMonth(new Date()), 'yyyy-MM');
  const { data: currentMonthData } = useRentSchedule({ month: monthStr });
  const currentMonthSchedule = currentMonthData?.items;

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PoundSterling className="h-6 w-6" />
              Rent Collection
            </h1>
            <p className="text-muted-foreground">Track rent payments, arrears, and collection performance</p>
          </div>
          <div className="flex items-center gap-2">
            <DensityToggle />
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Import Statement
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/rent/reconciliation')}>
              <Link2 className="h-4 w-4 mr-1" />
              Reconciliation
            </Button>
            {currentMonthSchedule && (
              <Button variant="outline" size="sm" onClick={() => exportRentRollCSV(currentMonthSchedule)}>
                <Download className="h-4 w-4 mr-1" />
                Export Rent Roll
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rent-roll" className="gap-1.5">
              <List className="h-4 w-4" />
              Rent Roll
            </TabsTrigger>
            <TabsTrigger value="arrears" className="gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Arrears
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Rent Roll */}
          <TabsContent value="rent-roll" className="space-y-6">
            <RentDashboardStrip />
            <RentRollTable month={monthStr} />
          </TabsContent>

          {/* Tab 2: Arrears */}
          <TabsContent value="arrears" className="space-y-6">
            <ArrearsTracker />
            <ArrearsRiskPanel />
          </TabsContent>

          {/* Tab 3: Calendar */}
          <TabsContent value="calendar">
            <RentCalendar />
          </TabsContent>

          {/* Tab 4: History */}
          <TabsContent value="history">
            <PaymentHistoryList />
          </TabsContent>
        </Tabs>

        {/* Import Dialog */}
        <BankStatementImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onSuccess={() => navigate('/rent/reconciliation')}
        />
      </div>
    </AppLayout>
  );
}
