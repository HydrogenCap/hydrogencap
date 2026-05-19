import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PoundSterling, Download, FileSpreadsheet, Link2, CalendarDays, AlertTriangle, History, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useRentSchedule, useArrears } from '@/hooks/useRentCollection';
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
import { SEO } from '@/components/SEO';

const VALID_TABS = ['rent-roll', 'arrears', 'calendar', 'history'] as const;
type RentTab = typeof VALID_TABS[number];

export default function RentCollection() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const initialTab = (VALID_TABS as readonly string[]).includes(searchParams.get('tab') ?? '')
    ? (searchParams.get('tab') as RentTab)
    : 'rent-roll';
  const [activeTab, setActiveTab] = useState<RentTab>(initialTab);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && (VALID_TABS as readonly string[]).includes(t) && t !== activeTab) {
      setActiveTab(t as RentTab);
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as RentTab);
    const next = new URLSearchParams(searchParams);
    if (value === 'rent-roll') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  const monthStr = format(startOfMonth(new Date()), 'yyyy-MM');
  const { data: currentMonthData } = useRentSchedule({ month: monthStr });
  const currentMonthSchedule = currentMonthData?.items;
  const { data: arrearsData } = useArrears();
  const arrearsCount = arrearsData?.length ?? 0;


  return (
    <AppLayout>
      <SEO title="Rent Collection — TenureIQ" description="Reconcile rent against bank statements and chase arrears in a couple of clicks." />
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
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="rent-roll" className="gap-1.5">
              <List className="h-4 w-4" />
              Rent Roll
            </TabsTrigger>
            <TabsTrigger value="arrears" className="gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Arrears
              {arrearsCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{arrearsCount}</Badge>
              )}
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
