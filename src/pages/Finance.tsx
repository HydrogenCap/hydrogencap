import { lazy } from 'react';
import {
  BarChart3,
  PoundSterling,
  TrendingUp,
  Briefcase,
  Banknote,
  Shield,
  Receipt,
  Calculator,
  LineChart,
} from 'lucide-react';
import { WorkspaceShell, type WorkspaceTab } from '@/components/layout/WorkspaceShell';

const Financials = lazy(() => import('./Financials'));
const Lending = lazy(() => import('./Lending'));
const RefinancingOpportunities = lazy(() => import('./RefinancingOpportunities'));
const Investors = lazy(() => import('./Investors'));
const Distributions = lazy(() => import('./Distributions'));
const Insurance = lazy(() => import('./Insurance'));
const Accounting = lazy(() => import('./Accounting'));
const Tax = lazy(() => import('./Tax'));
const TaxDashboard = lazy(() => import('./TaxDashboard'));
const FinancialForecast = lazy(() => import('./FinancialForecast'));

const TABS: WorkspaceTab[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3, Component: Financials },
  { key: 'lending', label: 'Lending', icon: PoundSterling, Component: Lending },
  { key: 'refinancing', label: 'Refinancing', icon: TrendingUp, Component: RefinancingOpportunities },
  { key: 'investors', label: 'Investors', icon: Briefcase, Component: Investors },
  { key: 'distributions', label: 'Distributions', icon: Banknote, Component: Distributions },
  { key: 'insurance', label: 'Insurance', icon: Shield, Component: Insurance },
  { key: 'accounting', label: 'Accounting', icon: Receipt, Component: Accounting },
  { key: 'tax', label: 'Tax', icon: Receipt, Component: Tax },
  { key: 'tax-engine', label: 'Tax Engine', icon: Calculator, Component: TaxDashboard },
  { key: 'forecast', label: 'Forecast', icon: LineChart, Component: FinancialForecast },
];

export default function Finance() {
  return <WorkspaceShell label="Finance views" tabs={TABS} defaultKey="overview" />;
}
