import { lazy } from 'react';
import { Activity, History, TrendingUp, AlertTriangle, MessageSquare, FileText, Building2 } from 'lucide-react';
import { WorkspaceShell, type WorkspaceTab } from '@/components/layout/WorkspaceShell';

const Insights = lazy(() => import('./Insights'));
const Timeline = lazy(() => import('./Timeline'));
const PortfolioTimeline = lazy(() => import('./PortfolioTimeline'));
const ValuationAlerts = lazy(() => import('./ValuationAlerts'));
const Chat = lazy(() => import('./Chat'));
const AIInvestorReports = lazy(() => import('./AIInvestorReports'));
const AcquisitionAdvisor = lazy(() => import('./AcquisitionAdvisor'));

const TABS: WorkspaceTab[] = [
  { key: 'overview', label: 'Overview', icon: Activity, Component: Insights },
  { key: 'timeline', label: 'Timeline', icon: History, Component: Timeline },
  { key: 'performance', label: 'Performance', icon: TrendingUp, Component: PortfolioTimeline },
  { key: 'valuations', label: 'Val. alerts', icon: AlertTriangle, Component: ValuationAlerts },
  { key: 'chat', label: 'AI Chat', icon: MessageSquare, Component: Chat },
  { key: 'ai-reports', label: 'AI reports', icon: FileText, Component: AIInvestorReports },
  { key: 'acquisition', label: 'Acquisition', icon: Building2, Component: AcquisitionAdvisor },
];

export default function InsightsWorkspace() {
  return <WorkspaceShell label="Insights views" tabs={TABS} defaultKey="overview" />;
}
