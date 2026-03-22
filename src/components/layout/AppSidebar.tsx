import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from '@/components/ui/sidebar';
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

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badgeType?: 'actions' | 'jobs' | 'compliance' | 'inbox' | 'tasks' | 'tenancy_events';
  sectionKey?: SectionKey;
}

const portfolioItems: NavItem[] = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { title: 'Properties', icon: Building2, href: '/properties-v2' },
  { title: 'Pipeline', icon: Construction, href: '/pipeline' },
  { title: 'Entities', icon: Briefcase, href: '/entities' },
  { title: 'Ownership', icon: Users, href: '/ownership' },
  { title: 'Documents', icon: FolderOpen, href: '/documents' },
];

const operationsItems: NavItem[] = [
  { title: 'Actions', icon: AlertTriangle, href: '/actions', badgeType: 'actions' },
  { title: 'Compliance', icon: Shield, href: '/compliance-v2', badgeType: 'compliance' },
  { title: 'Tasks', icon: ClipboardList, href: '/compliance-tasks', badgeType: 'tasks' },
  { title: 'Inbox', icon: Inbox, href: '/inbox', badgeType: 'inbox' },
  { title: 'Calendar', icon: CalendarCheck, href: '/compliance-calendar' },
  { title: 'Lending', icon: PoundSterling, href: '/lending', sectionKey: 'lending' },
  { title: 'Financials', icon: TrendingUp, href: '/financials' },
  { title: 'Investors', icon: Briefcase, href: '/investors', sectionKey: 'investors' },
  { title: 'Distributions', icon: Banknote, href: '/distributions', sectionKey: 'distributions' },
  { title: 'Accounting', icon: PoundSterling, href: '/accounting' },
  { title: 'Contractors', icon: HardHat, href: '/contractors' },
  { title: 'Jobs & Works', icon: Wrench, href: '/jobs-and-works', badgeType: 'jobs', sectionKey: 'jobs' },
  { title: 'Tenants', icon: Users, href: '/tenants-v2', badgeType: 'tenancy_events' },
  { title: 'Rent', icon: PoundSterling, href: '/rent' },
  { title: 'Voids', icon: DoorOpen, href: '/voids', sectionKey: 'voids' },
  { title: 'Lettings', icon: ArrowRight, href: '/lettings' },
  { title: 'CapEx', icon: HardHat, href: '/capex', sectionKey: 'capex' },
  { title: 'Templates', icon: FileSignature, href: '/templates' },
  { title: 'Bulk Upload', icon: FolderUp, href: '/bulk-upload' },
];

const intelligenceItems: NavItem[] = [
  { title: 'Insights', icon: TrendingUp, href: '/insights' },
  { title: 'Reports', icon: FileText, href: '/reports' },
  { title: 'Tax', icon: Receipt, href: '/tax' },
  { title: 'Timeline', icon: History, href: '/timeline' },
  { title: 'Chat', icon: MessageSquare, href: '/chat' },
];

const adminItems: NavItem[] = [
  { title: 'Audit Log', icon: ScrollText, href: '/audit-log' },
  { title: 'Import', icon: Upload, href: '/import' },
  { title: 'Passport', icon: ClipboardList, href: '/passport' },
  { title: 'Missing Info', icon: AlertCircle, href: '/missing-info' },
  { title: 'Settings', icon: Settings, href: '/settings' },
];

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

  const renderNavItems = (items: NavItem[]) => (
    <>
      {items
        .filter((item) => !item.sectionKey || isVisible(item.sectionKey))
        .map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={isActive(item.href)}>
            <Link to={item.href} className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.title}</span>
              {renderBadge(item)}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <LogoWordmark to="/dashboard" size="lg" />
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
