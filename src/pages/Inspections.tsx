import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  ClipboardCheck, Calendar, FileText, LayoutTemplate,
  AlertTriangle, CheckCircle2, Clock, TrendingUp,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/common';
import {
  useInspections,
  INSPECTION_TYPES,
  CONDITION_RATINGS,
  type InspectionWithProperty,
  type ConditionRating,
} from '@/hooks/useInspections';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { InspectionScheduler } from '@/components/inspections/InspectionScheduler';
import { InspectionChecklist } from '@/components/inspections/InspectionChecklist';
import { InspectionReport } from '@/components/inspections/InspectionReport';
import { InspectionTemplateEditor } from '@/components/inspections/InspectionTemplateEditor';

function conditionScore(condition: ConditionRating | null): number {
  const scores: Record<string, number> = { excellent: 5, good: 4, fair: 3, poor: 2, critical: 1 };
  return condition ? scores[condition] || 0 : 0;
}

function InspectionCard({ inspection, onClick }: { inspection: InspectionWithProperty; onClick?: () => void }) {
  const typeLabel = INSPECTION_TYPES.find(t => t.value === inspection.inspection_type)?.label;
  const conditionRating = CONDITION_RATINGS.find(c => c.value === inspection.overall_condition);

  return (
    <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={onClick}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {inspection.property?.address_line_1 || 'Unknown Property'}
            </p>
            <p className="text-xs text-muted-foreground">
              {inspection.property?.city}
              {inspection.property?.postcode && `, ${inspection.property.postcode}`}
            </p>
          </div>
          <Badge className={cn('text-[10px] shrink-0',
            inspection.status === 'completed' && 'bg-green-500/10 text-green-700',
            inspection.status === 'scheduled' && 'bg-blue-500/10 text-blue-700',
            inspection.status === 'in_progress' && 'bg-yellow-500/10 text-yellow-700',
            inspection.status === 'cancelled' && 'bg-muted text-muted-foreground',
          )}>
            {inspection.status}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{typeLabel}</span>
          <span className="text-muted-foreground">
            {format(parseISO(inspection.scheduled_date), 'dd MMM yyyy')}
          </span>
        </div>
        {inspection.overall_condition && conditionRating && (
          <Badge className={cn('text-[10px]', conditionRating.color)}>
            {conditionRating.label}
          </Badge>
        )}
        {inspection.inspector_name && (
          <p className="text-[10px] text-muted-foreground">Inspector: {inspection.inspector_name}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Inspections() {
  const { data: inspections = [], isLoading } = useInspections();
  const { data: properties = [] } = usePropertiesV2();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  // Dashboard stats
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = inspections.filter(i => {
      const d = parseISO(i.scheduled_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const completed = inspections.filter(i => i.status === 'completed');
    const scoredInspections = completed.filter(i => i.overall_condition);
    const avgScore = scoredInspections.length > 0
      ? (scoredInspections.reduce((sum, i) => sum + conditionScore(i.overall_condition), 0) / scoredInspections.length).toFixed(1)
      : 'N/A';

    const actionsRaised = completed.reduce((sum, i) =>
      sum + (i.follow_up_actions?.length || 0), 0
    );

    // Properties not inspected in 6+ months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const overdueCount = properties.filter(prop => {
      const lastInspection = inspections
        .filter(i => i.property_id === prop.id && i.status === 'completed')
        .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))[0];
      return !lastInspection || parseISO(lastInspection.scheduled_date) < sixMonthsAgo;
    }).length;

    return {
      thisMonthCount: thisMonth.length,
      avgConditionScore: avgScore,
      actionsRaised,
      overdueCount,
    };
  }, [inspections, properties]);

  // Categorized lists
  const upcoming = inspections.filter(i => i.status === 'scheduled' || i.status === 'in_progress')
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const recentlyCompleted = inspections.filter(i => i.status === 'completed')
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
    .slice(0, 10);

  const handleInspectionClick = (inspection: InspectionWithProperty) => {
    setSelectedInspectionId(inspection.id);
    if (inspection.status === 'completed') {
      setActiveTab('report');
    } else {
      setActiveTab('checklist');
    }
  };

  if (isLoading) {
    return <AppLayout><LoadingState text="Loading inspections..." /></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Inspections</h1>
          <p className="text-muted-foreground">
            Schedule, conduct, and report on property inspections
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground uppercase">This Month</p>
              </div>
              <p className="text-xl font-bold mt-1">{stats.thisMonthCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground uppercase">Avg. Condition</p>
              </div>
              <p className="text-xl font-bold mt-1">{stats.avgConditionScore}<span className="text-sm text-muted-foreground">/5</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground uppercase">Actions Raised</p>
              </div>
              <p className="text-xl font-bold mt-1">{stats.actionsRaised}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <p className="text-xs text-muted-foreground uppercase">Overdue (6m+)</p>
              </div>
              <p className={cn('text-xl font-bold mt-1', stats.overdueCount > 0 && 'text-orange-600')}>
                {stats.overdueCount}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-1">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1" disabled={!selectedInspectionId}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-1" disabled={!selectedInspectionId}>
              <FileText className="h-3.5 w-3.5" />
              Report
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1">
              <LayoutTemplate className="h-3.5 w-3.5" />
              Templates
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Upcoming */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Upcoming Inspections
              </h3>
              {upcoming.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground text-sm">
                    No upcoming inspections scheduled.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map(inspection => (
                    <InspectionCard
                      key={inspection.id}
                      inspection={inspection}
                      onClick={() => handleInspectionClick(inspection)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Recently Completed */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Recently Completed
              </h3>
              {recentlyCompleted.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground text-sm">
                    No completed inspections yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recentlyCompleted.map(inspection => (
                    <InspectionCard
                      key={inspection.id}
                      inspection={inspection}
                      onClick={() => handleInspectionClick(inspection)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule">
            <InspectionScheduler />
          </TabsContent>

          {/* Checklist Tab */}
          <TabsContent value="checklist">
            {selectedInspectionId ? (
              <InspectionChecklist inspectionId={selectedInspectionId} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Select an inspection from the dashboard to view its checklist.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Report Tab */}
          <TabsContent value="report">
            {selectedInspectionId ? (
              <InspectionReport inspectionId={selectedInspectionId} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Select a completed inspection to view its report.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <InspectionTemplateEditor />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
