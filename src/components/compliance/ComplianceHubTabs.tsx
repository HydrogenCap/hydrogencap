import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid, Grid3X3, CalendarCheck, RefreshCw, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useComplianceMatrix } from '@/hooks/useComplianceV2';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';

interface TabDef {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: (counts: ReturnType<typeof useTabCounts>) => number | null;
  match?: (pathname: string) => boolean;
}

function useTabCounts() {
  const { data: matrix } = useComplianceMatrix();
  return useMemo(() => {
    if (!matrix) return { today: 0, register: 0 };
    const today = matrix.filter(r =>
      r.is_required && ['critical', 'expired', 'missing', 'expiring_soon'].includes(r.calculated_status),
    ).length;
    return { today, register: matrix.length };
  }, [matrix]);
}

const TABS: TabDef[] = [
  {
    to: '/compliance',
    label: 'Today',
    icon: LayoutGrid,
    badge: (c) => c.today || null,
    match: (p) => p === '/compliance' || p === '/compliance-actions',
  },
  { to: '/compliance-v2', label: 'Register', icon: Grid3X3 },
  { to: '/compliance-calendar', label: 'Calendar', icon: CalendarCheck },
  { to: '/compliance-tasks', label: 'Renewals', icon: RefreshCw },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
];

/**
 * Unified tab strip shown at the top of every compliance surface so the four
 * pages (Today / Register / Calendar / Renewals) feel like one workspace.
 */
export function ComplianceHubTabs({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const counts = useTabCounts();
  return (
    <nav
      aria-label="Compliance views"
      className={cn(
        'flex items-center gap-1 overflow-x-auto border-b border-border -mx-1 px-1 print:hidden',
        className,
      )}
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = t.match ? t.match(pathname) : pathname === t.to;
        const badge = t.badge?.(counts);
        return (
          <NavLink
            key={t.to}
            to={t.to}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
            {badge ? (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">
                {badge > 99 ? '99+' : badge}
              </Badge>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
