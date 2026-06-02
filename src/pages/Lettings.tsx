import { lazy } from 'react';
import { Users, PoundSterling, DoorOpen, ArrowRight } from 'lucide-react';
import { WorkspaceShell, type WorkspaceTab } from '@/components/layout/WorkspaceShell';

const TenantsV2 = lazy(() => import('./TenantsV2'));
const RentCollection = lazy(() => import('./RentCollection'));
const Voids = lazy(() => import('./Voids'));
const LettingsPipeline = lazy(() => import('./LettingsPipeline'));

const TABS: WorkspaceTab[] = [
  { key: 'tenants', label: 'Tenants', icon: Users, Component: TenantsV2 },
  { key: 'rent', label: 'Rent', icon: PoundSterling, Component: RentCollection },
  { key: 'voids', label: 'Voids', icon: DoorOpen, Component: Voids },
  { key: 'pipeline', label: 'Pipeline', icon: ArrowRight, Component: LettingsPipeline },
];

export default function Lettings() {
  return <WorkspaceShell label="Lettings views" tabs={TABS} defaultKey="tenants" />;
}
