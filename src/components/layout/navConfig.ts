/**
 * Single source of truth for app navigation.
 * Both AppSidebar (desktop) and MobileBottomNav consume this.
 *
 * Keeping one config prevents drift like "the Inbox route exists but
 * isn't in the sidebar" — every visible destination is registered here.
 */
import {
  ArrowRight,
  LayoutDashboard,
  Building2,
  Briefcase,
  Calculator,
  DoorOpen,
  Settings,
  TrendingUp,
  Shield,
  FileText,
  MessageSquare,
  ClipboardList,
  ClipboardCheck,
  Construction,
  FolderOpen,
  History,
  CalendarCheck,
  AlertTriangle,
  HardHat,
  Users,
  PoundSterling,
  Wrench,
  Upload,
  Inbox as InboxIcon,
  FolderUp,
  FileSignature,
  ShieldCheck,
  Receipt,
  Wallet,
  BarChart3,
  Activity,
  LineChart,
  Scale,
  Banknote,
} from 'lucide-react';
import type { SectionKey } from '@/lib/sectionVisibility';

export type BadgeType =
  | 'actions'
  | 'jobs'
  | 'compliance'
  | 'inbox'
  | 'tasks'
  | 'tenancy_events'
  | 'arrears'
  | 'refinancing';

export interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badgeType?: BadgeType;
  sectionKey?: SectionKey;
  children?: NavItem[];
}

export const portfolioItems: NavItem[] = [
  { title: 'Today', icon: Activity, href: '/today' },
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { title: 'Fix-it queue', icon: Wrench, href: '/fix-it' },
  { title: 'Missing info', icon: AlertTriangle, href: '/missing-info' },
  { title: 'Properties', icon: Building2, href: '/properties-v2' },
  { title: 'Pipeline', icon: Construction, href: '/pipeline' },
  {
    title: 'Entities',
    icon: Briefcase,
    href: '/entities',
    children: [{ title: 'Ownership', icon: Users, href: '/ownership' }],
  },
];

export const operationsItems: NavItem[] = [
  {
    title: 'Compliance',
    icon: Shield,
    href: '/compliance-v2',
    badgeType: 'compliance',
    children: [
      { title: 'Tasks', icon: ClipboardList, href: '/compliance-tasks', badgeType: 'tasks' },
      { title: 'Calendar', icon: CalendarCheck, href: '/compliance-calendar' },
      { title: "Renters' Rights", icon: ShieldCheck, href: '/renters-rights' },
      { title: 'Reg. Monitor', icon: Scale, href: '/regulatory-monitor' },
    ],
  },
  { title: 'Compliance Inbox', icon: InboxIcon, href: '/inbox', badgeType: 'inbox' },
  {
    title: 'Lettings',
    icon: ArrowRight,
    href: '/lettings',
    children: [
      { title: 'Tenants', icon: Users, href: '/tenants-v2', badgeType: 'tenancy_events' },
      { title: 'Rent', icon: PoundSterling, href: '/rent', badgeType: 'arrears' },
      { title: 'Voids', icon: DoorOpen, href: '/voids', sectionKey: 'voids' },
    ],
  },
  {
    title: 'Finance',
    icon: Wallet,
    href: '/financials',
    children: [
      { title: 'Lending', icon: PoundSterling, href: '/lending', sectionKey: 'lending' },
      { title: 'Refinancing', icon: TrendingUp, href: '/refinancing-opportunities', sectionKey: 'lending', badgeType: 'refinancing' },
      { title: 'Financials', icon: BarChart3, href: '/financials' },
      { title: 'Investors', icon: Briefcase, href: '/investors', sectionKey: 'investors' },
      { title: 'Distributions', icon: Banknote, href: '/distributions', sectionKey: 'distributions' },
      { title: 'Insurance', icon: Shield, href: '/insurance' },
      { title: 'Accounting', icon: Receipt, href: '/accounting' },
    ],
  },
  {
    title: 'Contractors',
    icon: HardHat,
    href: '/contractors',
    children: [
      { title: 'Jobs & Works', icon: Wrench, href: '/jobs-and-works', badgeType: 'jobs', sectionKey: 'jobs' },
      { title: 'CapEx', icon: HardHat, href: '/capex', sectionKey: 'capex' },
    ],
  },
  { title: 'Inspections', icon: ClipboardCheck, href: '/inspections' },
  {
    title: 'Documents',
    icon: FolderOpen,
    href: '/documents',
    children: [
      { title: 'Templates', icon: FileSignature, href: '/templates' },
      { title: 'Bulk Upload', icon: FolderUp, href: '/bulk-upload' },
    ],
  },
];

export const intelligenceItems: NavItem[] = [
  {
    title: 'Insights',
    icon: Activity,
    href: '/insights',
    children: [
      { title: 'Timeline', icon: History, href: '/timeline' },
      { title: 'Performance', icon: TrendingUp, href: '/portfolio-timeline' },
      { title: 'Val. Alerts', icon: AlertTriangle, href: '/valuation-alerts' },
    ],
  },
  {
    title: 'Reports',
    icon: FileText,
    href: '/reports',
    children: [
      { title: 'Tax', icon: Receipt, href: '/tax' },
      { title: 'Tax Engine', icon: Calculator, href: '/tax-engine' },
      { title: 'AI Reports', icon: FileText, href: '/investor-reports' },
    ],
  },
  { title: 'Forecast', icon: LineChart, href: '/financial-forecast' },
  { title: 'Chat', icon: MessageSquare, href: '/chat' },
  { title: 'Acquisition', icon: Building2, href: '/acquisition-advisor' },
];

export const adminItems: NavItem[] = [
  { title: 'Team', icon: Users, href: '/team' },
  {
    title: 'Import',
    icon: Upload,
    href: '/import',
    children: [{ title: 'Passport', icon: ClipboardList, href: '/passport' }],
  },
  { title: 'Settings', icon: Settings, href: '/settings' },
];

export const allNavItems: NavItem[] = [
  ...portfolioItems,
  ...operationsItems,
  ...intelligenceItems,
  ...adminItems,
];

/** Flatten nav tree to a single list of leaf destinations (for mobile More drawer / search). */
export function flattenNav(items: NavItem[] = allNavItems): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      out.push({ ...item, children: undefined });
      out.push(...flattenNav(item.children));
    } else {
      out.push(item);
    }
  }
  return out;
}
