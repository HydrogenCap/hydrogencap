import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Users as UsersIcon,
  BarChart3, ChevronDown, ChevronUp, ArrowUpDown, Lock, FileDown,
} from 'lucide-react';
import { usePortfolioMonthlySummary, usePropertyAnnualPerformance, useEntityFinancialSummary } from '@/hooks/useFinancialSnapshots';
import { formatGBPDecimal, formatPercent } from '@/lib/calculations';
import { FinancialStatsBar } from '@/components/financials/FinancialStatsBar';
import { NOITrendChart } from '@/components/financials/NOITrendChart';
import { CostBreakdownChart } from '@/components/financials/CostBreakdownChart';
import { PropertyPerformanceTable } from '@/components/financials/PropertyPerformanceTable';
import { EntitySummaryTable } from '@/components/financials/EntitySummaryTable';
import { SnapshotEntryModal } from '@/components/financials/SnapshotEntryModal';

export default function Financials() {
  const navigate = useNavigate();
  const { data: monthlySummary, isLoading: summaryLoading } = usePortfolioMonthlySummary(12);
  const { data: propertyPerf, isLoading: perfLoading } = usePropertyAnnualPerformance();
  const [showEntry, setShowEntry] = useState(false);
  const [entityOpen, setEntityOpen] = useState(false);

  const latestMonth = monthlySummary?.[0]?.snapshot_month;
  const { data: entitySummary, isLoading: entityLoading } = useEntityFinancialSummary(latestMonth);

  const isLoading = summaryLoading || perfLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-60" />
          <div className="grid grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-80" />
        </div>
      </AppLayout>
    );
  }

  const latest = monthlySummary?.[0];
  const trailing12NOI = monthlySummary?.reduce((sum, m) => sum + (m.total_noi || 0), 0) || 0;

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

        {/* Stats Bar */}
        <FinancialStatsBar latest={latest || null} trailing12NOI={trailing12NOI} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <NOITrendChart data={monthlySummary || []} />
          <CostBreakdownChart data={monthlySummary || []} />
        </div>

        {/* Property Performance Table */}
        <PropertyPerformanceTable data={propertyPerf || []} />

        {/* Entity Summary */}
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
      </div>

      <SnapshotEntryModal open={showEntry} onOpenChange={setShowEntry} />
    </AppLayout>
  );
}
