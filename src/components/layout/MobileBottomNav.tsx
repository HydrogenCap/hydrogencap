import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Shield,
  FolderOpen,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import { flattenNav, type NavItem } from './navConfig';

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

/** Primary bottom-bar destinations (always visible). */
const PRIMARY: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; href: string }> = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Building2, label: 'Properties', href: '/properties-v2' },
  { icon: Shield, label: 'Compliance', href: '/compliance-v2' },
  { icon: FolderOpen, label: 'Documents', href: '/documents' },
];

const PRIMARY_HREFS = new Set(PRIMARY.map(p => p.href));
// Routes that don't make sense in mobile More drawer
const HIDE_FROM_DRAWER = new Set<string>([]);

export function MobileBottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { isVisible } = useSectionVisibility();

  const isActive = (href: string) =>
    location.pathname === href ||
    (href !== '/dashboard' && location.pathname.startsWith(href));

  // Derive More-drawer items from the shared nav config, minus the primary bar
  // and anything hidden by section visibility.
  const drawerItems: NavItem[] = flattenNav()
    .filter(item => !PRIMARY_HREFS.has(item.href))
    .filter(item => !HIDE_FROM_DRAWER.has(item.href))
    .filter(item => !item.sectionKey || isVisible(item.sectionKey));

  return (
    <>
      <nav aria-label="Mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {PRIMARY.map(p => (
            <MobileNavItem
              key={p.href}
              icon={p.icon}
              label={p.label}
              href={p.href}
              isActive={isActive(p.href)}
            />
          ))}
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
              {drawerItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 min-h-[44px] px-4 py-2 rounded-lg text-sm transition-colors',
                    isActive(item.href)
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
