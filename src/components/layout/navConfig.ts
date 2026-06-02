/**
 * Single source of truth for app navigation.
 *
 * Consolidated to ~12 top-level destinations. Each top-level item opens
 * into a workspace whose sub-views are tabs (?view=…), not separate
 * sidebar leaves. This keeps the surface area calm and predictable.
 */
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Settings,
  Shield,
  FileText,
  ClipboardCheck,
  FolderOpen,
  HardHat,
  History,
  Users,
  Wallet,
  Activity,
  ArrowRight,
  Inbox as InboxIcon,
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
  { title: 'Properties', icon: Building2, href: '/properties-v2' },
  { title: 'Entities', icon: Briefcase, href: '/entities' },
];

export const operationsItems: NavItem[] = [
  { title: 'Compliance', icon: Shield, href: '/compliance', badgeType: 'compliance' },
  { title: 'Lettings', icon: ArrowRight, href: '/lettings', badgeType: 'tenancy_events' },
  { title: 'Finance', icon: Wallet, href: '/finance' },
  { title: 'Contractors', icon: HardHat, href: '/contractors', badgeType: 'jobs' },
  { title: 'Inspections', icon: ClipboardCheck, href: '/inspections' },
  { title: 'Documents', icon: FolderOpen, href: '/documents' },
  { title: 'Inbox', icon: InboxIcon, href: '/inbox', badgeType: 'inbox' },
];

export const intelligenceItems: NavItem[] = [
  { title: 'Insights', icon: Activity, href: '/insights' },
  { title: 'Reports', icon: FileText, href: '/reports' },
];

export const adminItems: NavItem[] = [
  { title: 'Team', icon: Users, href: '/team' },
  { title: 'Audit Log', icon: History, href: '/audit-log' },
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
