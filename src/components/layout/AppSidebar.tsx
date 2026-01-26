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
  ChevronDown,
} from 'lucide-react';
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
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useInboxDocuments } from '@/hooks/useDocuments';
import { useAllCompliance } from '@/hooks/useCompliance';
import { getComplianceItemStatus } from '@/lib/complianceTypes';
import logoImage from '@/assets/logo.png';

const mainNavItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { title: 'Portfolio', icon: Building2, href: '/properties' },
  { title: 'Companies', icon: Briefcase, href: '/companies' },
  { title: 'Insights', icon: TrendingUp, href: '/insights' },
  { title: 'Settings', icon: Settings, href: '/settings' },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { data: inboxDocuments } = useInboxDocuments();
  const { data: allCompliance } = useAllCompliance();

  // Count pending documents
  const pendingCount = inboxDocuments?.filter(
    d => d.review_status === 'pending' && d.extraction_status === 'completed'
  ).length || 0;

  // Count compliance alerts
  const expiredCount = allCompliance?.filter(
    c => getComplianceItemStatus(c.expiry_date) === 'expired'
  ).length || 0;

  const expiringCount = allCompliance?.filter(
    c => getComplianceItemStatus(c.expiry_date) === 'expiring_soon'
  ).length || 0;

  const complianceAlertCount = expiredCount + expiringCount;

  // Check if any compliance route is active
  const isComplianceActive = location.pathname === '/compliance' || location.pathname === '/inbox';

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/dashboard" className="flex items-center justify-center">
          <img src={logoImage} alt="Hydrogen Capital" className="h-32 w-32 rounded-lg object-cover" />
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 text-xs uppercase tracking-wider">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const isActive = location.pathname === item.href || 
                  (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.href} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Compliance Section with Submenu */}
              <Collapsible defaultOpen={isComplianceActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isComplianceActive}>
                      <Shield className="h-4 w-4" />
                      <span className="flex-1">Compliance</span>
                      {(complianceAlertCount > 0 || pendingCount > 0) && (
                        <Badge 
                          variant={expiredCount > 0 ? "destructive" : "secondary"} 
                          className="h-5 min-w-5 px-1.5 text-xs mr-1"
                        >
                          {complianceAlertCount + pendingCount}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton 
                          asChild 
                          isActive={location.pathname === '/compliance'}
                        >
                          <Link to="/compliance">
                            <span>Register</span>
                            {complianceAlertCount > 0 && (
                              <Badge 
                                variant={expiredCount > 0 ? "destructive" : "secondary"} 
                                className="h-5 min-w-5 px-1.5 text-xs ml-auto"
                              >
                                {complianceAlertCount}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton 
                          asChild 
                          isActive={location.pathname === '/inbox'}
                        >
                          <Link to="/inbox">
                            <Inbox className="h-3 w-3" />
                            <span>Inbox</span>
                            {pendingCount > 0 && (
                              <Badge 
                                variant="secondary" 
                                className="h-5 min-w-5 px-1.5 text-xs ml-auto"
                              >
                                {pendingCount}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.email || 'User'}
              </span>
            </div>
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