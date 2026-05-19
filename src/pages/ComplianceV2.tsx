import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, Search, Grid3X3, CalendarDays, RefreshCw, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { useComplianceMatrix, usePortfolioComplianceScoreV2, useRefreshComplianceStatuses } from '@/hooks/useComplianceV2';
import { TenancyChecklistSummaryCard } from '@/components/lettings/TenancyChecklist';
import { ComplianceMatrixGrid } from '@/components/compliance-v2/ComplianceMatrixGrid';
import { ComplianceCalendarView } from '@/components/compliance-v2/ComplianceCalendarView';
import { ComplianceDetailModal } from '@/components/compliance-v2/ComplianceDetailModal';
import { UploadComplianceDocModal } from '@/components/compliance-v2/UploadComplianceDocModal';
import type { ComplianceMatrixRow, ComplianceDocType } from '@/lib/complianceV2Types';
import { DOC_TYPE_DISPLAY_NAMES } from '@/lib/complianceV2Types';
import { SEO } from '@/components/SEO';

export default function ComplianceV2() {
  const { data: matrix, isLoading } = useComplianceMatrix();
  const { data: score } = usePortfolioComplianceScoreV2();
  const refreshStatuses = useRefreshComplianceStatuses();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('needs_attention');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'matrix' | 'calendar'>('matrix');
  const [rescanning, setRescanning] = useState(false);

  // Detail modal state
  const [selectedRow, setSelectedRow] = useState<ComplianceMatrixRow | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Refresh statuses on mount
  useEffect(() => {
    refreshStatuses.mutate();
  }, [refreshStatuses]);

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

  return (
    <AppLayout>
      <SEO title="Compliance Register — TenureIQ" description="Portfolio compliance, traffic-lighted by property and room." />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              Compliance Dashboard
            </h1>
            <p className="text-muted-foreground">Portfolio-wide compliance monitoring and document management</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRescan}
            disabled={rescanning}
            title="Re-run AI extraction on Vault documents that previously failed or are still pending"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', rescanning && 'animate-spin')} />
            {rescanning ? 'Rescanning…' : 'Rescan Vault Documents'}
          </Button>
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Compliance Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className={cn(
                    'text-3xl font-bold',
                    (score?.compliance_score_pct ?? 0) === 100 && 'text-success',
                    (score?.compliance_score_pct ?? 0) >= 90 && (score?.compliance_score_pct ?? 0) < 100 && 'text-warning',
                    (score?.compliance_score_pct ?? 0) < 90 && 'text-destructive',
                  )}>
                    {score?.compliance_score_pct ?? 0}%
                  </span>
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
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

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search property..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            <Button
              variant={viewMode === 'matrix' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('matrix')}
            >
              <Grid3X3 className="h-4 w-4 mr-1" /> Matrix
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="h-4 w-4 mr-1" /> Calendar
            </Button>
          </div>
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
          />
        ) : (
          <ComplianceCalendarView rows={matrix || []} statusFilter={statusFilter} />
        )}

      </div>

      {/* Modals */}
      <ComplianceDetailModal
        row={selectedRow}
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        onUpload={() => {
          setSelectedRow(null);
          setShowUpload(true);
        }}
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
