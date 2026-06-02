import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ListState } from '@/components/ListState';
import { EmptyState, KpiCardSkeleton } from '@/components/common';
import { Play, Plus, ShieldCheck, GitBranch, Loader2 } from 'lucide-react';
import { useComplianceTasksState } from './hooks/useComplianceTasksState';
import { StatsRow } from './components/StatsRow';
import { FiltersBar } from './components/FiltersBar';
import { PipelineView, BoardView, ListView } from './components/TaskViews';
import { TaskDetailDialog } from './components/TaskDetailDialog';
import { CreateTaskDialog } from './components/CreateTaskDialog';
import { ComplianceHubTabs } from '@/components/compliance/ComplianceHubTabs';

export default function ComplianceTasks() {
  const s = useComplianceTasksState();

  return (
    <AppLayout>
      <div className="space-y-6">
        <ComplianceHubTabs />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Compliance Tasks</h1>
            <p className="text-muted-foreground">Automated renewal pipeline and task management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={s.handleRunPipeline} disabled={s.runningPipeline}>
              {s.runningPipeline ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <GitBranch className="h-4 w-4 mr-1" />}
              {s.runningPipeline ? 'Running...' : 'Run Pipeline'}
            </Button>
            <Button variant="outline" size="sm" onClick={s.handleRunScan} disabled={s.runScan.isPending}>
              <Play className="h-4 w-4 mr-1" />
              {s.runScan.isPending ? 'Scanning...' : 'Run Scan'}
            </Button>
            <Button size="sm" onClick={() => s.setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Task
            </Button>
          </div>
        </div>

        {s.isLoading ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <KpiCardSkeleton key={i} showDelta={false} />
              ))}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-9 w-32" />
              <div className="ml-auto flex gap-1">
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-9 w-9" />
              </div>
            </div>
          </>
        ) : (
          <>
            <StatsRow stats={s.stats} />
            <FiltersBar
              view={s.view} setView={s.setView}
              priorityFilter={s.priorityFilter} setPriorityFilter={s.setPriorityFilter}
              showCompleted={s.showCompleted} setShowCompleted={s.setShowCompleted}
            />
          </>
        )}

        <ListState
          isLoading={s.isLoading}
          error={s.error as Error | null}
          isEmpty={!s.tasks?.length}
          emptyIcon={ShieldCheck}
          emptyTitle="All clear"
          emptyDescription="Upload your first certificate — we'll extract the details automatically."
          onRetry={() => s.refetch()}
        >
          {s.filtered.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No tasks match your filters"
              description="Try changing the priority filter or showing completed tasks."
            />
          ) : s.view === 'pipeline' ? (
            <PipelineView filtered={s.filtered} onStatusChange={s.handleStatusChange} onSelect={s.setSelectedTask} />
          ) : s.view === 'board' ? (
            <BoardView filtered={s.filtered} onStatusChange={s.handleStatusChange} onSelect={s.setSelectedTask} />
          ) : (
            <ListView filtered={s.filtered} onSelect={s.setSelectedTask} />
          )}
        </ListState>

        <TaskDetailDialog
          selectedTask={s.selectedTask}
          dismissReason={s.dismissReason}
          setDismissReason={s.setDismissReason}
          onClose={s.closeDetail}
          onStatusChange={s.handleStatusChange}
          onSnooze={s.handleSnooze}
          onDismiss={s.handleDismiss}
        />

        <CreateTaskDialog
          open={s.showCreate}
          onOpenChange={s.setShowCreate}
          onSubmit={s.handleCreateSubmit}
          isPending={s.createTask.isPending}
        />
      </div>
    </AppLayout>
  );
}
