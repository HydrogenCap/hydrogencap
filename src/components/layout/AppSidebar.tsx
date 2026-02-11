import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Briefcase,
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
  History,
  CalendarCheck,
  AlertTriangle,
  HardHat,
  Users,
  PoundSterling,
  Wrench,
  Upload,
} from 'lucide-react';
import { usePortfolioComplianceRequirements } from '@/hooks/useComplianceRequirements';
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
import logoImage from '@/assets/logo.png';

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badgeType?: 'actions' | 'jobs' | 'compliance' | 'inbox';
}

const portfolioItems: NavItem[] = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { title: 'Properties', icon: Building2, href: '/properties' },
  { title: 'Pipeline', icon: Construction, href: '/pipeline' },
  { title: 'Companies', icon: Briefcase, href: '/companies' },
  { title: 'Ownership', icon: Users, href: '/ownership' },
];

const operationsItems: NavItem[] = [
  { title: 'Actions', icon: AlertTriangle, href: '/actions', badgeType: 'actions' },
  { title: 'Compliance', icon: Shield, href: '/compliance', badgeType: 'compliance' },
  { title: 'Inbox', icon: Inbox, href: '/inbox', badgeType: 'inbox' },
  { title: 'Calendar', icon: CalendarCheck, href: '/compliance-calendar' },
  { title: 'Contractors', icon: HardHat, href: '/contractors' },
  { title: 'Jobs', icon: ClipboardList, href: '/jobs', badgeType: 'jobs' },
  { title: 'Tenants', icon: Users, href: '/tenants' },
  { title: 'Rent', icon: PoundSterling, href: '/rent' },
  { title: 'Maintenance', icon: Wrench, href: '/maintenance' },
];

const intelligenceItems: NavItem[] = [
  { title: 'Insights', icon: TrendingUp, href: '/insights' },
  { title: 'Reports', icon: FileText, href: '/reports' },
  { title: 'Timeline', icon: History, href: '/timeline' },
  { title: 'Chat', icon: MessageSquare, href: '/chat' },
];

const adminItems: NavItem[] = [
  { title: 'Import', icon: Upload, href: '/import' },
  { title: 'Passport', icon: ClipboardList, href: '/passport' },
  { title: 'Missing Info', icon: AlertCircle, href: '/missing-info' },
  { title: 'Settings', icon: Settings, href: '/settings' },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { data: inboxDocuments } = useInboxDocuments();
  const { stats: complianceStats } = usePortfolioComplianceRequirements();
  const { totalCount: actionsCount, criticalCount: actionsCriticalCount } = usePortfolioRisks();
  const { data: jobCounts } = useJobCounts();

  const urgentJobsCount = (jobCounts?.urgent || 0) + (jobCounts?.high || 0);

  const pendingCount = inboxDocuments?.filter(
    d => d.review_status === 'pending' && d.extraction_status === 'completed'
  ).length || 0;

  const expiredCount = complianceStats.totalExpired + complianceStats.totalMissing;
  const expiringCount = complianceStats.totalExpiringSoon;
  const complianceAlertCount = expiredCount + expiringCount;

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
    return null;
  };

  const renderNavItems = (items: NavItem[]) => (
    <>
      {items.map((item) => (
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
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/dashboard" className="flex items-center justify-center">
          <img src={logoImage} alt="Hydrogen Capital" className="h-32 w-32 rounded-lg object-cover" />
        </Link>
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
