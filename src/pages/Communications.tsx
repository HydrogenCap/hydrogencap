import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useActivitySidebar } from '@/state/activitySidebar';
import { CommunicationsPanel } from '@/components/activity/CommunicationsPanel';

export default function CommunicationsPage() {
  const { openSidebar } = useActivitySidebar();
  useEffect(() => { openSidebar('inbox'); }, [openSidebar]);
  return (
    <AppLayout>
      <CommunicationsPanel />
    </AppLayout>
  );
}
