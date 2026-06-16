import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';
import { ArrowUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { useComplianceMatrix, usePortfolioComplianceScoreV2, useRefreshComplianceStatuses } from '@/hooks/useComplianceV2';
import { useMissingComplianceDiagnostics } from '@/hooks/useMissingComplianceDiagnostics';
import { TenancyChecklistSummaryCard } from '@/components/lettings/TenancyChecklist';
import { ComplianceMatrixGrid } from '@/components/compliance-v2/ComplianceMatrixGrid';
import { ComplianceCalendarView } from '@/components/compliance-v2/ComplianceCalendarView';
import { ComplianceDetailModal } from '@/components/compliance-v2/ComplianceDetailModal';
import { UploadComplianceDocModal } from '@/components/compliance-v2/UploadComplianceDocModal';
import type { ComplianceMatrixRow, ComplianceDocType } from '@/lib/complianceV2Types';
import { SEO } from '@/components/SEO';
import { ComplianceHubTabs } from '@/components/compliance/ComplianceHubTabs';

import { useComplianceUrlState } from '@/components/compliance-v2/page/useComplianceUrlState';
import { ComplianceStatCards } from '@/components/compliance-v2/page/ComplianceStatCards';
import { ComplianceFiltersBar } from '@/components/compliance-v2/page/ComplianceFiltersBar';
import { ComplianceHeader } from '@/components/compliance-v2/page/ComplianceHeader';
import { exportComplianceCsv } from '@/components/compliance-v2/page/exportComplianceCsv';

export default function ComplianceV2() {
  const { data: matrix, isLoading, dataUpdatedAt } = useComplianceMatrix();
  const { data: score } = usePortfolioComplianceScoreV2();
  const refreshStatuses = useRefreshComplianceStatuses();
  const queryClient = useQueryClient();
  const orgIdEarly = matrix?.[0]?.org_id;
  const { data: diagnostics } = useMissingComplianceDiagnostics(orgIdEarly);

  const {
    statusFilter, setStatusFilter,
    searchQuery, setSearchQuery,
    viewMode, setViewMode,
    propertyType, setPropertyType,
    monthFocus, setMonthFocus,
    filtersActive, clearFilters,
  } = useComplianceUrlState();

  const [rescanning, setRescanning] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    if (typeof window === 'undefined') return 'comfortable';
    return (localStorage.getItem('compliance-v2-density') as 'comfortable' | 'compact') || 'comfortable';
  });
  useEffect(() => {
    try { localStorage.setItem('compliance-v2-density', density); } catch { /* ignore */ }
  }, [density]);

  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [selectedRow, setSelectedRow] = useState<ComplianceMatrixRow | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    refreshStatuses.mutate();
  }, [refreshStatuses]);

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

  const focusedMatrix = useMemo(() => {
    if (!matrix || !monthFocus) return matrix;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return matrix.filter((r) => {
      if (!r.is_required) return false;
      if (['expired', 'missing', 'critical'].includes(r.calculated_status)) return true;
      if (!r.expiry_date) return false;
      const ex = new Date(r.expiry_date);
      return ex >= monthStart && ex <= monthEnd;
    });
  }, [matrix, monthFocus]);

  const filteredCsvRows = useMemo(() => {
    const source = focusedMatrix ?? matrix;
    if (!source) return [];
    const needsAttention = (s: string) => ['expiring_soon', 'critical', 'expired', 'missing'].includes(s);
    return source.filter(r => {
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
  }, [matrix, focusedMatrix, statusFilter, searchQuery, propertyType]);

  return (
    <AppLayout>
      <SEO title="Compliance Register — TenureIQ" description="Portfolio compliance, traffic-lighted by property and room." />
      <TooltipProvider delayDuration={200}>
      <div className="space-y-6 print:space-y-3">
        <ComplianceHubTabs />

        <ComplianceHeader
          uniquePropertyCount={uniquePropertyCount}
          dataUpdatedAt={dataUpdatedAt}
          rescanning={rescanning}
          onRescan={handleRescan}
          onExport={() => exportComplianceCsv(filteredCsvRows, { filtersActive, statusFilter })}
          exportDisabled={isLoading || !matrix?.length}
          filtersActive={filtersActive}
          filteredCount={filteredCsvRows.length}
          totalCount={matrix?.length ?? 0}
        />

        <ComplianceStatCards
          isLoading={isLoading}
          score={score}
          nextExpiry={nextExpiry}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          setViewMode={setViewMode}
          onOpenRow={setSelectedRow}
        />

        <TenancyChecklistSummaryCard />

        <ComplianceFiltersBar
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          propertyType={propertyType}
          setPropertyType={setPropertyType}
          propertyTypes={propertyTypes}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchInputRef={searchInputRef}
          monthFocus={monthFocus}
          setMonthFocus={setMonthFocus}
          filtersActive={filtersActive}
          clearFilters={clearFilters}
          viewMode={viewMode}
          setViewMode={setViewMode}
          density={density}
          setDensity={setDensity}
        />

        <div className="hidden print:block border-b pb-2 text-xs text-muted-foreground">
          Compliance Register · {uniquePropertyCount} {uniquePropertyCount === 1 ? 'property' : 'properties'} ·
          Printed {new Date().toLocaleString('en-GB')}
          {filtersActive && (
            <> · Filters: {statusFilter}{propertyType !== 'all' && ` · ${propertyType}`}{searchQuery && ` · "${searchQuery}"`}</>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-96" />
        ) : viewMode === 'matrix' ? (
          <ComplianceMatrixGrid
            rows={focusedMatrix || matrix || []}
            onCellClick={handleCellClick}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            density={density}
            propertyTypeFilter={propertyType}
            onLegendStatusClick={setStatusFilter}
            onClearFilters={clearFilters}
            diagnostics={diagnostics}
          />
        ) : (
          <ComplianceCalendarView rows={focusedMatrix || matrix || []} statusFilter={statusFilter} onItemClick={(row) => setSelectedRow(row)} />
        )}

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
