import { formatDistanceToNow } from 'date-fns';
import { 
  Home, 
  TrendingUp, 
  Banknote, 
  Percent, 
  FileText, 
  FileCheck, 
  PiggyBank,
  Receipt,
  MessageSquare,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivityLog } from '@/hooks/useActivityLog';
import type { Database } from '@/integrations/supabase/types';

type ActivityLog = Database['public']['Tables']['activity_log']['Row'];

interface ActivityTimelineProps {
  propertyId?: string;
  limit?: number;
  showHeader?: boolean;
}

const ENTRY_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  property_created: { icon: Home, color: 'text-primary' },
  property_updated: { icon: Home, color: 'text-muted-foreground' },
  valuation_changed: { icon: TrendingUp, color: 'text-emerald-500' },
  mortgage_updated: { icon: Banknote, color: 'text-amber-500' },
  rate_changed: { icon: Percent, color: 'text-amber-500' },
  income_updated: { icon: PiggyBank, color: 'text-emerald-500' },
  costs_updated: { icon: Receipt, color: 'text-destructive' },
  document_uploaded: { icon: FileText, color: 'text-blue-500' },
  document_accepted: { icon: FileCheck, color: 'text-emerald-500' },
  note_added: { icon: MessageSquare, color: 'text-muted-foreground' },
  manual: { icon: Activity, color: 'text-muted-foreground' },
};

function ActivityItem({ entry }: { entry: ActivityLog }) {
  const config = ENTRY_TYPE_CONFIG[entry.entry_type] || ENTRY_TYPE_CONFIG.manual;
  const Icon = config.icon;

  return (
    <div className="flex gap-3 py-3">
      <div className={`shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-foreground text-sm">{entry.title}</p>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
          </span>
        </div>
        {entry.body && (
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{entry.body}</p>
        )}
      </div>
    </div>
  );
}

export function ActivityTimeline({ propertyId, limit = 20, showHeader = true }: ActivityTimelineProps) {
  const { data: activities, isLoading } = useActivityLog(propertyId);

  const displayedActivities = activities?.slice(0, limit) || [];

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (displayedActivities.length === 0) {
    return (
      <Card className="bg-card border-border">
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity recorded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="divide-y divide-border">
          {displayedActivities.map(entry => (
            <ActivityItem key={entry.id} entry={entry} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
