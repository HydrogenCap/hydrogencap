import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CreateMaintenanceRequestDialog from '@/components/maintenance/CreateMaintenanceRequestDialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { Wrench, Plus, AlertTriangle, Clock, CheckCircle2, Home, User, Siren } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMaintenanceRequests, type MaintenanceRequestWithDetails } from '@/hooks/useMaintenanceRequests';
import { PRIORITY_CONFIG, STATUS_CONFIG, CATEGORY_COLORS, MAINTENANCE_CATEGORY_NAMES, OPEN_STATUSES, type MaintenancePriority, type MaintenanceStatus } from '@/lib/maintenanceTypes';
import { LoadingState, EmptyState } from '@/components/common';

function RequestCard({ request }: { request: MaintenanceRequestWithDetails }) {
  const priorityCfg = PRIORITY_CONFIG[request.priority];
  const statusCfg = STATUS_CONFIG[request.status];
  const categoryCfg = CATEGORY_COLORS[request.category];

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
                  <span className="truncate max-w-[150px]">{request.property.address_line}</span>
                </div>
                {request.tenant && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{request.tenant.first_name} {request.tenant.last_name}</span>
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

export default function MaintenanceRequests() {
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  const { data: requests, isLoading } = useMaintenanceRequests();

  const openRequests = requests?.filter(r => OPEN_STATUSES.includes(r.status)) || [];
  const completedRequests = requests?.filter(r => ['completed', 'verified', 'closed'].includes(r.status)) || [];

  const stats = {
    total: requests?.length || 0,
    open: openRequests.length,
    emergency: openRequests.filter(r => r.is_emergency).length,
    urgent: openRequests.filter(r => r.priority === 'urgent').length,
  };

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
        {stats.emergency > 0 && (
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
              <p className={`text-2xl font-bold ${stats.open > 20 ? 'text-destructive' : stats.open > 10 ? 'text-amber-600' : ''}`}>{stats.open}</p>
            </CardContent>
          </Card>
          {stats.emergency > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">Emergency</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{stats.emergency}</p>
              </CardContent>
            </Card>
          )}
          {stats.urgent > 0 && (
            <Card className="border-orange-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-600">Urgent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">{stats.urgent}</p>
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
        </div>

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
