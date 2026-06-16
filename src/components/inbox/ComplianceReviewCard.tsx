import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { AlertCircle, Building2, Calendar, Edit2, FileText, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { useDeleteDocument } from '@/hooks/useDocuments';
import { useAcceptComplianceDocument, useRejectComplianceDocument, COMPLIANCE_DOC_TYPE_LABELS } from '@/hooks/useComplianceIntake';
import { getComplianceItemStatus, getComplianceStatusColor } from '@/lib/complianceTypes';
import { SEVERITY } from '@/lib/design-tokens';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { createSignedStorageUrl } from '@/lib/storagePaths';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ExtractionStatusBadge } from './review-card/ExtractionStatusBadge';
import { useReviewDocumentPreview } from './review-card/useReviewDocumentPreview';
import { DocumentPreviewPanel } from './review-card/DocumentPreviewPanel';
import { ReviewFormFields } from './review-card/ReviewFormFields';
import { ReviewCardActions } from './review-card/ReviewCardActions';

type Document = Database['public']['Tables']['documents']['Row'];

interface ComplianceReviewCardProps {
  document: Document;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}

function getConfidenceBadge(confidence: number) {
  if (confidence >= 0.8) return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">High</Badge>;
  if (confidence >= 0.5) return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Medium</Badge>;
  return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Low</Badge>;
}

export function ComplianceReviewCard({ document, selected, onSelectChange }: ComplianceReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
  const isPdf = !!document.original_file_name?.toLowerCase().endsWith('.pdf');
  const queryClient = useQueryClient();

  const preview = useReviewDocumentPreview({
    expanded: isExpanded,
    isPdf,
    fileUrl: document.file_url,
  });

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

  useEffect(() => {
    if (!isRateLimited) return;
    const timer = setTimeout(() => { handleRetry(); }, 60_000);
    return () => clearTimeout(timer);
  }, [isRateLimited, handleRetry]);

  useEffect(() => {
    if (needsManualClassification) {
      setIsExpanded(true);
    } else if (isActionable && (docTypeConfidence < 0.7 || propertyConfidence < 0.7 || !document.ai_suggested_property_id)) {
      setIsExpanded(true);
    }
  }, [isActionable, docTypeConfidence, propertyConfidence, document.ai_suggested_property_id, needsManualClassification]);

  const handleAccept = async () => {
    if (!selectedDocType) return;
    if (!selectedPropertyId) { setIsExpanded(true); return; }

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
    !!selectedPropertyId;

  const canAcceptManually = !!(needsManualClassification && selectedDocType && selectedPropertyId);

  return (
    <Card className={`bg-card border-border ${!selectedPropertyId && isActionable ? 'border-amber-500/50' : ''}`}>
      <CardContent className="p-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-start gap-4">
            {onSelectChange && (
              <input
                type="checkbox"
                checked={selected ?? false}
                onChange={(e) => onSelectChange(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border"
              />
            )}

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

            <ReviewCardActions
              isExpanded={isExpanded}
              isProcessing={isProcessing}
              isRetrying={isRetrying}
              isFailed={isFailed}
              isRateLimited={isRateLimited}
              hasTimedOut={hasTimedOut}
              isCreditsExhausted={isCreditsExhausted}
              isActionable={isActionable}
              canAcceptManually={canAcceptManually}
              isReadyForConfirm={isReadyForConfirm}
              selectedDocType={selectedDocType}
              selectedPropertyId={selectedPropertyId}
              onRetry={handleRetry}
              onDelete={handleDelete}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          </div>

          <CollapsibleContent className="mt-4 pt-4 border-t border-border">
            {document.file_url && (
              <DocumentPreviewPanel
                fileName={document.original_file_name}
                isPdf={isPdf}
                openHref={preview.openHref}
                pdfBlob={preview.pdfBlob}
                pdfBlobLoading={preview.pdfBlobLoading}
                pdfBlobError={preview.pdfBlobError}
                previewUrl={preview.previewUrl}
                previewSignedLoading={preview.previewSignedLoading}
              />
            )}

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

            <ReviewFormFields
              document={document}
              properties={properties}
              selectedDocType={selectedDocType}
              setSelectedDocType={setSelectedDocType}
              selectedPropertyId={selectedPropertyId}
              setSelectedPropertyId={setSelectedPropertyId}
              issueDate={issueDate}
              setIssueDate={setIssueDate}
              expiryDate={expiryDate}
              setExpiryDate={setExpiryDate}
              docTypeConfidence={docTypeConfidence}
              propertyConfidence={propertyConfidence}
              suggestedProperty={suggestedProperty}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
