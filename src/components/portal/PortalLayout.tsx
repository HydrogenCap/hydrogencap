import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, LayoutDashboard, Shield, LogOut, User, Wallet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useShareholderSession } from '@/hooks/useShareholderSession';
import { usePortalInvestorData } from '@/hooks/usePortalInvestorData';
import logo from '@/assets/logo.png';

interface PortalLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/portal', icon: LayoutDashboard, label: 'Overview', permission: 'shareholder_only' },
  { path: '/portal/properties', icon: Building2, label: 'Properties', permission: 'shareholder_only' },
  { path: '/portal/compliance', icon: Shield, label: 'Compliance', permission: 'can_view_compliance' },
  { path: '/portal/investments', icon: Wallet, label: 'Investments', permission: 'investor_only' },
  { path: '/portal/statements', icon: FileText, label: 'Statements', permission: 'investor_only' },
];

export function PortalLayout({ children }: PortalLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isShareholderUser, canViewCompliance } = useShareholderSession();
  const { isInvestorUser } = usePortalInvestorData();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const filteredNav = navItems.filter((item) => {
    if (item.permission === 'shareholder_only') return isShareholderUser;
    if (item.permission === 'can_view_compliance') return canViewCompliance;
    if (item.permission === 'investor_only') return isInvestorUser;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-8 w-8" />
            <div>
              <span className="font-semibold">Portal Access</span>
              <span className="ml-2 text-xs text-muted-foreground">Read-only access</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-muted/30">
        <div className="container">
          <div className="flex gap-1">
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                    'border-b-2 -mb-[1px]',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-6">{children}</main>
    </div>
  );
}
