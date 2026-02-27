import { Link } from 'react-router-dom';
import { Wrench, AlertTriangle, ArrowRight, Siren } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { PRIORITY_CONFIG, STATUS_CONFIG, OPEN_STATUSES } from '@/lib/maintenanceTypes';

export function MaintenanceWidget() {
  const { data: requests, isLoading } = useMaintenanceRequests();

  const openRequests = requests?.filter(r => OPEN_STATUSES.includes(r.status)) || [];
  const emergencies = openRequests.filter(r => r.is_emergency);
  const urgent = openRequests.filter(r => r.priority === 'urgent');

  if (isLoading) return null;
  if (!requests || requests.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Maintenance
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
          <Link to="/maintenance">View All <ArrowRight className="h-3 w-3 ml-1" /></Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-3">
          <div>
            <p className="text-2xl font-bold">{openRequests.length}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </div>
          {emergencies.length > 0 && (
            <div className="flex items-center gap-1 text-destructive">
              <Siren className="h-4 w-4 animate-pulse" />
              <span className="font-bold">{emergencies.length}</span>
              <span className="text-xs">Emergency</span>
            </div>
          )}
          {urgent.length > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-bold">{urgent.length}</span>
              <span className="text-xs">Urgent</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {openRequests.slice(0, 4).map(r => (
            <Link key={r.id} to={`/maintenance/${r.id}`} className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs">{PRIORITY_CONFIG[r.priority]?.icon}</span>
                <span className="text-sm truncate">{r.title}</span>
              </div>
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">{r.property?.address_line}</span>
            </Link>
          ))}
          {openRequests.length > 4 && (
            <p className="text-xs text-muted-foreground text-center pt-1">+{openRequests.length - 4} more</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
