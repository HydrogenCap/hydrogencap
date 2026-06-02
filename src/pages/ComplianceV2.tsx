import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShieldCheck, Search, Grid3X3, CalendarDays, RefreshCw, Download, X, Printer, Info, Rows3, Rows4, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

import { useComplianceMatrix, usePortfolioComplianceScoreV2, useRefreshComplianceStatuses } from '@/hooks/useComplianceV2';
import { useMissingComplianceDiagnostics } from '@/hooks/useMissingComplianceDiagnostics';
import { TenancyChecklistSummaryCard } from '@/components/lettings/TenancyChecklist';
import { ComplianceMatrixGrid } from '@/components/compliance-v2/ComplianceMatrixGrid';
import { ComplianceCalendarView } from '@/components/compliance-v2/ComplianceCalendarView';
import { SavedViewsMenu } from '@/components/common';
import { ComplianceDetailModal } from '@/components/compliance-v2/ComplianceDetailModal';
import { UploadComplianceDocModal } from '@/components/compliance-v2/UploadComplianceDocModal';
import type { ComplianceMatrixRow, ComplianceDocType } from '@/lib/complianceV2Types';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import { SEO } from '@/components/SEO';
import { ComplianceHubTabs } from '@/components/compliance/ComplianceHubTabs';

export default function ComplianceV2() {
  const { data: matrix, isLoading, dataUpdatedAt } = useComplianceMatrix();
  const { data: score } = usePortfolioComplianceScoreV2();
  const refreshStatuses = useRefreshComplianceStatuses();
  const queryClient = useQueryClient();
  const orgIdEarly = matrix?.[0]?.org_id;
  const { data: diagnostics } = useMissingComplianceDiagnostics(orgIdEarly);
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-synced state
  const VALID_FILTERS = ['needs_attention', 'all', 'expired', 'missing', 'valid'];
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
  const [rescanning, setRescanning] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Density: persisted across sessions
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    if (typeof window === 'undefined') return 'comfortable';
    return (localStorage.getItem('compliance-v2-density') as 'comfortable' | 'compact') || 'comfortable';
  });
  useEffect(() => {
    try { localStorage.setItem('compliance-v2-density', density); } catch { /* ignore */ }
  }, [density]);

  // Back-to-top visibility
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  // Detail modal state
  const [selectedRow, setSelectedRow] = useState<ComplianceMatrixRow | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Refresh statuses on mount
  useEffect(() => {
    refreshStatuses.mutate();
  }, [refreshStatuses]);

  // Keyboard shortcuts: "/" focuses search, Escape clears
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && target === searchInputRef.current && searchQuery) {
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);


  const handleRescan = async () => {
    setRescanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('reprocess-vault-documents', { body: {} });
      if (error) throw error;
      const { succeeded = 0, failed = 0, total = 0 } = (data ?? {}) as { succeeded?: number; failed?: number; total?: number };
      if (total === 0) {
        toast.info('No Vault documents need rescanning');
      } else {
        toast.success(`Rescanned ${total} Vault docs — ${succeeded} succeeded, ${failed} failed`);
      }
      await queryClient.invalidateQueries({ queryKey: ['compliance_matrix_v2'] });
      await queryClient.invalidateQueries({ queryKey: ['compliance_matrix_v2_stats'] });
      refreshStatuses.mutate();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Rescan failed';
      toast.error(msg);
    } finally {
      setRescanning(false);
    }
  };

  const handleCellClick = (propertyId: string, docType: ComplianceDocType) => {
    const row = matrix?.find(r => r.property_id === propertyId && r.document_type === docType);
    if (row) setSelectedRow(row);
  };

  // Next expiry
  const nextExpiry = useMemo(() => {
    if (!matrix) return null;
    const upcoming = matrix
      .filter(r => r.is_required && r.days_remaining !== null && r.days_remaining > 0)
      .sort((a, b) => (a.days_remaining || 9999) - (b.days_remaining || 9999));
    return upcoming[0] || null;
  }, [matrix]);

  const orgId = matrix?.[0]?.org_id || '';

  const uniquePropertyCount = useMemo(() => new Set((matrix || []).map(r => r.property_id)).size, [matrix]);
  const propertyTypes = useMemo(() => {
    const set = new Set<string>();
    for (const r of matrix || []) if (r.property_type) set.add(r.property_type);
    return Array.from(set).sort();
  }, [matrix]);
  const filtersActive = statusFilter !== 'needs_attention' || searchQuery !== '' || propertyType !== 'all';

  // Mirror the matrix's row visibility logic so CSV export honors current filters.
  const filteredCsvRows = useMemo(() => {
    if (!matrix) return [];
    const needsAttention = (s: string) => ['expiring_soon', 'critical', 'expired', 'missing'].includes(s);
    return matrix.filter(r => {
      if (!r.is_required) return false;
      if (propertyType !== 'all' && (r.property_type || '').toLowerCase() !== propertyType.toLowerCase()) return false;
      if (searchQuery && !r.property_address.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      switch (statusFilter) {
        case 'needs_attention': return needsAttention(r.calculated_status);
        case 'expired': return r.calculated_status === 'expired';
        case 'missing': return r.calculated_status === 'missing';
        case 'valid': return r.calculated_status === 'valid';
        case 'all':
        default: return true;
      }
    });
  }, [matrix, statusFilter, searchQuery, propertyType]);

  return (
    <AppLayout>
      <SEO title="Compliance Register — TenureIQ" description="Portfolio compliance, traffic-lighted by property and room." />
      <TooltipProvider delayDuration={200}>
      <div className="space-y-6 print:space-y-3">
        <ComplianceHubTabs />
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              Compliance Dashboard
            </h1>
            <p className="text-muted-foreground">
              {uniquePropertyCount > 0
                ? `${uniquePropertyCount} ${uniquePropertyCount === 1 ? 'property' : 'properties'} · Portfolio-wide compliance monitoring`
                : 'Portfolio-wide compliance monitoring and document management'}
              {dataUpdatedAt > 0 && (
                <span className="ml-2 text-xs">· Updated {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const rows = filteredCsvRows;
                if (rows.length === 0) {
                  toast.info('Nothing to export with the current filters');
                  return;
                }
                const headers = ['Property', 'Property Type', 'Document', 'Status', 'Days Remaining', 'Expiry Date', 'Issue Date', 'Issuer', 'Certificate #', 'Cost (£)'];
                const escape = (v: unknown) => {
                  const s = v === null || v === undefined ? '' : String(v);
                  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                };
                const lines = [headers.join(',')];
                for (const r of rows) {
                  lines.push([
                    r.property_address,
                    r.property_type ?? '',
                    DOC_TYPE_DISPLAY_NAMES[r.document_type],
                    r.calculated_status,
                    r.days_remaining ?? '',
                    r.expiry_date ?? '',
                    r.issue_date ?? '',
                    r.issuer_name ?? '',
                    r.certificate_number ?? '',
                    r.cost ?? '',
                  ].map(escape).join(','));
                }
                const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const suffix = filtersActive ? `-${statusFilter}` : '';
                a.download = `compliance-register${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success(`Exported ${rows.length} compliance item${rows.length === 1 ? '' : 's'}${filtersActive ? ' (filtered)' : ''}`);
              }}
              disabled={isLoading || !matrix?.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV{filtersActive && matrix?.length ? ` (${filteredCsvRows.length})` : ''}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              title="Print the compliance register"
              className="print:hidden"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRescan}
              disabled={rescanning}
              title="Re-run AI extraction on Vault documents that previously failed or are still pending"
              className="print:hidden"
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', rescanning && 'animate-spin')} />
              {rescanning ? 'Rescanning…' : 'Rescan Vault Documents'}
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    Compliance Score
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="How the compliance score is calculated">
                          <Info className="h-3 w-3 text-muted-foreground/70" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] text-xs">
                        Percentage of required compliance items that are currently valid. Expired, missing, critical and expiring-soon items all reduce the score.
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const pct = score?.compliance_score_pct ?? 0;
                    const r = 18;
                    const c = 2 * Math.PI * r;
                    const dash = (pct / 100) * c;
                    const ringColor = pct === 100 ? 'text-success' : pct >= 90 ? 'text-warning' : 'text-destructive';
                    return (
                      <div className="flex items-center gap-3">
                        <svg width="48" height="48" viewBox="0 0 48 48" className={ringColor} aria-hidden="true">
                          <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="5" />
                          <circle
                            cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="5"
                            strokeDasharray={`${dash} ${c - dash}`}
                            strokeDashoffset={c / 4}
                            strokeLinecap="round"
                            transform="rotate(-90 24 24)"
                          />
                        </svg>
                        <div>
                          <span className={cn('text-3xl font-bold leading-none', ringColor)}>{pct}%</span>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                            {score?.total_valid ?? 0} of {score?.total_required ?? 0} required items valid
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card
                role="button"
                tabIndex={0}
                onClick={() => { setStatusFilter('needs_attention'); setViewMode('matrix'); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter('needs_attention'); setViewMode('matrix'); } }}
                aria-pressed={statusFilter === 'needs_attention'}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  statusFilter === 'needs_attention' && 'ring-2 ring-primary/40',
                )}
                title="Click to filter the matrix to items needing attention"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Needs Attention</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const expiring = score?.total_expiring_soon ?? 0;
                    const critical = score?.total_critical ?? 0;
                    const expired = score?.total_expired ?? 0;
                    const missing = score?.total_missing ?? 0;
                    const total = expiring + critical + expired + missing;
                    return (
                      <>
                        <span className={cn('text-3xl font-bold', total > 0 && 'text-destructive')}>
                          {total}
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                          <button
                            type="button"
                            className="hover:underline"
                            onClick={(e) => { e.stopPropagation(); setStatusFilter('missing'); setViewMode('matrix'); }}
                          >{missing} missing</button>
                          {' · '}
                          <button
                            type="button"
                            className="hover:underline"
                            onClick={(e) => { e.stopPropagation(); setStatusFilter('expired'); setViewMode('matrix'); }}
                          >{expired} expired</button>
                          {' · '}{critical} critical · {expiring} expiring soon
                        </p>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card
                role={nextExpiry ? 'button' : undefined}
                tabIndex={nextExpiry ? 0 : undefined}
                onClick={() => { if (nextExpiry) setSelectedRow(nextExpiry); }}
                onKeyDown={(e) => { if (nextExpiry && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedRow(nextExpiry); } }}
                className={cn(nextExpiry && 'cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                title={nextExpiry ? 'Click to open this compliance item' : undefined}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Next Expiry</CardTitle>
                </CardHeader>
                <CardContent>
                  {nextExpiry ? (
                    <div>
                      <p className={cn('text-sm font-semibold', (nextExpiry.days_remaining ?? 0) < 30 ? 'text-destructive' : (nextExpiry.days_remaining ?? 0) <= 90 ? 'text-warning' : 'text-foreground')}>
                        {nextExpiry.days_remaining}d — {DOC_TYPE_DISPLAY_NAMES[nextExpiry.document_type]}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{nextExpiry.property_address}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No upcoming expiries</p>
                  )}
                </CardContent>
              </Card>

              <Card
                role="button"
                tabIndex={0}
                onClick={() => { setStatusFilter('expired'); setViewMode('matrix'); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatusFilter('expired'); setViewMode('matrix'); } }}
                aria-pressed={statusFilter === 'expired'}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  (score?.total_expired ?? 0) > 0 && 'bg-destructive/5 border-destructive/30',
                  statusFilter === 'expired' && 'ring-2 ring-primary/40',
                )}
                title="Click to filter the matrix to expired items"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className={cn('text-3xl font-bold', (score?.total_expired ?? 0) > 0 && 'text-destructive')}>
                    {score?.total_expired ?? 0}
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                    Past expiry date (excludes missing)
                  </p>
                </CardContent>
              </Card>

            </>

          )}
        </div>

        {/* Tenancy Checklist Summary */}
        <TenancyChecklistSummaryCard />

        {/* Filters + View Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between print:hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" aria-label="Status filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="needs_attention">Needs Attention</SelectItem>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="expired">Expired Only</SelectItem>
                <SelectItem value="missing">Missing Only</SelectItem>
                <SelectItem value="valid">Valid Only</SelectItem>
              </SelectContent>
            </Select>

            {propertyTypes.length > 1 && (
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger className="w-[160px]" aria-label="Property type filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {propertyTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search property... (press /)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 w-[220px]"
                aria-label="Search properties"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStatusFilter('needs_attention'); setSearchQuery(''); setPropertyType('all'); }}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Clear filters
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'matrix' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDensity(d => d === 'comfortable' ? 'compact' : 'comfortable')}
                    aria-label={`Switch to ${density === 'comfortable' ? 'compact' : 'comfortable'} density`}
                  >
                    {density === 'comfortable' ? <Rows3 className="h-4 w-4" /> : <Rows4 className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {density === 'comfortable' ? 'Switch to compact rows' : 'Switch to comfortable rows'}
                </TooltipContent>
              </Tooltip>
            )}

          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            <Button
              variant={viewMode === 'matrix' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('matrix')}
              aria-pressed={viewMode === 'matrix'}
            >
              <Grid3X3 className="h-4 w-4 mr-1" /> Matrix
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              aria-pressed={viewMode === 'calendar'}
            >
              <CalendarDays className="h-4 w-4 mr-1" /> Calendar
            </Button>
          </div>
          <SavedViewsMenu
            scope="compliance"
            currentFilters={{ statusFilter, searchQuery, propertyType, viewMode }}
            onApply={(f) => {
              if (typeof f.statusFilter === 'string') setStatusFilter(f.statusFilter);
              if (typeof f.searchQuery === 'string') setSearchQuery(f.searchQuery);
              if (typeof f.propertyType === 'string') setPropertyType(f.propertyType);
              if (f.viewMode === 'matrix' || f.viewMode === 'calendar') setViewMode(f.viewMode);
            }}
          />
          </div>
        </div>

        {/* Active filter chips bar (visible when any filter is active) */}
        {filtersActive && (
          <div className="flex items-center gap-2 flex-wrap text-xs print:hidden -mt-2">
            <span className="text-muted-foreground">Active filters:</span>
            {statusFilter !== 'needs_attention' && (
              <button
                type="button"
                onClick={() => setStatusFilter('needs_attention')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-muted/70 transition-colors"
              >
                Status: {statusFilter.replace('_', ' ')} <X className="h-3 w-3" />
              </button>
            )}
            {propertyType !== 'all' && (
              <button
                type="button"
                onClick={() => setPropertyType('all')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-muted/70 transition-colors"
              >
                Type: {propertyType} <X className="h-3 w-3" />
              </button>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted hover:bg-muted/70 transition-colors"
              >
                Search: "{searchQuery}" <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Print-only context header */}
        <div className="hidden print:block border-b pb-2 text-xs text-muted-foreground">
          Compliance Register · {uniquePropertyCount} {uniquePropertyCount === 1 ? 'property' : 'properties'} ·
          Printed {new Date().toLocaleString('en-GB')}
          {filtersActive && (
            <> · Filters: {statusFilter}{propertyType !== 'all' && ` · ${propertyType}`}{searchQuery && ` · "${searchQuery}"`}</>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <Skeleton className="h-96" />

        ) : viewMode === 'matrix' ? (
          <ComplianceMatrixGrid
            rows={matrix || []}
            onCellClick={handleCellClick}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            density={density}
            propertyTypeFilter={propertyType}
            onLegendStatusClick={setStatusFilter}
            onClearFilters={() => { setStatusFilter('needs_attention'); setSearchQuery(''); setPropertyType('all'); }}
            diagnostics={diagnostics}
          />
        ) : (
          <ComplianceCalendarView rows={matrix || []} statusFilter={statusFilter} onItemClick={(row) => setSelectedRow(row)} />
        )}

        {/* Back to top */}
        {showBackToTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="print:hidden fixed bottom-6 right-6 z-40 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to top"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}

      </div>
      </TooltipProvider>

      {/* Modals */}
      <ComplianceDetailModal
        row={selectedRow}
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        onUpload={() => {
          setSelectedRow(null);
          setShowUpload(true);
        }}
        diagnostics={selectedRow ? diagnostics?.byCell.get(`${selectedRow.property_id}:${selectedRow.document_type}`) : undefined}
        orphanDocs={selectedRow ? diagnostics?.orphanByType.get(selectedRow.document_type) : undefined}
      />

      <UploadComplianceDocModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        propertyId={selectedRow?.property_id}
        orgId={orgId}
        documentType={selectedRow?.document_type}
        reviewFrequencyMonths={selectedRow?.review_frequency_months}
      />
    </AppLayout>
  );
}
