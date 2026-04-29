import { Badge } from '@/components/ui/badge';
import { PRIORITY_NAMES, type TaskPriority } from '@/lib/complianceTaskTypes';

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const colors: Record<TaskPriority, string> = {
    critical: 'bg-destructive text-destructive-foreground animate-pulse',
    high: 'bg-destructive/80 text-destructive-foreground',
    medium: 'bg-warning text-warning-foreground',
    low: 'bg-primary/20 text-primary',
  };
  return <Badge className={`text-xs ${colors[priority]}`}>{PRIORITY_NAMES[priority]}</Badge>;
}

export function EscalationDots({ level }: { level: number }) {
  if (level === 0) return null;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: level }).map((_, i) => (
        <div key={i} className={`h-2 w-2 rounded-full ${level >= 2 ? 'bg-destructive' : 'bg-warning'}`} />
      ))}
    </div>
  );
}
