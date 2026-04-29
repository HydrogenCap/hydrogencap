import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  BOARD_COLUMNS, PIPELINE_COLUMNS, TASK_STATUS_NAMES,
  type ComplianceTaskOverview, type TaskStatus,
} from '@/lib/complianceTaskTypes';
import { PriorityBadge } from '../utils/badges';
import { getColumnForTask } from '../utils/columnMapping';
import { TaskCard } from './TaskCard';

interface ViewProps {
  filtered: ComplianceTaskOverview[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onSelect: (t: ComplianceTaskOverview) => void;
}

export function PipelineView({ filtered, onStatusChange, onSelect }: ViewProps) {
  return (
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
                <TaskCard key={t.task_id} task={t} onStatusChange={onStatusChange} onClick={onSelect} />
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
}

export function BoardView({ filtered, onStatusChange, onSelect }: ViewProps) {
  return (
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
                <TaskCard key={t.task_id} task={t} onStatusChange={onStatusChange} onClick={onSelect} />
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
}

export function ListView({ filtered, onSelect }: { filtered: ComplianceTaskOverview[]; onSelect: (t: ComplianceTaskOverview) => void }) {
  return (
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
            <tr key={t.task_id} className="border-t cursor-pointer hover:bg-muted/30" onClick={() => onSelect(t)}>
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
}
