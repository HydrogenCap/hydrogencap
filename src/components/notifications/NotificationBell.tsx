import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUnreadNotifications, useMarkNotificationRead, useMarkAllRead, useDismissNotification } from '@/hooks/useComplianceNotifications';
import { NOTIFICATION_TYPE_NAMES, type NotificationType } from '@/lib/complianceTaskTypes';
import { formatDistanceToNow } from 'date-fns';

function NotificationIcon({ type }: { type: string }) {
  if (type.includes('expired') || type === 'expired') return <XCircle className="h-4 w-4 text-destructive" />;
  if (type.includes('expiry') || type.includes('escalation')) return <AlertTriangle className="h-4 w-4 text-warning" />;
  if (type === 'inspection_reminder') return <Clock className="h-4 w-4 text-primary" />;
  if (type === 'resolution_confirmed') return <CheckCircle2 className="h-4 w-4 text-primary" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: notifications } = useUnreadNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();
  const dismiss = useDismissNotification();
  const [open, setOpen] = useState(false);

  const count = notifications?.length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] animate-pulse"
            >
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {count === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No new notifications</p>
          ) : (
            notifications?.slice(0, 20).map(n => (
              <div
                key={n.id}
                className="p-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer border-l-2 border-l-primary/50"
                onClick={() => {
                  markRead.mutate(n.id);
                  if (n.compliance_task_id) navigate('/compliance-tasks');
                  setOpen(false);
                }}
              >
                <div className="flex items-start gap-2">
                  <NotificationIcon type={n.notification_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{n.message}</p>
                    {n.property_address && (
                      <p className="text-xs text-muted-foreground mt-0.5">{n.property_address}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.sent_at))} ago
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => { e.stopPropagation(); dismiss.mutate(n.id); }}
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        {count > 0 && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { navigate('/compliance-tasks'); setOpen(false); }}>
              View all tasks
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
