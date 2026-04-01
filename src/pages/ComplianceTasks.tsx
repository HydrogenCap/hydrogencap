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
import { useComplianceTasks, useComplianceTaskStats, useUpdateTaskStatus, useRunComplianceScan, useCreateTask, useUpdateTask } from '@/hooks/useComplianceTasks';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import {
  BOARD_COLUMNS, PIPELINE_COLUMNS, TASK_STATUS_NAMES, PRIORITY_NAMES, TASK_TYPE_NAMES,
  type ComplianceTaskOverview, type TaskStatus, type TaskPriority,
} from '@/lib/complianceTaskTypes';
import {
  ClipboardList, LayoutGrid, List, Play, Plus, AlertTriangle, Clock, CheckCircle2, XCircle,
  GitBranch, Upload, CalendarPlus, Ban, Send, Loader2,
} from 'lucide-react';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import { invokeEdgeFunction } from '@/hooks/useEdgeFunction';

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
        {task.contractor_name && (
          <p className="text-xs text-primary">🔧 {task.contractor_name}</p>
        )}
        <Badge variant="outline" className="text-[10px]">{task.source === 'auto_pipeline' ? 'Pipeline' : task.source === 'auto' ? 'Auto' : 'Manual'}</Badge>
      </CardContent>
    </Card>
  );
}

export default function ComplianceTasks() {
  const { toast } = useToast();
  const { data: tasks, isLoading } = useComplianceTasks();
  const stats = useComplianceTaskStats();
  const updateStatus = useUpdateTaskStatus();
  const updateTask = useUpdateTask();
  const runScan = useRunComplianceScan();
  const createTask = useCreateTask();

  const [view, setView] = useState<'pipeline' | 'board' | 'list'>('pipeline');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ComplianceTaskOverview | null>(null);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [dismissReason, setDismissReason] = useState('');

  const filtered = (tasks || []).filter(t => {
    if (!showCompleted && ['completed', 'cancelled'].includes(t.status)) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  // Map legacy statuses to pipeline columns for display
  const getColumnForTask = (t: ComplianceTaskOverview): TaskStatus => {
    if (['completed', 'cancelled'].includes(t.status)) return 'completed';
    if (['contractor_assigned', 'contractor_requested', 'awaiting_upload', 'pending'].includes(t.status)) return t.status as TaskStatus;
    if (t.status === 'waiting') return 'awaiting_upload';
    if (t.status === 'in_progress') return 'contractor_assigned';
    return 'pending'; // 'open' maps to 'pending'
  };

  const handleStatusChange = (id: string, status: TaskStatus) => {
    updateStatus.mutate({ id, status }, {
      onSuccess: () => toast({ title: 'Status updated' }),
    });
  };

  const handleRunPipeline = async () => {
    setRunningPipeline(true);
    try {
      const result = await invokeEdgeFunction<{
        tasks_created: number;
        contractors_assigned: number;
        notifications_sent: number;
        priorities_updated: number;
      }>('auto-compliance-pipeline', {});
      toast({
        title: 'Pipeline complete',
        description: `${result.tasks_created} tasks created, ${result.contractors_assigned} contractors assigned, ${result.priorities_updated} priorities updated.`,
      });
    } catch (err) {
      console.error('Failed to run compliance pipeline:', err);
      toast({ title: 'Pipeline failed', description: err instanceof Error ? err.message : 'Something went wrong', variant: 'destructive' });
    } finally {
      setRunningPipeline(false);
    }
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

  const handleSnooze = (taskId: string, days: number) => {
    const newDate = addDays(new Date(), days).toISOString().slice(0, 10);
    updateTask.mutate({ id: taskId, updates: { due_date: newDate } }, {
      onSuccess: () => {
        toast({ title: `Snoozed ${days} days` });
        setSelectedTask(null);
      },
    });
  };

  const handleDismiss = (taskId: string) => {
    if (!dismissReason.trim()) {
      toast({ title: 'Reason required', variant: 'destructive' });
      return;
    }
    updateStatus.mutate({ id: taskId, status: 'cancelled', notes: dismissReason }, {
      onSuccess: () => {
        toast({ title: 'Task dismissed' });
        setSelectedTask(null);
        setDismissReason('');
      },
    });
  };

  const renderPipelineView = () => (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {PIPELINE_COLUMNS.map(col => {
        const colTasks = filtered.filter(t => getColumnForTask(t) === col);
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
  );

  const renderBoardView = () => (
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
  );

  const renderListView = () => (
    <div className="border rounded-lg overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3">Priority</th>
            <th className="text-left p-3">Title</th>
            <th className="text-left p-3">Property</th>
            <th className="text-left p-3">Due Date</th>
            <th className="text-left p-3">Status</th>
            <th className="text-left p-3">Contractor</th>
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
              <td className="p-3">{TASK_STATUS_NAMES[t.status] || t.status}</td>
              <td className="p-3 text-muted-foreground">{t.contractor_name || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Compliance Tasks</h1>
            <p className="text-muted-foreground">Automated renewal pipeline and task management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRunPipeline} disabled={runningPipeline}>
              {runningPipeline ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <GitBranch className="h-4 w-4 mr-1" />}
              {runningPipeline ? 'Running...' : 'Run Pipeline'}
            </Button>
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
            <Button variant={view === 'pipeline' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('pipeline')} title="Pipeline View">
              <GitBranch className="h-4 w-4" />
            </Button>
            <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('board')} title="Board View">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('list')} title="List View">
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-12">Loading tasks...</p>
        ) : view === 'pipeline' ? (
          renderPipelineView()
        ) : view === 'board' ? (
          renderBoardView()
        ) : (
          renderListView()
        )}

        {/* Task Detail Drawer */}
        <Dialog open={!!selectedTask} onOpenChange={() => { setSelectedTask(null); setDismissReason(''); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                    <div><Label className="text-muted-foreground">Status</Label><p>{TASK_STATUS_NAMES[selectedTask.status] || selectedTask.status}</p></div>
                    <div><Label className="text-muted-foreground">Due Date</Label><p>{selectedTask.due_date ? format(new Date(selectedTask.due_date), 'dd MMM yyyy') : '—'}</p></div>
                    <div><Label className="text-muted-foreground">Source</Label><p>{selectedTask.source === 'auto_pipeline' ? 'Auto Pipeline' : selectedTask.source === 'auto' ? 'Auto-generated' : 'Manual'}</p></div>
                    <div><Label className="text-muted-foreground">Escalation</Label><div className="flex items-center gap-2"><span>{selectedTask.escalation_level}</span><EscalationDots level={selectedTask.escalation_level} /></div></div>
                    {selectedTask.contractor_name && <div><Label className="text-muted-foreground">Contractor</Label><p className="text-primary">{selectedTask.contractor_name}</p></div>}
                    {selectedTask.quoted_cost != null && <div><Label className="text-muted-foreground">Quoted</Label><p>£{selectedTask.quoted_cost}</p></div>}
                    {selectedTask.actual_cost != null && <div><Label className="text-muted-foreground">Actual</Label><p>£{selectedTask.actual_cost}</p></div>}
                  </div>
                  {selectedTask.notes && <div><Label className="text-muted-foreground">Notes</Label><p className="whitespace-pre-wrap">{selectedTask.notes}</p></div>}
                  {selectedTask.resolution_notes && <div><Label className="text-muted-foreground">Resolution</Label><p className="whitespace-pre-wrap">{selectedTask.resolution_notes}</p></div>}
                  <p className="text-xs text-muted-foreground">Created {formatDistanceToNow(new Date(selectedTask.created_at))} ago</p>

                  {/* Pipeline Actions */}
                  {!['completed', 'cancelled'].includes(selectedTask.status) && (
                    <div className="space-y-3 pt-2 border-t">
                      <h4 className="text-sm font-semibold">Actions</h4>

                      {/* Change Status */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs w-20">Status</Label>
                        <Select value={selectedTask.status} onValueChange={(v) => {
                          handleStatusChange(selectedTask.task_id, v as TaskStatus);
                          setSelectedTask(null);
                        }}>
                          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[...PIPELINE_COLUMNS, 'cancelled' as TaskStatus].map(s => (
                              <SelectItem key={s} value={s}>{TASK_STATUS_NAMES[s] || s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Mark Complete */}
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          handleStatusChange(selectedTask.task_id, 'completed');
                          setSelectedTask(null);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Mark Complete
                      </Button>

                      {/* Snooze */}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSnooze(selectedTask.task_id, 7)}>
                          <CalendarPlus className="h-3 w-3 mr-1" />+7d
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSnooze(selectedTask.task_id, 14)}>
                          +14d
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleSnooze(selectedTask.task_id, 30)}>
                          +30d
                        </Button>
                      </div>

                      {/* Dismiss */}
                      <div className="space-y-2">
                        <Input
                          placeholder="Dismiss reason (required)..."
                          value={dismissReason}
                          onChange={(e) => setDismissReason(e.target.value)}
                          className="text-xs"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDismiss(selectedTask.task_id)}
                          disabled={!dismissReason.trim()}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Dismiss Task
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Task Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Compliance Task</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createTask.mutate({
                property_id: fd.get('property_id') as string,
                document_type: fd.get('document_type') as string,
                task_type: fd.get('task_type') as string,
                title: fd.get('title') as string,
                priority: fd.get('priority') as string,
                assigned_to: (fd.get('assigned_to') as string) || null,
                due_date: (fd.get('due_date') as string) || null,
                notes: (fd.get('notes') as string) || null,
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
                      {Object.entries(TASK_TYPE_NAMES).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_NAMES).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
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
