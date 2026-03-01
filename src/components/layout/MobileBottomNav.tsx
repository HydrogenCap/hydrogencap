import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Shield, Wrench, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

interface MobileNavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
}

function MobileNavItem({ icon: Icon, label, href, onClick, isActive }: MobileNavItemProps) {
  const classes = cn(
    'flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-1 text-muted-foreground transition-colors',
    isActive && 'text-primary'
  );

  if (href) {
    return (
      <Link to={href} className={classes}>
        <Icon className="h-5 w-5" />
        <span className="text-[10px] font-medium">{label}</span>
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={classes}>
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export function MobileBottomNav() {
  const location = useLocation();
  const { toggleSidebar } = useSidebar();

  const isActive = (href: string) =>
    location.pathname === href ||
    (href !== '/dashboard' && location.pathname.startsWith(href));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around h-14">
        <MobileNavItem icon={LayoutDashboard} label="Home" href="/dashboard" isActive={isActive('/dashboard')} />
        <MobileNavItem icon={Building2} label="Properties" href="/properties-v2" isActive={isActive('/properties-v2')} />
        <MobileNavItem icon={Shield} label="Compliance" href="/compliance-v2" isActive={isActive('/compliance-v2')} />
        <MobileNavItem icon={Wrench} label="Maintenance" href="/maintenance" isActive={isActive('/maintenance')} />
        <MobileNavItem icon={Menu} label="More" onClick={toggleSidebar} />
      </div>
    </nav>
  );
}
