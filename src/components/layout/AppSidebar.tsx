import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, ShieldCheck, ArrowRight, LogOut } from 'lucide-react';
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
import { useArrears } from '@/hooks/useRentCollection';

import { usePortfolioRisks } from '@/hooks/usePortfolioRisks';
import { useJobCounts } from '@/hooks/useContractorJobs';
import { useComplianceTaskStats } from '@/hooks/useComplianceTasks';
import { useTenancyEventCounts } from '@/hooks/useTenancyEvents';
import { useExpiringLoanCount } from '@/hooks/useExpiringLoanCount';
import { useIsAdmin } from '@/hooks/usePlatformAdmin';
import { LogoWordmark } from '@/components/LogoWordmark';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import { OrganizationSwitcher } from './OrganizationSwitcher';
import {
  type NavItem,
  portfolioItems,
  operationsItems,
  intelligenceItems,
  adminItems,
} from './navConfig';

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
  const { data: arrearsData } = useArrears();
  const arrearsCount = arrearsData?.length ?? 0;
  const refinancingCount = useExpiringLoanCount();

  const urgentJobsCount = (jobCounts?.urgent || 0) + (jobCounts?.high || 0);


  const pendingCount = inboxDocuments?.filter(
    d => d.review_status === 'pending'
  ).length || 0;

  const complianceAlertCount = complianceStats.expired + complianceStats.expiring;
  const expiredCount = complianceStats.expired;

  const isActive = useCallback((href: string) =>
    location.pathname === href ||
    (href !== '/dashboard' && location.pathname.startsWith(href)),
  [location.pathname]);

  const hasActiveChild = useCallback((item: NavItem): boolean => {
    if (!item.children) return false;
    return item.children.some(child => isActive(child.href) || hasActiveChild(child));
  }, [isActive]);

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
    setExpandedItems(prev => {
      let changed = false;
      const updated = { ...prev };
      for (const item of allItems) {
        if (item.children && hasActiveChild(item) && !updated[item.title]) {
          updated[item.title] = true;
          changed = true;
        }
      }
      if (changed) {
        saveExpandedState(updated);
        return updated;
      }
      return prev;
    });
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
          aria-label={`${actionsCount} actions requiring attention`}
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
          aria-label={`${complianceAlertCount} compliance alerts`}
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
          aria-label={`${pendingCount} pending inbox items`}
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
          aria-label={`${urgentJobsCount} urgent jobs`}
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
          aria-label={`${taskStats.overdueCount} overdue tasks`}
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
          aria-label={`${tenancyUrgentCount} urgent tenancy events`}
        >
          {tenancyUrgentCount}
        </Badge>
      );
    }
    if (item.badgeType === 'arrears' && arrearsCount > 0) {
      return (
        <Badge
          variant="destructive"
          className="h-5 min-w-5 px-1.5 text-xs"
          aria-label={`${arrearsCount} tenancies in arrears`}
        >
          {arrearsCount}
        </Badge>
      );
    }
    if (item.badgeType === 'refinancing' && refinancingCount > 0) {
      return (
        <Badge
          variant="secondary"
          className="h-5 min-w-5 px-1.5 text-xs border-amber-500/40 text-amber-700"
          aria-label={`${refinancingCount} loans approaching rate expiry`}
        >
          {refinancingCount}
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
            <Link to={item.href} className="flex items-center gap-3" aria-current={isActive(item.href) ? 'page' : undefined}>
              <item.icon className="h-4 w-4" aria-hidden="true" />
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
            <Link to={item.href} className="flex items-center gap-3" aria-current={isActive(item.href) ? 'page' : undefined}>
              <item.icon className="h-4 w-4" aria-hidden="true" />
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
              <Link to={item.href} className="flex items-center gap-3" aria-current={isActive(item.href) ? 'page' : undefined}>
                <item.icon className="h-4 w-4" aria-hidden="true" />
                <span className="flex-1">{item.title}</span>
                {renderBadge(item)}
              </Link>
            </SidebarMenuButton>
            <CollapsibleTrigger asChild>
              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.title}`}
                aria-expanded={isOpen}
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
                    <Link to={child.href} className="flex items-center gap-2" aria-current={isActive(child.href) ? 'page' : undefined}>
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
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
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
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
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
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
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
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
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
            <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
              Platform
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/admin')}>
                    <Link to="/admin" className="flex items-center gap-3" aria-current={isActive('/admin') ? 'page' : undefined}>
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive('/migrate')}>
                    <Link to="/migrate" className="flex items-center gap-3" aria-current={isActive('/migrate') ? 'page' : undefined}>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
