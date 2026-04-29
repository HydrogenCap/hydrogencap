import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Shield, PoundSterling, Wrench, Users, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications, useMarkAsRead, useMarkAllRead, useDismissNotification, useDismissAllRead } from '@/hooks/useNotifications';
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

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'rent', label: 'Rent' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'tenancy', label: 'Tenancy' },
];

export function NotificationsPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const isUnreadTab = tab === 'unread';
  const categoryFilter = ['all', 'unread'].includes(tab) ? undefined : tab;

  const { data: notifications = [], isLoading } = useNotifications({
    category: categoryFilter,
    unreadOnly: isUnreadTab,
  });

  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllRead();
  const dismiss = useDismissNotification();
  const dismissAllRead = useDismissAllRead();

  const handleClick = (n: Notification) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link_to) navigate(n.link_to);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notifications
          </h2>
          <p className="text-muted-foreground text-sm">Stay on top of compliance, rent, and maintenance events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
            Mark all as read
          </Button>
          <Button variant="outline" size="sm" onClick={() => dismissAllRead.mutate()}>
            Dismiss all read
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-3" />
          <p className="text-lg font-medium">You're all caught up</p>
          <p className="text-muted-foreground text-sm">No notifications to show</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {notifications.map(n => {
            const Icon = CATEGORY_ICONS[n.category] || Bell;
            const isUnread = !n.read_at;
            return (
              <div
                key={n.id}
                className={cn(
                  'p-4 hover:bg-muted/50 cursor-pointer border-l-3 transition-colors',
                  SEVERITY_BORDER[n.severity] || 'border-l-primary',
                  isUnread && 'bg-primary/5'
                )}
                onClick={() => handleClick(n)}
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at))} ago
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={(e) => { e.stopPropagation(); dismiss.mutate(n.id); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
