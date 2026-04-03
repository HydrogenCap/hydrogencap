import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrg } from '@/hooks/useUserOrg';

export interface SearchResult {
  result_type: 'property' | 'tenant' | 'entity' | 'contractor' | 'investor';
  result_id: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface GroupedResults {
  property: SearchResult[];
  tenant: SearchResult[];
  entity: SearchResult[];
  contractor: SearchResult[];
  investor: SearchResult[];
}

const RECENT_SEARCHES_KEY = 'tenureiq.recent_searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const recent = getRecentSearches().filter((s) => s !== trimmed);
  recent.unshift(trimmed);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

function groupResults(results: SearchResult[]): GroupedResults {
  const grouped: GroupedResults = {
    property: [],
    tenant: [],
    entity: [],
    contractor: [],
    investor: [],
  };
  for (const result of results) {
    grouped[result.result_type]?.push(result);
  }
  return grouped;
}

export function useGlobalSearch() {
  const { data: orgId } = useUserOrg();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [grouped, setGrouped] = useState<GroupedResults>(groupResults([]));
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  const search = useCallback(
    async (searchQuery: string) => {
      if (!orgId || !searchQuery.trim()) {
        setResults([]);
        setGrouped(groupResults([]));
        setIsLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      try {
        const { data, error } = await (supabase as any).rpc('global_search', {
          search_query: searchQuery.trim(),
          p_org_id: orgId,
        });

        if (controller.signal.aborted) return;

        if (error) {
          console.error('Global search error:', error);
          setResults([]);
          setGrouped(groupResults([]));
        } else {
          const items = (data ?? []) as SearchResult[];
          setResults(items);
          setGrouped(groupResults(items));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Global search failed:', err);
          setResults([]);
          setGrouped(groupResults([]));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [orgId]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setGrouped(groupResults([]));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const recordSearch = useCallback((q: string) => {
    saveRecentSearch(q);
    setRecentSearches(getRecentSearches());
  }, []);

  const clearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  return {
    query,
    setQuery,
    results,
    grouped,
    isLoading,
    recentSearches,
    recordSearch,
    clearRecent,
  };
}
