import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Building2,
  User,
  Building,
  Wrench,
  Banknote,
  LayoutDashboard,
  Home,
  ClipboardCheck,
  DollarSign,
  Clock,
  Search,
  X,
} from 'lucide-react';
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch';

const RESULT_TYPE_CONFIG = {
  property: { label: 'Properties', icon: Building2 },
  tenant: { label: 'Tenants', icon: User },
  entity: { label: 'Legal Entities', icon: Building },
  contractor: { label: 'Contractors', icon: Wrench },
  investor: { label: 'Investors', icon: Banknote },
} as const;

const QUICK_NAV = [
  { label: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { label: 'Properties', url: '/properties-v2', icon: Building2 },
  { label: 'Tenants', url: '/tenants-v2', icon: User },
  { label: 'Legal Entities', url: '/entities', icon: Building },
  { label: 'Contractors', url: '/contractors', icon: Wrench },
  { label: 'Investors', url: '/investors', icon: Banknote },
  { label: 'Compliance', url: '/compliance-v2', icon: ClipboardCheck },
  { label: 'Financials', url: '/financials', icon: DollarSign },
  { label: 'Actions', url: '/actions', icon: Home },
] as const;

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const {
    query,
    setQuery,
    grouped,
    isLoading,
    recentSearches,
    recordSearch,
    clearRecent,
  } = useGlobalSearch();

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Reset query when closing
  useEffect(() => {
    if (!open) setQuery('');
  }, [open, setQuery]);

  const handleSelect = useCallback(
    (url: string, searchTerm?: string) => {
      if (searchTerm) recordSearch(searchTerm);
      onOpenChange(false);
      navigate(url);
    },
    [navigate, onOpenChange, recordSearch]
  );

  const handleRecentSelect = useCallback(
    (term: string) => {
      setQuery(term);
    },
    [setQuery]
  );

  const hasResults = Object.values(grouped).some((g) => g.length > 0);
  const showEmpty = query.trim().length > 0 && !hasResults && !isLoading;
  const showRecentAndNav = query.trim().length === 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search properties, tenants, entities..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {showEmpty && <CommandEmpty>No results found.</CommandEmpty>}

        {/* Recent searches when input is empty */}
        {showRecentAndNav && recentSearches.length > 0 && (
          <CommandGroup heading="Recent Searches">
            {recentSearches.map((term) => (
              <CommandItem
                key={`recent-${term}`}
                value={`recent:${term}`}
                onSelect={() => handleRecentSelect(term)}
              >
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{term}</span>
              </CommandItem>
            ))}
            <CommandItem
              value="clear-recent"
              onSelect={clearRecent}
              className="text-muted-foreground"
            >
              <X className="mr-2 h-4 w-4" />
              Clear recent searches
            </CommandItem>
          </CommandGroup>
        )}

        {/* Quick navigation when input is empty */}
        {showRecentAndNav && (
          <>
            {recentSearches.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Quick Navigation">
              {QUICK_NAV.map((item) => (
                <CommandItem
                  key={item.url}
                  value={`nav:${item.label}`}
                  onSelect={() => handleSelect(item.url)}
                >
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Search results grouped by type */}
        {!showRecentAndNav &&
          (Object.keys(RESULT_TYPE_CONFIG) as Array<keyof typeof RESULT_TYPE_CONFIG>).map(
            (type) => {
              const items = grouped[type];
              if (!items || items.length === 0) return null;
              const config = RESULT_TYPE_CONFIG[type];
              const Icon = config.icon;

              return (
                <CommandGroup key={type} heading={config.label}>
                  {items.map((result: SearchResult) => (
                    <CommandItem
                      key={result.result_id}
                      value={`${result.result_type}:${result.title} ${result.subtitle}`}
                      onSelect={() => handleSelect(result.url, query)}
                    >
                      <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{result.title}</span>
                        {result.subtitle && (
                          <span className="truncate text-xs text-muted-foreground">
                            {result.subtitle}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            }
          )}

        {/* Loading indicator */}
        {isLoading && query.trim().length > 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Search className="mx-auto mb-2 h-4 w-4 animate-pulse" />
            Searching...
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
