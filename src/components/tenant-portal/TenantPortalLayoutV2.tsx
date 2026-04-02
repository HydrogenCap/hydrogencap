import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, PoundSterling, Wrench, ShieldCheck, LogOut, User, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import logo from '@/assets/logo.png';
import { useState } from 'react';

interface TenantPortalLayoutV2Props {
  children: ReactNode;
  propertyName?: string;
  tenantName?: string;
}

const navItems = [
  { path: '/tenant-portal', icon: Home, label: 'Home', shortLabel: 'Home', permission: null },
  { path: '/tenant-portal/payments', icon: PoundSterling, label: 'Payments', shortLabel: 'Pay', permission: 'rent' as const },
  { path: '/tenant-portal/maintenance', icon: Wrench, label: 'Maintenance', shortLabel: 'Repairs', permission: 'maintenance' as const },
  { path: '/tenant-portal/certificates', icon: ShieldCheck, label: 'Certificates', shortLabel: 'Certs', permission: 'certificates' as const },
];

export function TenantPortalLayoutV2({ children, propertyName, tenantName }: TenantPortalLayoutV2Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { canViewRent, canSubmitMaintenance } = useTenantPortalSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const filteredNav = navItems.filter(item => {
    if (!item.permission) return true;
    if (item.permission === 'rent') return canViewRent;
    if (item.permission === 'maintenance') return canSubmitMaintenance;
    if (item.permission === 'certificates') return true; // certificates visible by default
    return true;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-7 w-7" />
            <div className="flex flex-col">
              <span className="font-semibold text-sm leading-tight">
                {propertyName || 'Tenant Portal'}
              </span>
              {tenantName && (
                <span className="text-xs text-muted-foreground leading-tight">{tenantName}</span>
              )}
            </div>
          </div>

          {/* Desktop user menu */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Sign Out
            </Button>
          </div>

          {/* Mobile menu toggle */}
          <div className="flex sm:hidden items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t bg-card p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
              <User className="h-4 w-4" />
              <span className="truncate">{user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        )}

        {/* Desktop tab navigation */}
        <nav className="hidden sm:block border-t bg-muted/20">
          <div className="container">
            <div className="flex gap-1">
              {filteredNav.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
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
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-4 sm:py-6 pb-20 sm:pb-6">{children}</main>

      {/* Mobile bottom navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 safe-area-bottom">
        <div className="flex justify-around py-1.5">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-medium transition-colors min-w-0',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
