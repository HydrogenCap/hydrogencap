import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CreateMaintenanceRequestDialog from '@/components/maintenance/CreateMaintenanceRequestDialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { Wrench, Plus, AlertTriangle, Clock, CheckCircle2, Home, User, Siren, PoundSterling, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMaintenanceRequests, useMaintenanceStats, type MaintenanceRequestWithDetails } from '@/hooks/useMaintenanceRequests';
import { normalizeMaintenanceItem } from '@/lib/maintenanceNormalizer';
import { PRIORITY_CONFIG, STATUS_CONFIG, CATEGORY_COLORS, MAINTENANCE_CATEGORY_NAMES, OPEN_STATUSES, type MaintenancePriority, type MaintenanceStatus } from '@/lib/maintenanceTypes';
import { LoadingState, EmptyState } from '@/components/common';

function RequestCard({ request }: { request: MaintenanceRequestWithDetails }) {
  const priorityCfg = PRIORITY_CONFIG[request.priority];
  const statusCfg = STATUS_CONFIG[request.status];
  const categoryCfg = CATEGORY_COLORS[request.category];
  const display = normalizeMaintenanceItem(request);

  return (
    <Link to={`/maintenance/${request.id}`}>
      <Card className={`hover:bg-accent/50 transition-colors cursor-pointer ${request.is_emergency ? 'border-red-300 bg-red-50/30' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className={priorityCfg.color}>
                  {priorityCfg.icon} {priorityCfg.label}
                </Badge>
                <Badge variant="outline" className={statusCfg.color}>
                  {statusCfg.label}
                </Badge>
                <Badge variant="outline" className={categoryCfg}>
                  {MAINTENANCE_CATEGORY_NAMES[request.category]}
                </Badge>
              </div>
              <h4 className="font-medium">{request.title}</h4>
              <p className="text-sm text-muted-foreground line-clamp-1">{request.description}</p>

              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Home className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{display.propertyAddress}</span>
                </div>
                {display.tenantName && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{display.tenantName}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right text-sm text-muted-foreground shrink-0">
              <p>{format(new Date(request.created_at), 'dd MMM yyyy')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CostByCategorySection({ requests }: { requests: MaintenanceRequestWithDetails[] }) {
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of requests) {
      if (r.actual_cost && r.actual_cost > 0) {
        map.set(r.category, (map.get(r.category) || 0) + r.actual_cost);
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);
  }, [requests]);

  if (categoryTotals.length === 0) return null;

  const maxCost = categoryTotals[0][1];
  const fmt = (v: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Cost by Category
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {categoryTotals.map(([category, total]) => (
          <div key={category} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">
              {MAINTENANCE_CATEGORY_NAMES[category as keyof typeof MAINTENANCE_CATEGORY_NAMES] || category}
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(total / maxCost) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium w-16 text-right">{fmt(total)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function MaintenanceRequests() {
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  const { data: requests, isLoading } = useMaintenanceRequests();
  const stats = useMaintenanceStats();

  const openRequests = requests?.filter(r => OPEN_STATUSES.includes(r.status)) || [];
  const completedRequests = requests?.filter(r => ['completed', 'verified', 'closed'].includes(r.status)) || [];

  if (isLoading) return <AppLayout><LoadingState text="Loading maintenance requests..." /></AppLayout>;

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="h-6 w-6" />
              Maintenance
            </h1>
            <p className="text-muted-foreground">Track and manage maintenance issues</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Report Issue
          </Button>
        </div>

        {/* Emergency banner */}
        {stats && stats.emergency > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
            <Siren className="h-6 w-6 text-destructive animate-pulse" />
            <div>
              <p className="font-semibold text-destructive">{stats.emergency} Emergency Request{stats.emergency > 1 ? 's' : ''}</p>
              <p className="text-sm text-destructive/80">Requires immediate attention</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${openRequests.length > 20 ? 'text-destructive' : openRequests.length > 10 ? 'text-amber-600' : ''}`}>{openRequests.length}</p>
            </CardContent>
          </Card>
          {stats && stats.emergency > 0 && (
            <Card className="border-destructive/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-destructive">Emergency</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{stats.emergency}</p>
              </CardContent>
            </Card>
          )}
          {stats && stats.avgResolutionDays !== null && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.avgResolutionDays}d</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{completedRequests.length}</p>
            </CardContent>
          </Card>
          {stats && stats.totalActualCost > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <PoundSterling className="h-3.5 w-3.5" /> Total Spent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(stats.totalActualCost)}
                </p>
                <p className="text-xs text-muted-foreground">completed jobs</p>
              </CardContent>
            </Card>
          )}
          {stats && stats.totalEstimatedCost > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <PoundSterling className="h-3.5 w-3.5" /> Pending Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600">
                  {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(stats.totalEstimatedCost)}
                </p>
                <p className="text-xs text-muted-foreground">estimated open jobs</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Cost by Category */}
        <CostByCategorySection requests={requests || []} />

        {/* Request List */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="open">Open ({stats.open})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedRequests.length})</TabsTrigger>
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-4 space-y-3">
            {openRequests.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No open requests" description="All maintenance requests have been resolved" />
            ) : (
              openRequests
                .sort((a, b) => {
                  const order: Record<string, number> = { emergency: 0, urgent: 1, medium: 2, low: 3 };
                  return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
                })
                .map(request => <RequestCard key={request.id} request={request} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-3">
            {completedRequests.length === 0 ? (
              <EmptyState icon={Wrench} title="No completed requests" description="Completed maintenance requests will appear here" />
            ) : (
              completedRequests.map(request => <RequestCard key={request.id} request={request} />)
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-4 space-y-3">
            {requests?.length === 0 ? (
              <EmptyState icon={Wrench} title="No maintenance requests" description="Report an issue when maintenance is needed" />
            ) : (
              requests?.map(request => <RequestCard key={request.id} request={request} />)
            )}
          </TabsContent>
        </Tabs>

        <CreateMaintenanceRequestDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={(id) => navigate(`/maintenance/${id}`)}
        />
      </div>
    </AppLayout>
  );
}
