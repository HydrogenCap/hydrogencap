import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, RefreshCw, CheckCheck, Upload, AlertTriangle, CheckCircle2, Brain, Settings2, Trash2, Sparkles } from 'lucide-react';
import { partitionReadyDocs, countUnreviewedAISuggestions, isUnreviewedAISuggestion } from '@/lib/inboxBulkGate';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DocumentUploadZone } from '@/components/inbox/DocumentUploadZone';
import { ComplianceReviewCard } from '@/components/inbox/ComplianceReviewCard';
import { AIProcessingDashboard } from '@/components/inbox/AIProcessingDashboard';
import { AISettingsPanel } from '@/components/inbox/AISettingsPanel';
import { EmptyState } from '@/components/common/EmptyState';
import { useInboxDocuments, useInboxRealtime, useDeleteDocument } from '@/hooks/useDocuments';
import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useAcceptAllHighConfidence } from '@/hooks/useComplianceIntake';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';

export default function InboxPage() {
  return (<AppLayout><InboxPageInner /></AppLayout>);
}

function InboxPageInner() {
  useInboxRealtime();
  const { data: documents, isLoading, refetch } = useInboxDocuments();
  const { data: complianceMatrixRows } = useQuery({
    queryKey: ['compliance_matrix_v2_inbox'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('compliance_matrix_v2')
        .select('calculated_status');
      if (error) throw error;
      return (data || []) as unknown as Array<{ calculated_status: string }>;
    },
  });
  const acceptAllHighConfidence = useAcceptAllHighConfidence();
  const deleteDocument = useDeleteDocument();
  const { toast } = useToast();
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const [showNullConfirmDialog, setShowNullConfirmDialog] = useState(false);
  const [showUnreviewedOnly, setShowUnreviewedOnly] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const pendingDocs = documents?.filter(d => d.review_status === 'pending') || [];
  const isStaleProcessing = useCallback((doc: { extraction_status?: string | null; created_at?: string | null }) => {
    if (doc.extraction_status !== 'pending' && doc.extraction_status !== 'processing') return false;
    if (!doc.created_at) return false;
    return Date.now() - new Date(doc.created_at).getTime() > 10 * 60 * 1000;
  }, []);
  const processingDocs = documents?.filter(d =>
    (d.extraction_status === 'pending' || d.extraction_status === 'processing') && !isStaleProcessing(d)
  ) || [];
  const failedDocs = documents?.filter(d =>
    (d.extraction_status === 'failed' || d.extraction_status === 'rate_limited' || d.extraction_status === 'credits_exhausted' || isStaleProcessing(d)) &&
    d.review_status === 'pending'
  ) || [];
  const readyDocsAll = pendingDocs.filter(d => d.extraction_status === 'completed' || d.extraction_status === 'review_needed');

  // #57 follow-up: partition into high / null-confidence / low-confidence buckets.
  // NULL-confidence rows used to fall through `(NULL || 0) >= 0.7` and were
  // silently excluded from Accept-All — they now surface explicitly.
  const { highConfidence: highConfidenceDocs, nullConfidence: nullConfidenceDocs, lowConfidence: lowConfidenceDocs } =
    useMemo(() => partitionReadyDocs(readyDocsAll), [readyDocsAll]);

  // Header chip count: AI suggested a property, user has not yet confirmed.
  const unreviewedCount = useMemo(
    () => countUnreviewedAISuggestions(documents ?? []),
    [documents],
  );

  const readyDocs = showUnreviewedOnly
    ? readyDocsAll.filter(isUnreviewedAISuggestion)
    : readyDocsAll;
  const visibleHighConf = showUnreviewedOnly ? highConfidenceDocs.filter(isUnreviewedAISuggestion) : highConfidenceDocs;
  const visibleNullConf = showUnreviewedOnly ? nullConfidenceDocs.filter(isUnreviewedAISuggestion) : nullConfidenceDocs;
  const visibleLowConf = showUnreviewedOnly ? lowConfidenceDocs.filter(isUnreviewedAISuggestion) : lowConfidenceDocs;

  // Calculate compliance stats from V2 matrix
  const complianceStats = useMemo(() => {
    if (!complianceMatrixRows) return { valid: 0, expiring: 0, expired: 0 };
    return {
      valid: complianceMatrixRows.filter(r => r.calculated_status === 'valid').length,
      expiring: complianceMatrixRows.filter(r => r.calculated_status === 'expiring_soon').length,
      expired: complianceMatrixRows.filter(r =>
        r.calculated_status === 'expired' || r.calculated_status === 'missing'
      ).length,
    };
  }, [complianceMatrixRows]);

  const handleAcceptAll = async () => {
    if (highConfidenceDocs.length === 0) return;
    setIsAcceptingAll(true);
    try {
      await acceptAllHighConfidence.mutateAsync(highConfidenceDocs);
      setSelectedIds(new Set());
    } finally {
      setIsAcceptingAll(false);
    }
  };

  const handleSelectChange = useCallback((docId: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) next.add(docId);
      else next.delete(docId);
      return next;
    });
  }, []);

  const handleConfirmNullBulk = async () => {
    setShowNullConfirmDialog(false);
    if (nullConfidenceDocs.length === 0) return;
    setIsAcceptingAll(true);
    try {
      await acceptAllHighConfidence.mutateAsync(nullConfidenceDocs);
      setSelectedIds(new Set());
    } finally {
      setIsAcceptingAll(false);
    }
  };

  const handleBulkAccept = async () => {
    const selectedDocs = readyDocsAll.filter(d => selectedIds.has(d.id));
    const { highConfidence: highConfSelected, nullConfidence: nullConfSelected } = partitionReadyDocs(selectedDocs);
    if (highConfSelected.length === 0 && nullConfSelected.length === 0) {
      toast({ title: 'Nothing to accept', description: 'Selected documents fall below the AI confidence threshold — review them per-row.', variant: 'destructive' });
      return;
    }
    if (nullConfSelected.length > 0 && highConfSelected.length === 0) {
      // Selection is entirely NULL-confidence — require explicit confirm via dialog.
      setShowNullConfirmDialog(true);
      return;
    }
    setIsAcceptingAll(true);
    try {
      await acceptAllHighConfidence.mutateAsync(highConfSelected);
      setSelectedIds(new Set());
    } finally {
      setIsAcceptingAll(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteDocument.mutateAsync(id);
      }
      toast({ title: `Deleted ${selectedIds.size} document(s)`, variant: 'destructive' });
      setSelectedIds(new Set());
    } catch {
      // individual errors handled by hook
    } finally {
      setIsBulkDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUploadComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <>
      <SEO title="Inbox — TenureIQ" description="Tenant messages, contractor updates, and tasks in one place." />
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Compliance Inbox
              {pendingDocs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingDocs.length} pending
                </Badge>
              )}
              {unreviewedCount > 0 && (
                <button
                  type="button"
                  aria-pressed={showUnreviewedOnly}
                  aria-label={`${unreviewedCount} unreviewed AI suggestions — click to ${showUnreviewedOnly ? 'clear filter' : 'filter'}`}
                  onClick={() => setShowUnreviewedOnly(v => !v)}
                  className="ml-1"
                >
                  <Badge
                    variant={showUnreviewedOnly ? 'default' : 'outline'}
                    className="gap-1 cursor-pointer hover:bg-accent"
                  >
                    <Sparkles className="h-3 w-3" />
                    {unreviewedCount} unreviewed AI {unreviewedCount === 1 ? 'suggestion' : 'suggestions'}
                    {showUnreviewedOnly && <span className="ml-1 text-xs">×</span>}
                  </Badge>
                </button>
              )}
            </h1>
            <p className="text-muted-foreground">
              AI-powered compliance document intake and management
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button aria-label="Refresh"
              variant="outline"
              size="icon"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {highConfidenceDocs.length > 0 && (
              <Button
                onClick={handleAcceptAll}
                disabled={isAcceptingAll}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Confirm All ({highConfidenceDocs.length})
              </Button>
            )}
          </div>
        </div>

        {/* Compliance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Valid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="text-2xl font-bold">{complianceStats.valid}</span>
              </div>
            </CardContent>
          </Card>
          <Link to="/compliance-v2">
            <Card className={cn('cursor-pointer hover:bg-muted/50 transition-colors', complianceStats.expiring > 0 && 'border-amber-500/50')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-2xl font-bold">{complianceStats.expiring}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/compliance-v2">
            <Card className={cn('cursor-pointer hover:bg-muted/50 transition-colors', complianceStats.expired > 0 && 'border-destructive/50')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-bold">{complianceStats.expired}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Upload Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Compliance Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUploadZone onUploadComplete={handleUploadComplete} />
            <p className="text-xs text-muted-foreground mt-2">
              Upload certificates, licences, and compliance documents. AI will automatically classify,
              extract dates, and match to your properties.
            </p>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-sm">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button
              size="sm"
              onClick={handleBulkAccept}
              disabled={isAcceptingAll}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Accept All
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isBulkDeleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        )}

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} document(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* #57 follow-up: explicit confirm dialog for NULL-confidence bulk-accept */}
        <AlertDialog open={showNullConfirmDialog} onOpenChange={setShowNullConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Accept {nullConfidenceDocs.length} unscored AI {nullConfidenceDocs.length === 1 ? 'suggestion' : 'suggestions'}?</AlertDialogTitle>
              <AlertDialogDescription>
                These documents have an AI-suggested property but no confidence score, so we can&rsquo;t silently bulk-accept them. Confirm only if you&rsquo;ve eyeballed the suggestions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmNullBulk} className="bg-emerald-600 hover:bg-emerald-700">
                Confirm &amp; accept
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Document List */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              Ready for Review
              {readyDocs.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                  {readyDocs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processing" className="gap-2">
              Analysing
              {(processingDocs.length + failedDocs.length) > 0 && (
                <Badge variant={failedDocs.length > 0 ? "destructive" : "secondary"} className="h-5 min-w-5 px-1.5">
                  {processingDocs.length + failedDocs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2">
              <Brain className="h-3.5 w-3.5" />
              AI Dashboard
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : readyDocs.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Inbox clear"
                description="No documents waiting for review. Drop files above to classify a new document."
                variant="success"
              />
            ) : (
              <>
                {visibleHighConf.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Ready to confirm ({visibleHighConf.length})
                    </p>
                    {visibleHighConf.map(doc => (
                      <ComplianceReviewCard
                        key={doc.id}
                        document={doc}
                        selected={selectedIds.has(doc.id)}
                        onSelectChange={(sel) => handleSelectChange(doc.id, sel)}
                      />
                    ))}
                  </div>
                )}

                {visibleNullConf.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        Review manually before bulk-accept ({visibleNullConf.length})
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowNullConfirmDialog(true)}
                        disabled={isAcceptingAll || nullConfidenceDocs.length === 0}
                      >
                        Confirm &amp; accept all unscored
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The AI suggested a property but didn&rsquo;t score its confidence. Eyeball each suggestion, then confirm.
                    </p>
                    {visibleNullConf.map(doc => (
                      <ComplianceReviewCard
                        key={doc.id}
                        document={doc}
                        selected={selectedIds.has(doc.id)}
                        onSelectChange={(sel) => handleSelectChange(doc.id, sel)}
                      />
                    ))}
                  </div>
                )}

                {visibleLowConf.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Needs review ({visibleLowConf.length})
                    </p>
                    {visibleLowConf.map(doc => (
                      <ComplianceReviewCard
                        key={doc.id}
                        document={doc}
                        selected={selectedIds.has(doc.id)}
                        onSelectChange={(sel) => handleSelectChange(doc.id, sel)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="processing" className="space-y-3">
            {processingDocs.length === 0 && failedDocs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No documents analysing</p>
                <p className="text-sm">Upload documents to start AI analysis</p>
              </div>
            ) : (
              <>
                {failedDocs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Needs attention ({failedDocs.length}) — retry or classify manually
                    </p>
                    {failedDocs.map(doc => (
                      <ComplianceReviewCard
                        key={doc.id}
                        document={doc}
                        selected={selectedIds.has(doc.id)}
                        onSelectChange={(sel) => handleSelectChange(doc.id, sel)}
                      />
                    ))}
                  </div>
                )}
                {processingDocs.map(doc => (
                  <ComplianceReviewCard
                    key={doc.id}
                    document={doc}
                    selected={selectedIds.has(doc.id)}
                    onSelectChange={(sel) => handleSelectChange(doc.id, sel)}
                  />
                ))}
              </>
            )}
          </TabsContent>
          <TabsContent value="dashboard">
            <AIProcessingDashboard />
          </TabsContent>

          <TabsContent value="settings">
            <AISettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
