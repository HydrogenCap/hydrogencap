import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Wrench, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { PRIORITY_CONFIG, STATUS_CONFIG, OPEN_STATUSES } from '@/lib/maintenanceTypes';

interface Props {
  propertyId: string;
}

export function PropertyMaintenancePanel({ propertyId }: Props) {
  const { data: requests, isLoading } = useMaintenanceRequests({ propertyId });

  const openRequests = requests?.filter(r => OPEN_STATUSES.includes(r.status)) || [];
  const recentClosed = requests?.filter(r => !OPEN_STATUSES.includes(r.status)).slice(0, 3) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" /> Maintenance</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Loading...</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Maintenance
          {openRequests.length > 0 && (
            <Badge variant="destructive" className="h-5 text-[10px] px-1.5">{openRequests.length} open</Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/maintenance">View All <ArrowRight className="h-3 w-3 ml-1" /></Link>
        </Button>
      </CardHeader>
      <CardContent>
        {requests?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No maintenance requests for this property</p>
        ) : (
          <div className="space-y-2">
            {openRequests.map(r => (
              <Link key={r.id} to={`/maintenance/${r.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${PRIORITY_CONFIG[r.priority].color}`}>
                    {PRIORITY_CONFIG[r.priority].icon} {PRIORITY_CONFIG[r.priority].label}
                  </Badge>
                  <span className="text-sm truncate">{r.title}</span>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_CONFIG[r.status].color}`}>
                  {STATUS_CONFIG[r.status].label}
                </Badge>
              </Link>
            ))}
            {recentClosed.length > 0 && openRequests.length > 0 && (
              <div className="border-t pt-2 mt-2">
                <p className="text-xs text-muted-foreground mb-1">Recently Closed</p>
              </div>
            )}
            {recentClosed.map(r => (
              <Link key={r.id} to={`/maintenance/${r.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors opacity-60">
                <span className="text-sm truncate">{r.title}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'dd MMM')}</span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
