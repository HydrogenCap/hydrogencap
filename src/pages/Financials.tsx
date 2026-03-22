import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3, ChevronDown, ChevronUp, FileDown,
} from 'lucide-react';
import { usePortfolioFinancials } from '@/hooks/usePortfolioFinancials';
import { usePortfolioMonthlySummary, usePropertyAnnualPerformance, useEntityFinancialSummary } from '@/hooks/useFinancialSnapshots';
import { PortfolioKPIRow } from '@/components/financials/PortfolioKPIRow';
import { PortfolioTrendChart } from '@/components/financials/PortfolioTrendChart';
import { PortfolioCostBreakdown } from '@/components/financials/PortfolioCostBreakdown';
import { LivePropertyTable } from '@/components/financials/LivePropertyTable';
import { PortfolioQuickStats } from '@/components/financials/PortfolioQuickStats';
import { FinancialStatsBar } from '@/components/financials/FinancialStatsBar';
import { NOITrendChart } from '@/components/financials/NOITrendChart';
import { CostBreakdownChart } from '@/components/financials/CostBreakdownChart';
import { PropertyPerformanceTable } from '@/components/financials/PropertyPerformanceTable';
import { EntitySummaryTable } from '@/components/financials/EntitySummaryTable';
import { SnapshotEntryModal } from '@/components/financials/SnapshotEntryModal';

export default function Financials() {
  const navigate = useNavigate();
  const [showEntry, setShowEntry] = useState(false);
  const [entityOpen, setEntityOpen] = useState(false);
  const [tab, setTab] = useState<'live' | 'snapshots'>('live');

  // Live data
  const { data: liveData, isLoading: liveLoading } = usePortfolioFinancials();

  // Snapshot data (legacy)
  const { data: monthlySummary, isLoading: summaryLoading } = usePortfolioMonthlySummary(12);
  const { data: propertyPerf, isLoading: perfLoading } = usePropertyAnnualPerformance();
  const latestMonth = monthlySummary?.[0]?.snapshot_month;
  const { data: entitySummary, isLoading: entityLoading } = useEntityFinancialSummary(latestMonth);

  const latest = monthlySummary?.[0];
  const trailing12NOI = monthlySummary?.reduce((sum, m) => sum + (m.total_noi || 0), 0) || 0;

  if (liveLoading && summaryLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-60" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-80" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financials</h1>
            <p className="text-muted-foreground text-sm">Portfolio financial performance and reporting</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/accounting')}>
              <FileDown className="h-4 w-4 mr-2" /> Export Data
            </Button>
            <Button onClick={() => setShowEntry(true)}>
              <BarChart3 className="h-4 w-4 mr-2" /> Record Monthly Figures
            </Button>
          </div>
        </div>

        {/* Tabs: Live vs Snapshots */}
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'live' | 'snapshots')}>
          <TabsList>
            <TabsTrigger value="live">Live P&L</TabsTrigger>
            <TabsTrigger value="snapshots">Manual Snapshots</TabsTrigger>
          </TabsList>

          {/* ─── LIVE TAB ─── */}
          <TabsContent value="live" className="space-y-6 mt-4">
            {liveData && (
              <>
                <PortfolioKPIRow data={liveData} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PortfolioTrendChart data={liveData.monthlyTrend} />
                  <PortfolioCostBreakdown data={liveData.costBreakdown} />
                </div>

                <LivePropertyTable data={liveData.properties} />

                <PortfolioQuickStats data={liveData} />
              </>
            )}
            {!liveData && !liveLoading && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No property data yet. Add properties with tenancies and rent payments to see live financials.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── SNAPSHOTS TAB ─── */}
          <TabsContent value="snapshots" className="space-y-6 mt-4">
            <FinancialStatsBar latest={latest || null} trailing12NOI={trailing12NOI} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <NOITrendChart data={monthlySummary || []} />
              <CostBreakdownChart data={monthlySummary || []} />
            </div>

            <PropertyPerformanceTable data={propertyPerf || []} />

            <Collapsible open={entityOpen} onOpenChange={setEntityOpen}>
              <Card>
                <CardHeader className="cursor-pointer" onClick={() => setEntityOpen(!entityOpen)}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between w-full">
                      <CardTitle className="text-lg">Entity Performance Summary</CardTitle>
                      {entityOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <EntitySummaryTable data={entitySummary || []} isLoading={entityLoading} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </TabsContent>
        </Tabs>
      </div>

      <SnapshotEntryModal open={showEntry} onOpenChange={setShowEntry} />
    </AppLayout>
  );
}
