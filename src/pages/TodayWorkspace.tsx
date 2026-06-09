import { lazy } from 'react';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import { WorkspaceShell, type WorkspaceTab } from '@/components/layout/WorkspaceShell';

const MissingInfo = lazy(() => import('./MissingInfo'));
const Actions = lazy(() => import('./Actions'));

const TABS: WorkspaceTab[] = [
  { key: 'missing-info', label: 'Missing info', icon: AlertTriangle, Component: MissingInfo },
  { key: 'actions', label: 'Actions', icon: ClipboardList, Component: Actions },
];

export default function TodayWorkspace() {
  return <WorkspaceShell label="Today views" tabs={TABS} defaultKey="missing-info" />;
}
