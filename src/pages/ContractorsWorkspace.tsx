import { lazy } from 'react';
import { HardHat, Wrench } from 'lucide-react';
import { WorkspaceShell, type WorkspaceTab } from '@/components/layout/WorkspaceShell';

const Contractors = lazy(() => import('./Contractors'));
const JobsAndWorks = lazy(() => import('./JobsAndWorks'));
const CapEx = lazy(() => import('./CapEx'));

const TABS: WorkspaceTab[] = [
  { key: 'directory', label: 'Directory', icon: HardHat, Component: Contractors },
  { key: 'jobs', label: 'Jobs & Works', icon: Wrench, Component: JobsAndWorks },
  { key: 'capex', label: 'CapEx', icon: HardHat, Component: CapEx },
];

export default function ContractorsWorkspace() {
  return <WorkspaceShell label="Contractor views" tabs={TABS} defaultKey="directory" />;
}
