import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, PoundSterling, Wrench, FileText, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import logo from '@/assets/logo.png';

interface TenantPortalLayoutProps {
  children: ReactNode;
}

export function TenantPortalLayout({ children }: TenantPortalLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { canViewRent, canViewDocuments, canSubmitMaintenance } = useTenantPortalSession();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = [
    { path: '/tenant-portal', icon: Home, label: 'Home', show: true },
    { path: '/tenant-portal/rent', icon: PoundSterling, label: 'Rent History', show: canViewRent },
    { path: '/tenant-portal/maintenance', icon: Wrench, label: 'Maintenance', show: canSubmitMaintenance },
    { path: '/tenant-portal/documents', icon: FileText, label: 'Documents', show: canViewDocuments },
  ].filter(item => item.show);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-8 w-8" />
            <div>
              <span className="font-semibold">Tenant Portal</span>
              <span className="ml-2 text-xs text-muted-foreground">Self-service</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user?.email}</span>
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
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
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
