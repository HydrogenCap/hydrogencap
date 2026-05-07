import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useActivitySidebar } from '@/state/activitySidebar';
import { NotificationsPanel } from '@/components/activity/NotificationsPanel';
import { SEO } from '@/components/SEO';

export default function NotificationsPage() {
  const { openSidebar } = useActivitySidebar();
  useEffect(() => { openSidebar('notifications'); }, [openSidebar]);
  return (
    <AppLayout>
      <SEO title="Notifications — TenureIQ" description="Compliance deadlines, rent alerts, and portfolio updates in one feed." />
      <NotificationsPanel />
    </AppLayout>
  );
}
