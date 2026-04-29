import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import type { ComplianceTaskOverview, TaskStatus } from '@/lib/complianceTaskTypes';
import { PriorityBadge, EscalationDots } from '../utils/badges';

export function TaskCard({ task, onStatusChange: _onStatusChange, onClick }: {
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
