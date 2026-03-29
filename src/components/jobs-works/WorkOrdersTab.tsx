import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LayoutGrid, List, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/common';
import { Wrench } from 'lucide-react';
import {
  useWorkOrders,
  useWorkOrderCounts,
  WO_STATUSES,
  WO_CATEGORIES,
  type WOStatus,
  type WOCategory,
  type WorkOrderWithDetails,
} from '@/hooks/useWorkOrders';
import { CreateWorkOrderDialog } from '@/components/works/CreateWorkOrderDialog';

function WOCard({ wo, onClick }: { wo: WorkOrderWithDetails; onClick: () => void }) {
  const statusConfig = WO_STATUSES.find(s => s.value === wo.status);
  const isOverBudget = wo.actual_cost && wo.approved_budget && wo.actual_cost > wo.approved_budget;
  const jobCount = wo.jobs?.length || 0;

  return (
    <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={onClick}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-mono text-muted-foreground">{wo.wo_number}</p>
            <p className="text-sm font-medium truncate">{wo.title}</p>
          </div>
          <Badge className={cn('text-[10px] shrink-0', statusConfig?.color)}>{statusConfig?.label}</Badge>
        </div>
        {wo.property && <p className="text-xs text-muted-foreground truncate">{wo.property.address_line_1}, {wo.property.city}</p>}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{WO_CATEGORIES.find(c => c.value === wo.category)?.label}</span>
          <div className="flex items-center gap-2">
            {(wo.approved_budget || wo.estimated_cost) && (
              <span className={cn(isOverBudget && 'text-destructive font-medium')}>
                {formatGBP(wo.actual_cost || wo.estimated_cost || 0)}
                {wo.approved_budget ? ` / ${formatGBP(wo.approved_budget)}` : ''}
              </span>
            )}
            {isOverBudget && <AlertTriangle className="h-3 w-3 text-destructive" />}
          </div>
        </div>
        {jobCount > 0 && <p className="text-[10px] text-muted-foreground">{jobCount} job{jobCount > 1 ? 's' : ''} linked</p>}
      </CardContent>
    </Card>
  );
}

export default function WorkOrdersTab() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: counts } = useWorkOrderCounts();
  const { data: workOrders, isLoading } = useWorkOrders({
    category: categoryFilter !== 'all' ? categoryFilter as WOCategory : undefined,
  });

  const boardColumns: { status: WOStatus; label: string }[] = [
    { status: 'draft', label: 'Draft' },
    { status: 'submitted', label: 'Awaiting Approval' },
    { status: 'approved', label: 'Approved' },
    { status: 'in_progress', label: 'In Progress' },
    { status: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Work Order
        </Button>
      </div>

      {/* Summary Cards */}
      {counts && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase">Awaiting Approval</p><p className="text-xl font-bold">{counts.awaitingApproval}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase">In Progress</p><p className="text-xl font-bold">{counts.inProgress}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase">Urgent</p><p className="text-xl font-bold text-destructive">{counts.urgent}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase">Total Estimated</p><p className="text-xl font-bold">{formatGBP(counts.totalEstimated)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase">Total Actual</p><p className="text-xl font-bold">{formatGBP(counts.totalActual)}</p></CardContent></Card>
        </div>
      )}

      {/* Filters + View Toggle */}
      <div className="flex items-center gap-3">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {WO_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1 border rounded-lg p-1">
          <Button variant={viewMode === 'board' ? 'secondary' : 'ghost'} size="sm" aria-label="Board view" className="h-7 w-7 p-0" onClick={() => setViewMode('board')}><LayoutGrid className="h-3.5 w-3.5" /></Button>
          <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" aria-label="List view" className="h-7 w-7 p-0" onClick={() => setViewMode('list')}><List className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Board View */}
      {viewMode === 'board' && (
        <div className="grid gap-4 lg:grid-cols-5">
          {boardColumns.map(col => {
            const colWOs = (workOrders || []).filter(wo => wo.status === col.status);
            return (
              <div key={col.status} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">{col.label}</h3>
                  <Badge variant="secondary" className="text-[10px]">{colWOs.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {colWOs.map(wo => <WOCard key={wo.id} wo={wo} onClick={() => navigate(`/work-orders/${wo.id}`)} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {(workOrders || []).length === 0 ? (
            <EmptyState icon={Wrench} title="No work orders" description="Create a work order to get started" />
          ) : (
            (workOrders || []).map(wo => <WOCard key={wo.id} wo={wo} onClick={() => navigate(`/work-orders/${wo.id}`)} />)
          )}
        </div>
      )}

      <CreateWorkOrderDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
