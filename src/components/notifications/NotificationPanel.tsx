import { useNavigate } from 'react-router-dom';
import { Shield, PoundSterling, Wrench, Users, Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@/hooks/useNotifications';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  compliance: Shield,
  rent: PoundSterling,
  maintenance: Wrench,
  tenancy: Users,
  system: Bell,
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-l-destructive',
  warning: 'border-l-warning',
  info: 'border-l-primary',
  success: 'border-l-green-500',
};

interface NotificationPanelProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

export function NotificationPanel({ notifications, onMarkRead, onMarkAllRead, onDismiss, onClose }: NotificationPanelProps) {
  const navigate = useNavigate();
  const items = notifications.slice(0, 8);
  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <div className="w-full">
      <div className="p-3 border-b flex items-center justify-between">
        <h4 className="font-semibold text-sm">Notifications</h4>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No new notifications</p>
        ) : (
          items.map(n => {
            const Icon = CATEGORY_ICONS[n.category] || Bell;
            const isUnread = !n.read_at;
            return (
              <div
                key={n.id}
                className={cn(
                  'p-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer border-l-3',
                  SEVERITY_BORDER[n.severity] || 'border-l-primary',
                  isUnread && 'bg-primary/5'
                )}
                onClick={() => {
                  onMarkRead(n.id);
                  if (n.link_to) navigate(n.link_to);
                  onClose();
                }}
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at))} ago
                    </p>
                  </div>
                  <Button aria-label="Close"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {notifications.length > 0 && (
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => { navigate('/notifications'); onClose(); }}
          >
            View all notifications
          </Button>
        </div>
      )}
    </div>
  );
}
