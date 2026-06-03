import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  FileText, Calendar, Check, X, ChevronDown,
  AlertCircle, Loader2, Shield, Building2, Edit2, RefreshCw, Trash2,
  Clock, CheckCircle2, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { useDeleteDocument } from '@/hooks/useDocuments';
import { useAcceptComplianceDocument, useRejectComplianceDocument, COMPLIANCE_DOC_TYPE_LABELS } from '@/hooks/useComplianceIntake';
import { getComplianceItemStatus, getComplianceStatusColor } from '@/lib/complianceTypes';
import { SEVERITY } from '@/lib/design-tokens';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { createSignedStorageUrl } from '@/lib/storagePaths';
import { usePdfBlobUrl } from '@/hooks/usePdfBlobUrl';
import { PdfCanvasPreview } from './PdfCanvasPreview';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";

type Document = Database['public']['Tables']['documents']['Row'];

interface ComplianceReviewCardProps {
  document: Document;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}

function ExtractionStatusBadge({ status, docType, validationErrors }: { status: string; docType?: string | null; validationErrors?: string[] | null }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className={SEVERITY.neutral.badge}>
          <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${SEVERITY.neutral.dot}`} />
          Queued
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="outline" className={SEVERITY.info.badge}>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Analysing...
        </Badge>
      );
    case 'completed':
      return (
        <Badge className={SEVERITY.success.badge}>
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {docType ? (COMPLIANCE_DOC_TYPE_LABELS[docType] || 'Classified') : 'Processed'}
        </Badge>
      );
    case 'failed': {
      const errorMsg = validationErrors?.[0];
      if (errorMsg) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={SEVERITY.critical.badge}>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
              </TooltipTrigger>
              <TooltipContent><p>{errorMsg}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return (
        <Badge className={SEVERITY.critical.badge}>
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    }
    case 'rate_limited':
      return (
        <Badge className={SEVERITY.warning.badge}>
          <Clock className="h-3 w-3 mr-1" />
          Rate limited — retry in a few minutes
        </Badge>
      );
    case 'credits_exhausted':
      return (
        <Badge className={SEVERITY.warning.badge}>
          <AlertCircle className="h-3 w-3 mr-1" />
          AI processing unavailable
        </Badge>
      );
    case 'review_needed':
      return (
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
          <Edit2 className="h-3 w-3 mr-1" />
          Needs manual review
        </Badge>
      );
    default:
      return null;
  }
}

export function ComplianceReviewCard({ document, selected, onSelectChange }: ComplianceReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Form state
  const [selectedDocType, setSelectedDocType] = useState(document.ai_suggested_doc_type || '');
  const [selectedPropertyId, setSelectedPropertyId] = useState(document.ai_suggested_property_id || '');
  const [issueDate, setIssueDate] = useState(document.extracted_issue_date || '');
  const [expiryDate, setExpiryDate] = useState(document.expiry_date || '');

  const acceptDocument = useAcceptComplianceDocument();
  const rejectDocument = useRejectComplianceDocument();
  const deleteDocument = useDeleteDocument();
  const { data: properties } = usePropertiesV2();
  const isProcessed = document.extraction_status === 'completed';
  const isReviewNeeded = document.extraction_status === 'review_needed';
  const hasTimedOut = (document.extraction_status === 'pending' || document.extraction_status === 'processing') &&
    !!document.created_at &&
    Date.now() - new Date(document.created_at).getTime() > 10 * 60 * 1000;
  const isActionable = isProcessed || isReviewNeeded;
  const isPending = (document.extraction_status === 'pending' || document.extraction_status === 'processing') && !hasTimedOut;
  const isFailed = document.extraction_status === 'failed';
  const isRateLimited = document.extraction_status === 'rate_limited';
  const isCreditsExhausted = document.extraction_status === 'credits_exhausted';
  const needsManualClassification = isFailed || isRateLimited || isCreditsExhausted || hasTimedOut;
  const isProcessing = acceptDocument.isPending || rejectDocument.isPending || deleteDocument.isPending;
  const [isRetrying, setIsRetrying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSignedLoading, setPreviewSignedLoading] = useState(false);
  const isPdf = !!document.original_file_name?.toLowerCase().endsWith('.pdf');
  const queryClient = useQueryClient();

  // For PDFs we download via the SDK and stream as a blob: URL (Chrome's PDF
  // viewer often refuses to render Supabase signed URLs directly inside <object>).
  const { blobUrl: pdfBlobUrl, blob: pdfBlob, loading: pdfBlobLoading, error: pdfBlobError } =
    usePdfBlobUrl(isExpanded && isPdf ? document.file_url : null);

  // For images we just need a signed URL.
  useEffect(() => {
    if (!isExpanded || isPdf || previewUrl || !document.file_url) return;
    let cancelled = false;
    setPreviewSignedLoading(true);
    createSignedStorageUrl('documents', document.file_url, 3600)
      .then(url => { if (!cancelled) setPreviewUrl(url); })
      .catch(() => { /* silent — preview is best-effort */ })
      .finally(() => { if (!cancelled) setPreviewSignedLoading(false); });
    return () => { cancelled = true; };
  }, [isExpanded, isPdf, previewUrl, document.file_url]);

  // A "open full size" link should always use a signed URL (blob: won't survive a new tab cleanly).
  const [openHref, setOpenHref] = useState<string | null>(null);
  useEffect(() => {
    if (!isExpanded || openHref || !document.file_url) return;
    let cancelled = false;
    createSignedStorageUrl('documents', document.file_url, 3600)
      .then(url => { if (!cancelled) setOpenHref(url); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [isExpanded, openHref, document.file_url]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await supabase.from('documents').update({
        extraction_status: 'pending',
        validation_errors: null,
      }).eq('id', document.id);

      const signedUrl = await createSignedStorageUrl('documents', document.file_url, 3600);
      const orgId = document.org_id;

      if (signedUrl && orgId) {
        const { error } = await supabase.functions.invoke('process-document-v2', {
          body: { document_url: signedUrl, document_id: document.id, org_id: orgId },
        });

        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ['documents', 'inbox'] });
    } catch (err) {
      console.error('Failed to retry document processing:', err);
      toast.error('Error', { description: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setIsRetrying(false);
    }
  }, [document.id, document.file_url, document.org_id, queryClient]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteDocument.mutateAsync(document.id);
      toast.error('Document deleted');
    } catch {
      // error toast handled by hook
    }
  }, [document.id, deleteDocument]);

  const docTypeConfidence = document.ai_doc_type_confidence || 0;
  const propertyConfidence = document.ai_property_confidence || 0;

  const wasEdited =
    selectedDocType !== document.ai_suggested_doc_type ||
    selectedPropertyId !== document.ai_suggested_property_id ||
    issueDate !== (document.extracted_issue_date || '') ||
    expiryDate !== (document.expiry_date || '');

  // Auto-retry rate-limited documents after 60 seconds
  useEffect(() => {
    if (!isRateLimited) return;
    const timer = setTimeout(() => {
      handleRetry();
    }, 60_000);
    return () => clearTimeout(timer);
  }, [isRateLimited, handleRetry]);

  // Auto-expand if low confidence or needs manual classification
  useEffect(() => {
    if (needsManualClassification) {
      setIsExpanded(true);
    } else if (isActionable && (docTypeConfidence < 0.7 || propertyConfidence < 0.7 || !document.ai_suggested_property_id)) {
      setIsExpanded(true);
    }
  }, [isActionable, docTypeConfidence, propertyConfidence, document.ai_suggested_property_id, needsManualClassification]);

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">High</Badge>;
    if (confidence >= 0.5) return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Medium</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Low</Badge>;
  };

  const handleAccept = async () => {
    if (!selectedDocType) {
      return;
    }
    if (!selectedPropertyId) {
      setIsExpanded(true);
      return;
    }

    const selectedProperty = properties?.find(p => p.id === selectedPropertyId);
    if (!selectedProperty) return;

    await acceptDocument.mutateAsync({
      documentId: document.id,
      docType: selectedDocType,
      propertyId: selectedPropertyId,
      propertyAddress: `${selectedProperty.address_line_1}, ${selectedProperty.city}`,
      issueDate: issueDate || null,
      expiryDate: expiryDate || null,
      originalFilename: document.original_file_name,
      fileUrl: document.file_url,
      epcRating: document.extracted_epc_rating,
      wasEdited,
      originalAiSuggestions: {
        docType: document.ai_suggested_doc_type,
        propertyId: document.ai_suggested_property_id,
        issueDate: document.extracted_issue_date,
        expiryDate: document.expiry_date,
      },
    });
  };

  const handleReject = async () => {
    await rejectDocument.mutateAsync(document.id);
  };

  const suggestedProperty = properties?.find(p => p.id === document.ai_suggested_property_id);
  const selectedProperty = properties?.find(p => p.id === selectedPropertyId);

  const complianceStatus = expiryDate ? getComplianceItemStatus(expiryDate) : 'unknown';

  const isReadyForConfirm = isActionable &&
    docTypeConfidence >= 0.7 &&
    propertyConfidence >= 0.7 &&
    selectedPropertyId;

  // For manual classification, allow accept if user has filled doc type + property
  const canAcceptManually = needsManualClassification && selectedDocType && selectedPropertyId;

  return (
    <Card className={`bg-card border-border ${!selectedPropertyId && isActionable ? 'border-amber-500/50' : ''}`}>
      <CardContent className="p-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-start gap-4">
            {/* Selection checkbox */}
            {onSelectChange && (
              <input
                type="checkbox"
                checked={selected ?? false}
                onChange={(e) => onSelectChange(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border"
              />
            )}

            {/* Thumbnail */}
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {document.file_url && (document.original_file_name?.endsWith('.pdf') ? (
                <FileText className="h-8 w-8 text-muted-foreground" />
              ) : (
                <img
                  src={document.file_url}
                  alt="Document preview"
                  className="h-full w-full object-cover"
                />
              ))}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <p className="font-medium text-foreground truncate">
                  {COMPLIANCE_DOC_TYPE_LABELS[selectedDocType] || document.original_file_name}
                </p>
                <ExtractionStatusBadge
                  status={hasTimedOut ? 'failed' : document.extraction_status || 'pending'}
                  docType={document.ai_suggested_doc_type}
                  validationErrors={document.validation_errors}
                />
              </div>

              {isPending && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{document.original_file_name}</span>
                  {document.created_at && (
                    <span className="text-xs">
                      Uploaded {format(new Date(document.created_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                </div>
              )}

              {isActionable && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {!selectedPropertyId ? (
                    <Badge variant="outline" className="border-amber-500 text-amber-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Property match required
                    </Badge>
                  ) : (
                    <>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {selectedProperty?.address_line_1}
                      </span>
                      {getConfidenceBadge(propertyConfidence)}
                    </>
                  )}

                  {expiryDate && (
                    <Badge className={getComplianceStatusColor(complianceStatus)}>
                      <Calendar className="h-3 w-3 mr-1" />
                      {complianceStatus === 'expired'
                        ? `Expired ${format(new Date(expiryDate), 'dd MMM yyyy')}`
                        : `Expires ${format(new Date(expiryDate), 'dd MMM yyyy')}`
                      }
                    </Badge>
                  )}

                  {wasEdited && (
                    <Badge variant="outline" className="text-xs">
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edited
                    </Badge>
                  )}
                </div>
              )}

              {needsManualClassification && !isActionable && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{document.original_file_name}</span>
                  {document.created_at && (
                    <span className="text-xs">
                      Uploaded {format(new Date(document.created_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <CollapsibleTrigger asChild>
                <Button aria-label="Expand" variant="ghost" size="icon">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>

              {/* Delete button with confirmation */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button aria-label="Delete"
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={isProcessing}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {isFailed || isRateLimited || hasTimedOut ? (
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Retry
                </Button>
              ) : null}

              {!isCreditsExhausted && (
                <>
                  <Button aria-label="Close"
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleReject}
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <Button
                    onClick={handleAccept}
                    disabled={isProcessing || (!isActionable && !canAcceptManually) || !selectedDocType}
                    className={isReadyForConfirm ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        {canAcceptManually ? 'Accept manually' : isReadyForConfirm ? 'Confirm' : 'Review'}
                      </>
                    )}
                  </Button>
                </>
              )}

              {isCreditsExhausted && (
                <>
                  <Button aria-label="Close"
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleReject}
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleAccept}
                    disabled={isProcessing || !selectedDocType || !selectedPropertyId}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Accept manually
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          <CollapsibleContent className="mt-4 pt-4 border-t border-border">
            {/* Document preview — helps verify extracted issue/expiry dates against the source */}
            {document.file_url && (
              <div className="mb-4 rounded-lg border border-border overflow-hidden bg-muted/30">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{document.original_file_name || 'Document preview'}</span>
                  </div>
                  {openHref && (
                    <a
                      href={openHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                    >
                      Open full size
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="bg-background" style={{ minHeight: 480 }}>
                  {isPdf ? (
                    pdfBlobLoading && !pdfBlob ? (
                      <div className="flex items-center justify-center" style={{ height: 480 }}>
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : pdfBlob ? (
                      <PdfCanvasPreview data={pdfBlob} height={480} />
                    ) : (
                      <div className="flex items-center justify-center p-4 text-center text-sm text-muted-foreground" style={{ height: 480 }}>
                        {pdfBlobError || 'PDF preview unavailable.'}{' '}
                        {openHref && (
                          <a href={openHref} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                            Open in new tab
                          </a>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center" style={{ height: 480 }}>
                      {previewSignedLoading && !previewUrl ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Document preview"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">Preview unavailable</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}



            {/* Manual classification banner for failed/rate_limited/credits_exhausted */}
            {needsManualClassification && (
              <div className={`p-3 rounded-lg mb-4 ${SEVERITY.warning.bg} ${SEVERITY.warning.border} border`}>
                <p className={`text-sm font-medium ${SEVERITY.warning.text}`}>
                  Classify manually
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  AI processing {isFailed ? 'failed' : isRateLimited ? 'was rate limited' : 'is unavailable'}.
                  Select the document type, property, and expiry date below, then click "Accept manually".
                </p>
              </div>
            )}


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Compliance Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Compliance Type</label>
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select compliance type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPLIANCE_DOC_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {document.ai_suggested_doc_type && (
                  <p className="text-xs text-muted-foreground">
                    AI detected: {COMPLIANCE_DOC_TYPE_LABELS[document.ai_suggested_doc_type]}
                    ({Math.round(docTypeConfidence * 100)}%)
                  </p>
                )}
              </div>

              {/* Property Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Property {!selectedPropertyId && <span className="text-amber-500">*</span>}
                </label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger className={!selectedPropertyId ? 'border-amber-500' : ''}>
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.address_line_1}, {property.city} {property.postcode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {document.ai_suggested_property_id && suggestedProperty && (
                  <p className="text-xs text-muted-foreground">
                    AI matched: {suggestedProperty.address_line_1}
                    ({Math.round(propertyConfidence * 100)}%)
                  </p>
                )}
              </div>

              {/* Issue Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Issue Date</label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
                {document.extracted_issue_date && (
                  <p className="text-xs text-muted-foreground">
                    AI detected: {format(new Date(document.extracted_issue_date), 'dd MMM yyyy')}
                  </p>
                )}
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Expiry Date</label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
                {document.expiry_date && document.expiry_date !== expiryDate && (
                  <p className="text-xs text-muted-foreground">
                    AI detected: {format(new Date(document.expiry_date), 'dd MMM yyyy')}
                  </p>
                )}
              </div>

              {/* Extracted Info */}
              {(document.extracted_address_text || document.extracted_reference_number || document.extracted_epc_rating) && (
                <div className="md:col-span-2 p-3 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    AI Extracted Information
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {document.extracted_address_text && (
                      <div>
                        <span className="text-muted-foreground">Address:</span>
                        <p className="font-medium">{document.extracted_address_text}</p>
                      </div>
                    )}
                    {document.extracted_reference_number && (
                      <div>
                        <span className="text-muted-foreground">Reference:</span>
                        <p className="font-medium">{document.extracted_reference_number}</p>
                      </div>
                    )}
                    {document.extracted_epc_rating && (
                      <div>
                        <span className="text-muted-foreground">EPC Rating:</span>
                        <p className="font-medium">{document.extracted_epc_rating}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
