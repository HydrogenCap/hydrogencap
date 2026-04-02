import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  LayoutDashboard,
  Building2,
  Briefcase,
  DoorOpen,
  Settings,
  LogOut,
  Inbox,
  TrendingUp,
  Shield,
  FileText,
  MessageSquare,
  AlertCircle,
  ClipboardList,
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
  FolderUp,
  ScrollText,
  FileSignature,
  ShieldCheck,
  Receipt,
  Banknote,
  ChevronRight,
  Wallet,
  BarChart3,
  Activity,
  LineChart,
  Scale,
} from 'lucide-react';
import { usePortfolioComplianceStats } from '@/hooks/usePortfolioComplianceStats';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { useInboxDocuments } from '@/hooks/useDocuments';
import { usePortfolioRisks } from '@/hooks/usePortfolioRisks';
import { useJobCounts } from '@/hooks/useContractorJobs';
import { useComplianceTaskStats } from '@/hooks/useComplianceTasks';
import { useTenancyEventCounts } from '@/hooks/useTenancyEvents';
import { useIsAdmin } from '@/hooks/usePlatformAdmin';
import { LogoWordmark } from '@/components/LogoWordmark';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import type { SectionKey } from '@/lib/sectionVisibility';
import { OrganizationSwitcher } from './OrganizationSwitcher';

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badgeType?: 'actions' | 'jobs' | 'compliance' | 'inbox' | 'tasks' | 'tenancy_events';
  sectionKey?: SectionKey;
  children?: NavItem[];
}

const portfolioItems: NavItem[] = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { title: 'Properties', icon: Building2, href: '/properties-v2' },
  { title: 'Pipeline', icon: Construction, href: '/pipeline' },
  {
    title: 'Entities',
    icon: Briefcase,
    href: '/entities',
    children: [
      { title: 'Ownership', icon: Users, href: '/ownership' },
    ],
  },
];

const operationsItems: NavItem[] = [
  { title: 'Actions', icon: AlertTriangle, href: '/actions', badgeType: 'actions' },
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
  {
    title: 'Lettings',
    icon: ArrowRight,
    href: '/lettings',
    children: [
      { title: 'Tenants', icon: Users, href: '/tenants-v2', badgeType: 'tenancy_events' },
      { title: 'Rent', icon: PoundSterling, href: '/rent' },
      { title: 'Voids', icon: DoorOpen, href: '/voids', sectionKey: 'voids' },
    ],
  },
  {
    title: 'Finance',
    icon: Wallet,
    href: '/financials',
    children: [
      { title: 'Lending', icon: PoundSterling, href: '/lending', sectionKey: 'lending' },
      { title: 'Refinancing', icon: TrendingUp, href: '/refinancing-opportunities', sectionKey: 'lending' },
      { title: 'Financials', icon: BarChart3, href: '/financials' },
      { title: 'Investors', icon: Briefcase, href: '/investors', sectionKey: 'investors' },
      { title: 'Distributions', icon: Banknote, href: '/distributions', sectionKey: 'distributions' },
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
  {
    title: 'Documents',
    icon: FolderOpen,
    href: '/documents',
    children: [
      { title: 'Inbox', icon: Inbox, href: '/inbox', badgeType: 'inbox' },
      { title: 'Templates', icon: FileSignature, href: '/templates' },
      { title: 'Bulk Upload', icon: FolderUp, href: '/bulk-upload' },
    ],
  },
];

const intelligenceItems: NavItem[] = [
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
      { title: 'AI Reports', icon: FileText, href: '/investor-reports' },
    ],
  },
  { title: 'Forecast', icon: LineChart, href: '/financial-forecast' },
  { title: 'Chat', icon: MessageSquare, href: '/chat' },
  { title: 'Acquisition', icon: Building2, href: '/acquisition-advisor' },
];

const adminItems: NavItem[] = [
  { title: 'Team', icon: Users, href: '/team' },
  {
    title: 'Import',
    icon: Upload,
    href: '/import',
    children: [
      { title: 'Passport', icon: ClipboardList, href: '/passport' },
      { title: 'Missing Info', icon: AlertCircle, href: '/missing-info' },
    ],
  },
  {
    title: 'Settings',
    icon: Settings,
    href: '/settings',
    children: [
      { title: 'Audit Log', icon: ScrollText, href: '/audit-log' },
    ],
  },
];

const STORAGE_KEY = 'sidebar:expanded-items';

function loadExpandedState(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveExpandedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const isAdmin = useIsAdmin();
  const { isVisible } = useSectionVisibility();
  const { data: inboxDocuments } = useInboxDocuments();
  const { stats: complianceStats } = usePortfolioComplianceStats();
  const { totalCount: actionsCount, criticalCount: actionsCriticalCount } = usePortfolioRisks();
  const { data: jobCounts } = useJobCounts();
  const taskStats = useComplianceTaskStats();
  const { urgentCount: tenancyUrgentCount } = useTenancyEventCounts();

  const urgentJobsCount = (jobCounts?.urgent || 0) + (jobCounts?.high || 0);

  const pendingCount = inboxDocuments?.filter(
    d => d.review_status === 'pending' && d.extraction_status === 'completed'
  ).length || 0;

  const complianceAlertCount = complianceStats.expired + complianceStats.expiring;
  const expiredCount = complianceStats.expired;

  const isActive = (href: string) =>
    location.pathname === href ||
    (href !== '/dashboard' && location.pathname.startsWith(href));

  const hasActiveChild = useCallback((item: NavItem): boolean => {
    if (!item.children) return false;
    return item.children.some(child => isActive(child.href) || hasActiveChild(child));
  }, [location.pathname]);

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() => {
    const stored = loadExpandedState();
    // Auto-expand items with active children on initial load
    const allItems = [...portfolioItems, ...operationsItems, ...intelligenceItems, ...adminItems];
    const initial = { ...stored };
    for (const item of allItems) {
      if (item.children) {
        const childActive = item.children.some(child =>
          location.pathname === child.href ||
          (child.href !== '/dashboard' && location.pathname.startsWith(child.href))
        );
        if (childActive) {
          initial[item.title] = true;
        }
      }
    }
    return initial;
  });

  // Auto-expand parent when navigating to a child route
  useEffect(() => {
    const allItems = [...portfolioItems, ...operationsItems, ...intelligenceItems, ...adminItems];
    let changed = false;
    const updated = { ...expandedItems };
    for (const item of allItems) {
      if (item.children && hasActiveChild(item) && !updated[item.title]) {
        updated[item.title] = true;
        changed = true;
      }
    }
    if (changed) {
      setExpandedItems(updated);
      saveExpandedState(updated);
    }
  }, [location.pathname, hasActiveChild]);

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev => {
      const next = { ...prev, [title]: !prev[title] };
      saveExpandedState(next);
      return next;
    });
  };

  const renderBadge = (item: NavItem) => {
    if (item.badgeType === 'actions' && actionsCount > 0) {
      return (
        <Badge
          variant={actionsCriticalCount > 0 ? "destructive" : "secondary"}
          className="h-5 min-w-5 px-1.5 text-xs"
        >
          {actionsCount}
        </Badge>
      );
    }
    if (item.badgeType === 'compliance' && complianceAlertCount > 0) {
      return (
        <Badge
          variant={expiredCount > 0 ? "destructive" : "secondary"}
          className="h-5 min-w-5 px-1.5 text-xs"
        >
          {complianceAlertCount}
        </Badge>
      );
    }
    if (item.badgeType === 'inbox' && pendingCount > 0) {
      return (
        <Badge
          variant="secondary"
          className="h-5 min-w-5 px-1.5 text-xs"
        >
          {pendingCount}
        </Badge>
      );
    }
    if (item.badgeType === 'jobs' && urgentJobsCount > 0) {
      return (
        <Badge
          variant={jobCounts?.urgent ? "destructive" : "secondary"}
          className="h-5 min-w-5 px-1.5 text-xs"
        >
          {urgentJobsCount}
        </Badge>
      );
    }
    if (item.badgeType === 'tasks' && taskStats.overdueCount > 0) {
      return (
        <Badge
          variant="destructive"
          className="h-5 min-w-5 px-1.5 text-xs"
        >
          {taskStats.overdueCount}
        </Badge>
      );
    }
    if (item.badgeType === 'tenancy_events' && tenancyUrgentCount > 0) {
      return (
        <Badge
          variant="destructive"
          className="h-5 min-w-5 px-1.5 text-xs"
        >
          {tenancyUrgentCount}
        </Badge>
      );
    }
    return null;
  };

  const renderNavItem = (item: NavItem) => {
    // Filter out items hidden by section visibility
    if (item.sectionKey && !isVisible(item.sectionKey)) return null;

    // Simple item without children
    if (!item.children) {
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={isActive(item.href)}>
            <Link to={item.href} className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.title}</span>
              {renderBadge(item)}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    // Filter children by section visibility
    const visibleChildren = item.children.filter(
      child => !child.sectionKey || isVisible(child.sectionKey)
    );

    // If no visible children remain, render as a simple link
    if (visibleChildren.length === 0) {
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={isActive(item.href)}>
            <Link to={item.href} className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.title}</span>
              {renderBadge(item)}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    // Collapsible item with children
    const isOpen = expandedItems[item.title] ?? false;

    return (
      <Collapsible
        key={item.title}
        open={isOpen}
        onOpenChange={() => toggleExpanded(item.title)}
        asChild
      >
        <SidebarMenuItem>
          <div className="flex items-center">
            <SidebarMenuButton
              asChild
              isActive={isActive(item.href)}
              className="flex-1"
            >
              <Link to={item.href} className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.title}</span>
                {renderBadge(item)}
              </Link>
            </SidebarMenuButton>
            <CollapsibleTrigger asChild>
              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                aria-label={`Toggle ${item.title}`}
              >
                <ChevronRight
                  className={`h-4 w-4 transition-transform duration-200 ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <SidebarMenuSub>
              {visibleChildren.map(child => (
                <SidebarMenuSubItem key={child.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive(child.href)}
                    size="sm"
                  >
                    <Link to={child.href} className="flex items-center gap-2">
                      <span className="flex-1">{child.title}</span>
                      {renderBadge(child)}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  const renderNavItems = (items: NavItem[]) => (
    <>
      {items.map(item => renderNavItem(item))}
    </>
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="space-y-3">
          <LogoWordmark to="/dashboard" size="lg" />
          <OrganizationSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* PORTFOLIO */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 text-xs uppercase tracking-wider">
            Portfolio
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItems(portfolioItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* OPERATIONS */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 text-xs uppercase tracking-wider">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItems(operationsItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* INTELLIGENCE */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 text-xs uppercase tracking-wider">
            Intelligence
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItems(intelligenceItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ADMIN */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 text-xs uppercase tracking-wider">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItems(adminItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* PLATFORM ADMIN (conditional) */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70 text-xs uppercase tracking-wider">
              Platform
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/admin')}>
                    <Link to="/admin" className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/migrate')}>
                    <Link to="/migrate" className="flex items-center gap-3">
                      <ArrowRight className="h-4 w-4" />
                      <span>Migration</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.email || 'User'}
                </span>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
