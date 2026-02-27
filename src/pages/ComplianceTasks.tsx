import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useComplianceTasks, useComplianceTaskStats, useUpdateTaskStatus, useRunComplianceScan, useCreateTask } from '@/hooks/useComplianceTasks';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import {
  BOARD_COLUMNS, TASK_STATUS_NAMES, PRIORITY_NAMES, TASK_TYPE_NAMES,
  type ComplianceTaskOverview, type TaskStatus, type TaskPriority,
} from '@/lib/complianceTaskTypes';
import {
  ClipboardList, LayoutGrid, List, Play, Plus, AlertTriangle, Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const colors: Record<TaskPriority, string> = {
    critical: 'bg-destructive text-destructive-foreground animate-pulse',
    high: 'bg-destructive/80 text-destructive-foreground',
    medium: 'bg-warning text-warning-foreground',
    low: 'bg-primary/20 text-primary',
  };
  return <Badge className={`text-xs ${colors[priority]}`}>{PRIORITY_NAMES[priority]}</Badge>;
}

function EscalationDots({ level }: { level: number }) {
  if (level === 0) return null;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: level }).map((_, i) => (
        <div key={i} className={`h-2 w-2 rounded-full ${level >= 2 ? 'bg-destructive' : 'bg-warning'}`} />
      ))}
    </div>
  );
}

function TaskCard({ task, onStatusChange, onClick }: {
  task: ComplianceTaskOverview;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onClick: (task: ComplianceTaskOverview) => void;
}) {
  const docLabel = DOC_TYPE_DISPLAY_NAMES[task.document_type as keyof typeof DOC_TYPE_DISPLAY_NAMES] || task.document_type;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: task.priority === 'critical' ? 'hsl(var(--destructive))' : task.priority === 'high' ? 'hsl(var(--destructive) / 0.7)' : task.priority === 'medium' ? 'hsl(var(--warning))' : 'hsl(var(--primary) / 0.3)' }}
      onClick={() => onClick(task)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium leading-tight line-clamp-2">{task.title}</h4>
          <PriorityBadge priority={task.priority} />
        </div>
        <p className="text-xs text-muted-foreground">{docLabel}</p>
        <p className="text-xs text-muted-foreground">{task.property_address}</p>
        <div className="flex items-center justify-between text-xs">
          {task.due_date && (
            <span className={task.is_overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
              {task.is_overdue ? `Overdue ${Math.abs(task.days_until_due || 0)}d` : `Due ${format(new Date(task.due_date), 'dd MMM')}`}
            </span>
          )}
          <EscalationDots level={task.escalation_level} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{task.assigned_to || 'Unassigned'}</span>
          <Badge variant="outline" className="text-[10px]">{task.source === 'auto' ? 'Auto' : 'Manual'}</Badge>
        </div>
        {task.contractor_name && (
          <p className="text-xs text-primary">🔧 {task.contractor_name}</p>
        )}
        <Select value={task.status} onValueChange={(v) => { onStatusChange(task.task_id, v as TaskStatus); }}>
          <SelectTrigger className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOARD_COLUMNS.map(s => <SelectItem key={s} value={s}>{TASK_STATUS_NAMES[s]}</SelectItem>)}
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

export default function ComplianceTasks() {
  const { toast } = useToast();
  const { data: tasks, isLoading } = useComplianceTasks();
  const stats = useComplianceTaskStats();
  const updateStatus = useUpdateTaskStatus();
  const runScan = useRunComplianceScan();
  const createTask = useCreateTask();

  const [view, setView] = useState<'board' | 'list'>('board');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ComplianceTaskOverview | null>(null);

  const filtered = (tasks || []).filter(t => {
    if (!showCompleted && ['completed', 'cancelled'].includes(t.status)) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const handleStatusChange = (id: string, status: TaskStatus) => {
    updateStatus.mutate({ id, status }, {
      onSuccess: () => toast({ title: 'Status updated' }),
    });
  };

  const handleRunScan = () => {
    runScan.mutate(undefined, {
      onSuccess: (result) => {
        toast({
          title: 'Scan complete',
          description: `${result.tasks_created} tasks created, ${result.tasks_updated} updated, ${result.notifications_sent} notifications sent.`,
        });
      },
      onError: (err) => toast({ title: 'Scan failed', description: String(err), variant: 'destructive' }),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Compliance Tasks</h1>
            <p className="text-muted-foreground">Manage compliance renewals, inspections, and follow-ups</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRunScan} disabled={runScan.isPending}>
              <Play className="h-4 w-4 mr-1" />
              {runScan.isPending ? 'Scanning...' : 'Run Scan'}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Task
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.openCount}</p>
              <p className="text-xs text-muted-foreground">Open Tasks</p>
            </CardContent>
          </Card>
          <Card className={stats.overdueCount > 0 ? 'border-destructive' : ''}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-destructive' : ''}`}>{stats.overdueCount}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
          <Card className={stats.criticalCount > 0 ? 'border-destructive bg-destructive/5' : ''}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${stats.criticalCount > 0 ? 'text-destructive' : ''}`}>{stats.criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.completedThisMonth}</p>
              <p className="text-xs text-muted-foreground">Completed This Month</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {(['critical', 'high', 'medium', 'low'] as const).map(p => (
                <SelectItem key={p} value={p}>{PRIORITY_NAMES[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={showCompleted ? 'secondary' : 'outline'} size="sm" onClick={() => setShowCompleted(!showCompleted)}>
            {showCompleted ? 'Hide' : 'Show'} Completed
          </Button>
          <div className="ml-auto flex gap-1">
            <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('board')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('list')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-12">Loading tasks...</p>
        ) : view === 'board' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {BOARD_COLUMNS.map(col => {
              const colTasks = filtered.filter(t => t.status === col);
              return (
                <div key={col} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{TASK_STATUS_NAMES[col]}</h3>
                    <Badge variant="outline" className="text-xs">{colTasks.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[100px]">
                    {colTasks.map(t => (
                      <TaskCard key={t.task_id} task={t} onStatusChange={handleStatusChange} onClick={setSelectedTask} />
                    ))}
                    {colTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Priority</th>
                  <th className="text-left p-3">Title</th>
                  <th className="text-left p-3">Property</th>
                  <th className="text-left p-3">Due Date</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Esc.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.task_id} className="border-t cursor-pointer hover:bg-muted/30" onClick={() => setSelectedTask(t)}>
                    <td className="p-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="p-3">{t.title}</td>
                    <td className="p-3 text-muted-foreground">{t.property_address}</td>
                    <td className="p-3">
                      {t.due_date && (
                        <span className={t.is_overdue ? 'text-destructive font-medium' : ''}>
                          {format(new Date(t.due_date), 'dd MMM yyyy')}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{TASK_STATUS_NAMES[t.status]}</td>
                    <td className="p-3"><EscalationDots level={t.escalation_level} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Task Detail Dialog */}
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            {selectedTask && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selectedTask.title}
                    <PriorityBadge priority={selectedTask.priority} />
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-muted-foreground">Property</Label><p>{selectedTask.property_address}</p></div>
                    <div><Label className="text-muted-foreground">Document</Label><p>{DOC_TYPE_DISPLAY_NAMES[selectedTask.document_type as keyof typeof DOC_TYPE_DISPLAY_NAMES] || selectedTask.document_type}</p></div>
                    <div><Label className="text-muted-foreground">Status</Label><p>{TASK_STATUS_NAMES[selectedTask.status]}</p></div>
                    <div><Label className="text-muted-foreground">Due Date</Label><p>{selectedTask.due_date ? format(new Date(selectedTask.due_date), 'dd MMM yyyy') : '—'}</p></div>
                    <div><Label className="text-muted-foreground">Assigned To</Label><p>{selectedTask.assigned_to || 'Unassigned'}</p></div>
                    <div><Label className="text-muted-foreground">Source</Label><p>{selectedTask.source === 'auto' ? 'Auto-generated' : 'Manual'}</p></div>
                    <div><Label className="text-muted-foreground">Escalation Level</Label><div className="flex items-center gap-2"><span>{selectedTask.escalation_level}</span><EscalationDots level={selectedTask.escalation_level} /></div></div>
                    {selectedTask.contractor_name && <div><Label className="text-muted-foreground">Contractor</Label><p>{selectedTask.contractor_name}</p></div>}
                    {selectedTask.inspection_date && <div><Label className="text-muted-foreground">Inspection</Label><p>{format(new Date(selectedTask.inspection_date), 'dd MMM yyyy')}</p></div>}
                    {selectedTask.quoted_cost != null && <div><Label className="text-muted-foreground">Quoted</Label><p>£{selectedTask.quoted_cost}</p></div>}
                    {selectedTask.actual_cost != null && <div><Label className="text-muted-foreground">Actual</Label><p>£{selectedTask.actual_cost}</p></div>}
                  </div>
                  {selectedTask.notes && <div><Label className="text-muted-foreground">Notes</Label><p className="whitespace-pre-wrap">{selectedTask.notes}</p></div>}
                  {selectedTask.resolution_notes && <div><Label className="text-muted-foreground">Resolution</Label><p className="whitespace-pre-wrap">{selectedTask.resolution_notes}</p></div>}
                  <p className="text-xs text-muted-foreground">Created {formatDistanceToNow(new Date(selectedTask.created_at))} ago</p>
                </div>
                <DialogFooter className="flex gap-2">
                  <Select value={selectedTask.status} onValueChange={(v) => { handleStatusChange(selectedTask.task_id, v as TaskStatus); setSelectedTask(null); }}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...BOARD_COLUMNS, 'cancelled' as const].map(s => <SelectItem key={s} value={s}>{TASK_STATUS_NAMES[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Task Dialog - simplified */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Compliance Task</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createTask.mutate({
                property_id: fd.get('property_id'),
                document_type: fd.get('document_type'),
                task_type: fd.get('task_type'),
                title: fd.get('title'),
                priority: fd.get('priority'),
                assigned_to: fd.get('assigned_to') || null,
                due_date: fd.get('due_date') || null,
                notes: fd.get('notes') || null,
              }, {
                onSuccess: () => { setShowCreate(false); toast({ title: 'Task created' }); },
                onError: (err) => toast({ title: 'Error', description: String(err), variant: 'destructive' }),
              });
            }} className="space-y-4">
              <div><Label>Title *</Label><Input name="title" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Property ID *</Label><Input name="property_id" required placeholder="UUID" /></div>
                <div><Label>Document Type *</Label><Input name="document_type" required placeholder="e.g. gas_safety_certificate" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Task Type *</Label>
                  <Select name="task_type" defaultValue="renewal_due">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_TYPE_NAMES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_NAMES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Assigned To</Label><Input name="assigned_to" /></div>
                <div><Label>Due Date</Label><Input name="due_date" type="date" /></div>
              </div>
              <div><Label>Notes</Label><Textarea name="notes" /></div>
              <DialogFooter>
                <Button type="submit" disabled={createTask.isPending}>Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
