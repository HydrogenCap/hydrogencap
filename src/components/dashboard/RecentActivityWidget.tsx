import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentActivity } from '@/hooks/useAuditLog';
import { getTableDisplayName, getRecordIdentifier } from '@/lib/auditLogTypes';
import { cn } from '@/lib/utils';

const ACTION_CONFIG = {
  INSERT: { icon: Plus, className: 'text-success bg-success/10', label: 'Created' },
  UPDATE: { icon: Pencil, className: 'text-warning bg-warning/10', label: 'Updated' },
  DELETE: { icon: Trash2, className: 'text-destructive bg-destructive/10', label: 'Deleted' },
} as const;

export function RecentActivityWidget() {
  const navigate = useNavigate();
  const { data: entries, isLoading } = useRecentActivity(10);

  if (isLoading) return <Skeleton className="h-64" />;
  if (!entries || entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Recent Activity
          </CardTitle>
          <button
            onClick={() => navigate('/audit-log')}
            className="text-xs text-primary hover:underline"
          >
            View all
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {entries.map(entry => {
            const config = ACTION_CONFIG[entry.action as keyof typeof ACTION_CONFIG];
            const Icon = config.icon;
            const values = entry.new_values || entry.old_values;
            const recordLabel = getRecordIdentifier(entry.table_name, values);
            const tableName = getTableDisplayName(entry.table_name);

            return (
              <div key={entry.id} className="flex items-start gap-2.5 py-1.5">
                <div className={cn('flex-shrink-0 mt-0.5 p-1 rounded-full', config.className)}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug">
                    <span className="font-medium">{config.label}</span>{' '}
                    <span className="text-muted-foreground">{tableName}</span>{' — '}
                    <span className="font-medium truncate">{recordLabel}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(entry.changed_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
