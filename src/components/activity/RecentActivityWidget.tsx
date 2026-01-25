import { Link } from 'react-router-dom';
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
  Activity,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentActivity } from '@/hooks/useActivityLog';
import { useProperties } from '@/hooks/useProperties';
import type { Database } from '@/integrations/supabase/types';

type ActivityLog = Database['public']['Tables']['activity_log']['Row'];

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

interface RecentActivityWidgetProps {
  limit?: number;
}

export function RecentActivityWidget({ limit = 8 }: RecentActivityWidgetProps) {
  const { data: activities, isLoading } = useRecentActivity(limit);
  const { data: properties } = useProperties();

  // Create a map of property IDs to addresses for quick lookup
  const propertyMap = new Map(
    properties?.map(p => [p.id, p.address_line.split(',')[0]]) || []
  );

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities?.length) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity yet</p>
            <p className="text-xs mt-1">Activity will appear as you manage your portfolio</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {activities.map(entry => {
            const config = ENTRY_TYPE_CONFIG[entry.entry_type] || ENTRY_TYPE_CONFIG.manual;
            const Icon = config.icon;
            const propertyName = entry.property_id ? propertyMap.get(entry.property_id) : null;

            return (
              <div 
                key={entry.id} 
                className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className={`shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm truncate">{entry.title}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {propertyName && (
                      <>
                        <Link 
                          to={`/properties/${entry.property_id}`}
                          className="hover:text-foreground truncate max-w-24"
                        >
                          {propertyName}
                        </Link>
                        <span>•</span>
                      </>
                    )}
                    <span className="shrink-0">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
