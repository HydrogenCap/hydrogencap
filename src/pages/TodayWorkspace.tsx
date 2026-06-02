import { lazy } from 'react';
import { Activity, Wrench, AlertTriangle, BarChart3, ClipboardList } from 'lucide-react';
import { WorkspaceShell, type WorkspaceTab } from '@/components/layout/WorkspaceShell';

const Today = lazy(() => import('./Today'));
const FixIt = lazy(() => import('./FixIt'));
const MissingInfo = lazy(() => import('./MissingInfo'));
const DataQuality = lazy(() => import('./DataQuality'));
const Actions = lazy(() => import('./Actions'));

const TABS: WorkspaceTab[] = [
  { key: 'today', label: 'Today', icon: Activity, Component: Today },
  { key: 'fix-it', label: 'Fix-it', icon: Wrench, Component: FixIt },
  { key: 'missing-info', label: 'Missing info', icon: AlertTriangle, Component: MissingInfo },
  { key: 'data-quality', label: 'Data quality', icon: BarChart3, Component: DataQuality },
  { key: 'actions', label: 'Actions', icon: ClipboardList, Component: Actions },
];

export default function TodayWorkspace() {
  return <WorkspaceShell label="Today views" tabs={TABS} defaultKey="today" />;
}
