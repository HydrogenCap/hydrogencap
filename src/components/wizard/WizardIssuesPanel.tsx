import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationError } from '@/lib/wizard/types';

interface WizardIssuesPanelProps {
  issues: ValidationError[];
}

export function WizardIssuesPanel({ issues }: WizardIssuesPanelProps) {
  const p0 = issues.filter((i) => i.priority === 'P0');
  const p1 = issues.filter((i) => i.priority === 'P1');
  const p2 = issues.filter((i) => i.priority === 'P2');

  if (issues.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No issues found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Issues</h3>

      {p0.length > 0 && (
        <IssueGroup
          label={`P0 Blockers (${p0.length})`}
          icon={<AlertCircle className="h-4 w-4" />}
          variant="destructive"
          items={p0}
        />
      )}

      {p1.length > 0 && (
        <IssueGroup
          label={`P1 Warnings (${p1.length})`}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant="warning"
          items={p1}
        />
      )}

      {p2.length > 0 && (
        <IssueGroup
          label={`P2 Info (${p2.length})`}
          icon={<Info className="h-4 w-4" />}
          variant="muted"
          items={p2}
        />
      )}
    </div>
  );
}

function IssueGroup({
  label,
  icon,
  variant,
  items,
}: {
  label: string;
  icon: React.ReactNode;
  variant: 'destructive' | 'warning' | 'muted';
  items: ValidationError[];
}) {
  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 text-sm font-medium mb-2',
          variant === 'destructive' && 'text-destructive',
          variant === 'warning' && 'text-warning',
          variant === 'muted' && 'text-muted-foreground'
        )}
      >
        {icon}
        {label}
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-muted-foreground pl-6">
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
