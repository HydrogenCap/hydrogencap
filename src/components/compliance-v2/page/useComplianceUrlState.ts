import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useState, useCallback } from 'react';

const VALID_FILTERS = ['needs_attention', 'all', 'expired', 'missing', 'valid'];

/**
 * URL-synced filter/view state for the Compliance V2 page.
 */
export function useComplianceUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlStatus = searchParams.get('status');
  const urlView = searchParams.get('view');
  const urlSearch = searchParams.get('q') ?? '';

  const [statusFilter, setStatusFilterState] = useState(
    urlStatus && VALID_FILTERS.includes(urlStatus) ? urlStatus : 'needs_attention',
  );
  const [searchQuery, setSearchQueryState] = useState(urlSearch);
  const [viewMode, setViewModeState] = useState<'matrix' | 'calendar'>(urlView === 'calendar' ? 'calendar' : 'matrix');
  const [propertyType, setPropertyTypeState] = useState<string>(searchParams.get('type') || 'all');
  const [monthFocus, setMonthFocusState] = useState<boolean>(searchParams.get('focus') === 'month');

  const updateUrl = useCallback((next: Record<string, string | null>) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(next)) {
        if (
          v === null || v === '' || v === 'needs_attention' ||
          (k === 'view' && v === 'matrix') ||
          (k === 'type' && v === 'all') ||
          (k === 'focus' && v !== 'month')
        ) {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const setStatusFilter = (v: string) => { setStatusFilterState(v); updateUrl({ status: v }); };
  const setSearchQuery = (v: string) => { setSearchQueryState(v); updateUrl({ q: v }); };
  const setViewMode = (v: 'matrix' | 'calendar') => { setViewModeState(v); updateUrl({ view: v }); };
  const setPropertyType = (v: string) => { setPropertyTypeState(v); updateUrl({ type: v }); };
  const setMonthFocus = (v: boolean) => { setMonthFocusState(v); updateUrl({ focus: v ? 'month' : null }); };

  const filtersActive = useMemo(
    () => statusFilter !== 'needs_attention' || searchQuery !== '' || propertyType !== 'all' || monthFocus,
    [statusFilter, searchQuery, propertyType, monthFocus],
  );

  const clearFilters = useCallback(() => {
    setStatusFilter('needs_attention');
    setSearchQuery('');
    setPropertyType('all');
    setMonthFocus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    statusFilter, setStatusFilter,
    searchQuery, setSearchQuery,
    viewMode, setViewMode,
    propertyType, setPropertyType,
    monthFocus, setMonthFocus,
    filtersActive,
    clearFilters,
  };
}
