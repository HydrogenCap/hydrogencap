import { format } from 'date-fns';
import { CheckCircle2, AlertTriangle, Loader2, ExternalLink, FileText, Building2, Calendar, Tag } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import {
  COMPLIANCE_DOC_TYPE_LABELS,
  useAcceptComplianceDocument,
  useRejectComplianceDocument,
} from '@/hooks/useComplianceIntake';
import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { toast } from "sonner";

export interface ProcessingHistoryDoc {
  id: string;
  original_file_name: string | null;
  ai_suggested_doc_type: string | null;
  ai_doc_type_confidence: number | null;
  ai_suggested_property_id: string | null;
  ai_property_confidence: number | null;
  extraction_status: string | null;
  review_status: string | null;
  auto_filed: boolean | null;
  expiry_date: string | null;
  extracted_issue_date: string | null;
  extracted_address_text: string | null;
  validation_errors: unknown;
  validation_warnings: unknown;
  created_at: string | null;
}

interface RecentProcessingDetailSheetProps {
  doc: ProcessingHistoryDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatPct(value: number | null) {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

export function RecentProcessingDetailSheet({
  doc,
  open,
  onOpenChange,
}: RecentProcessingDetailSheetProps) {
  const navigate = useNavigate();
  const acceptDoc = useAcceptComplianceDocument();
  const rejectDoc = useRejectComplianceDocument();

  const { data: matchedProperty } = useQuery({
    queryKey: ['recent-processing-detail-property', doc?.ai_suggested_property_id],
    queryFn: async () => {
      if (!doc?.ai_suggested_property_id) return null;
      const { data, error } = await supabaseAny
        .from('properties_v2')
        .select('id, address_line_1, postcode')
        .eq('id', doc.ai_suggested_property_id)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; address_line_1: string; postcode: string } | null;
    },
    enabled: !!doc?.ai_suggested_property_id && open,
  });

  if (!doc) return null;

  const docTypeLabel = doc.ai_suggested_doc_type
    ? (COMPLIANCE_DOC_TYPE_LABELS[doc.ai_suggested_doc_type] || doc.ai_suggested_doc_type)
    : 'Unknown';

  const canApprove =
    !!doc.ai_suggested_doc_type &&
    !!doc.ai_suggested_property_id &&
    doc.review_status === 'pending';

  const handleApprove = async () => {
    if (!canApprove || !matchedProperty) return;
    try {
      await acceptDoc.mutateAsync({
        documentId: doc.id,
        docType: doc.ai_suggested_doc_type!,
        propertyId: doc.ai_suggested_property_id!,
        propertyAddress: matchedProperty.address_line_1,
        issueDate: doc.extracted_issue_date || null,
        expiryDate: doc.expiry_date || null,
        originalFilename: doc.original_file_name || 'document.pdf',
        fileUrl: '',
        notes: null,
        wasEdited: false,
        originalAiSuggestions: {
          docType: doc.ai_suggested_doc_type!,
          propertyId: doc.ai_suggested_property_id!,
          issueDate: doc.extracted_issue_date || null,
          expiryDate: doc.expiry_date || null,
        },
      });
      onOpenChange(false);
    } catch (err) {
      toast.error('Approval failed', { description: err instanceof Error ? err.message : 'Open in Inbox to review.' });
    }
  };

  const handleReject = async () => {
    try {
      await rejectDoc.mutateAsync(doc.id);
      onOpenChange(false);
    } catch {
      // toast handled inside hook
    }
  };

  const handleOverride = () => {
    onOpenChange(false);
    navigate('/inbox');
  };

  const hasErrors =
    Array.isArray(doc.validation_errors) && doc.validation_errors.length > 0;
  const hasWarnings =
    Array.isArray(doc.validation_warnings) && doc.validation_warnings.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            AI Extraction Detail
          </SheetTitle>
          <SheetDescription className="truncate">
            {doc.original_file_name || 'Untitled document'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5 text-sm">
          {/* Doc type */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Document type
              </span>
              <Badge variant="outline">
                Confidence {formatPct(doc.ai_doc_type_confidence)}
              </Badge>
            </div>
            <p className="font-medium">{docTypeLabel}</p>
          </div>

          <Separator />

          {/* Property match */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Matched property
              </span>
              <Badge variant="outline">
                Confidence {formatPct(doc.ai_property_confidence)}
              </Badge>
            </div>
            {matchedProperty ? (
              <div>
                <p className="font-medium">{matchedProperty.address_line_1}</p>
                {matchedProperty.postcode && (
                  <p className="text-xs text-muted-foreground">{matchedProperty.postcode}</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">
                {doc.extracted_address_text
                  ? `Extracted "${doc.extracted_address_text}" — no portfolio match`
                  : 'No match'}
              </p>
            )}
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5" /> Issue date
              </p>
              <p className="font-medium">
                {doc.extracted_issue_date
                  ? format(new Date(doc.extracted_issue_date), 'dd MMM yyyy')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5" /> Expiry date
              </p>
              <p className="font-medium">
                {doc.expiry_date
                  ? format(new Date(doc.expiry_date), 'dd MMM yyyy')
                  : '—'}
              </p>
            </div>
          </div>

          {(hasErrors || hasWarnings) && (
            <>
              <Separator />
              {hasErrors && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-xs font-semibold text-destructive flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Validation errors
                  </p>
                  <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                    {(doc.validation_errors as string[]).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {hasWarnings && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <p className="text-xs font-semibold text-amber-600 flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Warnings
                  </p>
                  <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                    {(doc.validation_warnings as string[]).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}

          {doc.review_status && doc.review_status !== 'pending' && (
            <div className="rounded-md bg-muted/50 p-3 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Already {doc.review_status}{doc.auto_filed ? ' (auto-filed)' : ''}.
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 flex-row gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={handleOverride} className="gap-1.5">
            <ExternalLink className="h-4 w-4" /> Override in Inbox
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={rejectDoc.isPending || doc.review_status !== 'pending'}
          >
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={!canApprove || acceptDoc.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {acceptDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default RecentProcessingDetailSheet;
