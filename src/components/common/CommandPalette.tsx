import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Banknote,
  Users,
  Briefcase,
  Coins,
  FileText,
  Calendar,
  Wrench,
  Inbox,
  Sparkles,
  Settings,
  Search,
  ArrowRight,
  Map,
  TrendingUp,
  PiggyBank,
  Plus,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch';
import { useRecentlyViewed, type RecentEntityType } from '@/hooks/useRecentlyViewed';

interface NavCommand {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  keywords?: string[];
}

const NAVIGATE_COMMANDS: NavCommand[] = [
  { id: 'nav-dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, hint: 'g d' },
  { id: 'nav-properties', label: 'Properties', href: '/properties', icon: Building2, hint: 'g p' },
  { id: 'nav-tenants', label: 'Tenants', href: '/tenants', icon: Users, hint: 'g t' },
  { id: 'nav-compliance', label: 'Compliance', href: '/compliance', icon: ShieldCheck, hint: 'g c' },
  { id: 'nav-rent', label: 'Rent reconciliation', href: '/rent-reconciliation', icon: Banknote, hint: 'g r' },
  { id: 'nav-lending', label: 'Lending', href: '/lending', icon: PiggyBank, hint: 'g l' },
  { id: 'nav-insights', label: 'Insights', href: '/insights', icon: Sparkles, hint: 'g i' },
  { id: 'nav-entities', label: 'Legal entities', href: '/entities', icon: Briefcase },
  { id: 'nav-ownership', label: 'Ownership', href: '/ownership', icon: Coins },
  { id: 'nav-documents', label: 'Documents', href: '/documents', icon: FileText },
  { id: 'nav-calendar', label: 'Compliance calendar', href: '/compliance-calendar', icon: Calendar },
  { id: 'nav-jobs', label: 'Jobs & works orders', href: '/jobs-works', icon: Wrench },
  { id: 'nav-inbox', label: 'Inbox', href: '/inbox', icon: Inbox },
  { id: 'nav-map', label: 'Portfolio map', href: '/dashboard-map', icon: Map },
  { id: 'nav-reports', label: 'Reports', href: '/reports', icon: FileText },
  { id: 'nav-refi', label: 'Refinancing opportunities', href: '/refinancing-opportunities', icon: TrendingUp },
  { id: 'nav-settings', label: 'Settings', href: '/settings', icon: Settings },
];

const CREATE_COMMANDS: NavCommand[] = [
  { id: 'new-property', label: 'Add property', href: '/properties/new', icon: Plus, keywords: ['create', 'new'] },
  { id: 'new-entity', label: 'Add legal entity', href: '/entities/new', icon: Plus, keywords: ['create', 'spv'] },
  { id: 'new-compliance', label: 'Add compliance record', href: '/compliance?action=add', icon: Plus, keywords: ['certificate'] },
];

const RECENT_KEY = 'cmdk.recent.v1';

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    const existing = readRecent().filter((r) => r !== id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...existing].slice(0, 5)));
  } catch {
    /* ignore */
  }
}

const RESULT_ICON: Record<SearchResult['result_type'], React.ComponentType<{ className?: string }>> = {
  property: Building2,
  tenant: Users,
  entity: Briefcase,
  contractor: Wrench,
  investor: Coins,
};

const RECENT_ENTITY_ICON: Record<RecentEntityType, React.ComponentType<{ className?: string }>> = {
  property: Building2,
  tenant: Users,
  entity: Briefcase,
  job: Wrench,
  workorder: Wrench,
  investor: Coins,
  capex: TrendingUp,
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { query, setQuery, grouped, isLoading, recordSearch } = useGlobalSearch();
  const recentEntities = useRecentlyViewed(6);
  const [recent, setRecent] = useState<string[]>(() => readRecent());

  // Open with ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Listen for external open events (e.g. shortcut handler, button)
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('cmdk:open', onOpen);
    return () => window.removeEventListener('cmdk:open', onOpen);
  }, []);

  // Reset query on close, refresh recents on open
  useEffect(() => {
    if (!open) {
      setQuery('');
    } else {
      setRecent(readRecent());
    }
  }, [open, setQuery]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const allNav = useMemo(() => [...NAVIGATE_COMMANDS, ...CREATE_COMMANDS], []);

  const runNav = useCallback(
    (cmd: NavCommand) => {
      pushRecent(cmd.id);
      setRecent(readRecent());
      navigate(cmd.href);
      setOpen(false);
    },
    [navigate],
  );

  const runResult = useCallback(
    (r: SearchResult) => {
      if (query.trim()) recordSearch(query.trim());
      navigate(r.url);
      setOpen(false);
    },
    [navigate, query, recordSearch],
  );

  const recentNav = recent
    .map((id) => allNav.find((n) => n.id === id))
    .filter((n): n is NavCommand => Boolean(n));

  const hasSearchResults =
    grouped.property.length +
      grouped.tenant.length +
      grouped.entity.length +
      grouped.contractor.length +
      grouped.investor.length >
    0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search properties, tenants, entities… or jump to a page"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? 'Searching…' : query.trim() ? 'No matches found.' : 'Start typing to search.'}
        </CommandEmpty>

        {/* Live search results */}
        {hasSearchResults && (
          <>
            {(['property', 'tenant', 'entity', 'contractor', 'investor'] as const).map((type) => {
              const items = grouped[type];
              if (items.length === 0) return null;
              const Icon = RESULT_ICON[type];
              const heading = type.charAt(0).toUpperCase() + type.slice(1) + 's';
              return (
                <CommandGroup key={type} heading={heading}>
                  {items.slice(0, 5).map((r) => (
                    <CommandItem
                      key={`${type}-${r.result_id}`}
                      value={`${type} ${r.title} ${r.subtitle}`}
                      onSelect={() => runResult(r)}
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{r.title}</span>
                        {r.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">{r.subtitle}</span>
                        )}
                      </div>
                      <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            <CommandSeparator />
          </>
        )}

        {/* Recently used commands when not searching */}
        {!query && recentNav.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentNav.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem key={`recent-${cmd.id}`} value={`recent ${cmd.label}`} onSelect={() => runNav(cmd)}>
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {cmd.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Go to">
          {NAVIGATE_COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <CommandItem
                key={cmd.id}
                value={`go ${cmd.label} ${(cmd.keywords ?? []).join(' ')}`}
                onSelect={() => runNav(cmd)}
              >
                <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {cmd.label}
                {cmd.hint && <CommandShortcut>{cmd.hint}</CommandShortcut>}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Create">
          {CREATE_COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <CommandItem
                key={cmd.id}
                value={`create ${cmd.label} ${(cmd.keywords ?? []).join(' ')}`}
                onSelect={() => runNav(cmd)}
              >
                <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {cmd.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Help">
          <CommandItem
            value="help shortcuts keyboard"
            onSelect={() => {
              setOpen(false);
              window.dispatchEvent(new Event('shortcuts:open'));
            }}
          >
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            View keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
