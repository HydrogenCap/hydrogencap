import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useActivitySidebar } from '@/state/activitySidebar';
import { NotificationsPanel } from '@/components/activity/NotificationsPanel';

export default function NotificationsPage() {
  const { openSidebar } = useActivitySidebar();
  useEffect(() => { openSidebar('notifications'); }, [openSidebar]);
  return (
    <AppLayout>
      <NotificationsPanel />
    </AppLayout>
  );
}
