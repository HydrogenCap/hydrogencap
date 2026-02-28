/**
 * Portfolio Tenancy Events Widget (AA4a)
 * Shows upcoming tenancy events across the portfolio for the dashboard.
 */
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarCheck, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTenancyEvents } from '@/hooks/useTenancyEvents';

export function TenancyEventsWidget() {
  const navigate = useNavigate();
  const { data: events, isLoading } = useTenancyEvents({ daysAhead: 90 });

  if (isLoading) return <Skeleton className="h-64" />;

  const displayEvents = (events || []).slice(0, 10);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'overdue': return <Badge variant="destructive" className="text-[10px]">Overdue</Badge>;
      case 'action_required': return <Badge className="bg-warning text-warning-foreground text-[10px]">Action needed</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">Upcoming</Badge>;
    }
  };

  const eventTypeLabel = (type: string) => {
    switch (type) {
      case 'tenancy_end': return 'Tenancy ends';
      case 'break_clause': return 'Break clause';
      case 'rent_review': return 'Rent review';
      case 'void_start': return 'Void started';
      default: return type;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" />
          Tenancy Events
          {displayEvents.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">{events?.length || 0}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No upcoming tenancy events</p>
        ) : (
          <div className="space-y-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-muted-foreground py-1.5 font-medium">Date</th>
                  <th className="text-left text-xs text-muted-foreground py-1.5 font-medium">Property / Room</th>
                  <th className="text-left text-xs text-muted-foreground py-1.5 font-medium">Tenant</th>
                  <th className="text-left text-xs text-muted-foreground py-1.5 font-medium">Event</th>
                  <th className="text-left text-xs text-muted-foreground py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayEvents.map((event, i) => (
                  <tr
                    key={`${event.tenancyId}-${event.type}-${i}`}
                    className={cn(
                      'border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors',
                      event.status === 'overdue' && 'bg-destructive/5'
                    )}
                    onClick={() => navigate(`/properties-v2/${event.propertyId}`)}
                  >
                    <td className="py-2 text-xs font-mono">{format(new Date(event.date), 'dd/MM')}</td>
                    <td className="py-2 text-xs max-w-[160px] truncate">
                      {event.propertyAddress}, {event.roomName}
                    </td>
                    <td className="py-2 text-xs">{event.tenantName}</td>
                    <td className="py-2 text-xs">{eventTypeLabel(event.type)}</td>
                    <td className="py-2">{statusBadge(event.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(events?.length || 0) > 10 && (
              <div className="pt-2 text-center">
                <Button variant="ghost" size="sm" onClick={() => navigate('/tenants-v2')}>
                  View all {events?.length} events <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
