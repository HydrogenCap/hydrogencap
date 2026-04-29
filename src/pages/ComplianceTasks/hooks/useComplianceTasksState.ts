import { useState } from 'react';
import { addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  useComplianceTasks, useComplianceTaskStats,
  useUpdateTaskStatus, useRunComplianceScan, useCreateTask, useUpdateTask,
} from '@/hooks/useComplianceTasks';
import { invokeEdgeFunction } from '@/hooks/useEdgeFunction';
import type { ComplianceTaskOverview, TaskStatus } from '@/lib/complianceTaskTypes';
import type { ViewMode } from '../components/FiltersBar';

export function useComplianceTasksState() {
  const { toast } = useToast();
  const { data: tasks, isLoading, error, refetch } = useComplianceTasks();
  const stats = useComplianceTaskStats();
  const updateStatus = useUpdateTaskStatus();
  const updateTask = useUpdateTask();
  const runScan = useRunComplianceScan();
  const createTask = useCreateTask();

  const [view, setView] = useState<ViewMode>('pipeline');
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

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
  };

  const closeDetail = () => { setSelectedTask(null); setDismissReason(''); };

  return {
    tasks, isLoading, error, refetch, stats, filtered,
    view, setView, priorityFilter, setPriorityFilter, showCompleted, setShowCompleted,
    showCreate, setShowCreate, selectedTask, setSelectedTask,
    runningPipeline, dismissReason, setDismissReason,
    runScan, createTask,
    handleStatusChange, handleRunPipeline, handleRunScan,
    handleSnooze, handleDismiss, handleCreateSubmit, closeDetail,
  };
}
