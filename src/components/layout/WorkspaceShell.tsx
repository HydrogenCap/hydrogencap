import { Suspense, type ComponentType } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/common';

export interface WorkspaceTab {
  /** ?view= value */
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Lazy/regular component to render when active */
  Component: ComponentType;
}

interface WorkspaceShellProps {
  /** Unique aria-label for the tab strip */
  label: string;
  tabs: WorkspaceTab[];
  /** Fallback tab if ?view= is missing or unknown */
  defaultKey?: string;
}

/**
 * Generic workspace shell used to consolidate previously-separate collection
 * pages into a single tabbed surface. Each tab's `key` is reflected in the
 * `?view=` query param so deep links and back/forward navigation work.
 *
 * Modelled after the pattern proven by ComplianceHubTabs.
 */
export function WorkspaceShell({ label, tabs, defaultKey }: WorkspaceShellProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('view');
  const activeKey =
    tabs.find((t) => t.key === requested)?.key ??
    defaultKey ??
    tabs[0]?.key;

  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  const setActive = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', key);
    setSearchParams(next, { replace: false });
  };

  if (!active) return null;
  const Active = active.Component;

  return (
    <div className="space-y-4">
      <nav
        aria-label={label}
        className="flex items-center gap-1 overflow-x-auto border-b border-border -mx-1 px-1 print:hidden"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === active.key;
          return (
            <NavLink
              key={t.key}
              to={`?view=${t.key}`}
              onClick={(e) => {
                e.preventDefault();
                setActive(t.key);
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </NavLink>
          );
        })}
      </nav>

      <Suspense fallback={<LoadingState text="Loading..." />}>
        <Active />
      </Suspense>
    </div>
  );
}
