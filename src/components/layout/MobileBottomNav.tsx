import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  FolderOpen,
  MoreHorizontal,
  Shield,
  Wrench,
  Wallet,
  Activity,
  FileText,
  MessageSquare,
  Settings,
  Upload,
  Users,
  Construction,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface MobileNavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
}

function MobileNavItem({ icon: Icon, label, href, onClick, isActive }: MobileNavItemProps) {
  const classes = cn(
    'flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-1 text-muted-foreground transition-colors relative',
    isActive && 'text-primary'
  );

  const indicator = isActive && (
    <span className="absolute top-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
  );

  if (href) {
    return (
      <Link to={href} className={classes} aria-current={isActive ? 'page' : undefined}>
        {indicator}
        <Icon className="h-5 w-5" aria-hidden="true" />
        <span className="text-[10px] font-medium leading-tight">{label}</span>
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={classes} aria-label={label}>
      {indicator}
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </button>
  );
}

interface MoreDrawerItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  isActive: boolean;
  onClose: () => void;
}

function MoreDrawerItem({ icon: Icon, label, href, isActive, onClose }: MoreDrawerItemProps) {
  return (
    <Link
      to={href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 min-h-[44px] px-4 py-2 rounded-lg text-sm transition-colors',
        isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

const moreItems = [
  { icon: Shield, label: 'Compliance', href: '/compliance-v2' },
  { icon: Wrench, label: 'Jobs & Works', href: '/jobs-and-works' },
  { icon: Users, label: 'Tenants', href: '/tenants-v2' },
  { icon: Wallet, label: 'Finance', href: '/financials' },
  { icon: Construction, label: 'Pipeline', href: '/pipeline' },
  { icon: Activity, label: 'Insights', href: '/insights' },
  { icon: FileText, label: 'Reports', href: '/reports' },
  { icon: MessageSquare, label: 'Chat', href: '/chat' },
  { icon: Upload, label: 'Import', href: '/import' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export function MobileBottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    location.pathname === href ||
    (href !== '/dashboard' && location.pathname.startsWith(href));

  return (
    <>
      <nav aria-label="Mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          <MobileNavItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" isActive={isActive('/dashboard')} />
          <MobileNavItem icon={Building2} label="Properties" href="/properties-v2" isActive={isActive('/properties-v2')} />
          <MobileNavItem icon={Shield} label="Compliance" href="/compliance-v2" isActive={isActive('/compliance-v2')} />
          <MobileNavItem icon={FolderOpen} label="Documents" href="/documents" isActive={isActive('/documents')} />
          <MobileNavItem icon={MoreHorizontal} label="More" onClick={() => setMoreOpen(true)} />
        </div>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Navigation</DrawerTitle>
          </DrawerHeader>
          <div className="px-2 pb-6 max-h-[60vh] overflow-y-auto">
            <div className="space-y-0.5">
              {moreItems.map((item) => (
                <MoreDrawerItem
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  isActive={isActive(item.href)}
                  onClose={() => setMoreOpen(false)}
                />
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
