import { Link } from 'react-router-dom';
import { Wrench, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PRIORITY_CONFIG, STATUS_CONFIG, OPEN_STATUSES, type MaintenanceStatus, type MaintenancePriority } from '@/lib/maintenanceTypes';

interface Props {
  tenantId: string;
}

export function TenantMaintenancePanel({ tenantId }: Props) {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['maintenance_requests', 'tenant', tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('maintenance_requests')
        .select('id, title, priority, status, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as Array<{ id: string; title: string; priority: MaintenancePriority; status: MaintenanceStatus; created_at: string }>;
    },
    enabled: !!tenantId,
  });

  const openCount = requests?.filter(r => OPEN_STATUSES.includes(r.status)).length || 0;

  if (isLoading || !requests || requests.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Maintenance
          {openCount > 0 && <Badge variant="destructive" className="h-4 text-[10px] px-1">{openCount}</Badge>}
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
          <Link to="/maintenance">View <ArrowRight className="h-3 w-3 ml-1" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {requests.slice(0, 5).map(r => (
          <Link key={r.id} to={`/maintenance/${r.id}`} className="flex items-center justify-between py-1 hover:bg-accent/50 rounded px-1 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs">{PRIORITY_CONFIG[r.priority]?.icon}</span>
              <span className="text-sm truncate">{r.title}</span>
            </div>
            <Badge variant="outline" className={`text-[9px] shrink-0 ${STATUS_CONFIG[r.status]?.color || ''}`}>
              {STATUS_CONFIG[r.status]?.label || r.status}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
