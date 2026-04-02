import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, FileText, ChevronDown, ChevronUp, Clock, AlertTriangle } from 'lucide-react';
import { SEVERITY, TEXT } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import {
  useExtractionReviewQueue,
  useApproveExtraction,
  useRejectExtraction,
  type DocumentExtraction,
} from '@/hooks/useDocumentExtractions';

function confidenceLevel(confidence: number): 'critical' | 'warning' | 'success' {
  if (confidence < 0.5) return 'critical';
  if (confidence < 0.8) return 'warning';
  return 'success';
}

function ConfidenceBar({ confidence, label }: { confidence: number; label: string }) {
  const level = confidenceLevel(confidence);
  const severity = SEVERITY[level];
  const pct = Math.round(confidence * 100);

  return (
    <div className="flex items-center gap-2">
      <span className={cn(TEXT.label, 'w-32 shrink-0')}>{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', severity.dot)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-xs font-medium w-10 text-right', severity.text)}>{pct}%</span>
    </div>
  );
}

function ExtractionCard({ extraction }: { extraction: DocumentExtraction }) {
  const [expanded, setExpanded] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, string | null>>(
    () => ({ ...extraction.extracted_fields })
  );

  const approve = useApproveExtraction();
  const reject = useRejectExtraction();

  const isPending = approve.isPending || reject.isPending;

  const handleFieldChange = (key: string, value: string) => {
    setEditedFields(prev => ({ ...prev, [key]: value || null }));
  };

  const handleApprove = () => {
    approve.mutate({ extractionId: extraction.id, editedFields });
  };

  const handleReject = () => {
    reject.mutate(extraction.id);
  };

  const docTypeLevel = confidenceLevel(extraction.doc_type_confidence ?? 0);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className={TEXT.cardTitle}>{extraction.doc_type?.replace(/_/g, ' ') ?? 'Unknown'}</p>
              <p className={TEXT.caption}>ID: {extraction.document_id.slice(0, 8)}...</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={SEVERITY[docTypeLevel].badge}>
              {Math.round((extraction.doc_type_confidence ?? 0) * 100)}% match
            </Badge>
            {extraction.processing_time_ms && (
              <span className={cn(TEXT.caption, 'flex items-center gap-1')}>
                <Clock className="h-3 w-3" />
                {(extraction.processing_time_ms / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>

        {/* Review reasons */}
        {extraction.review_reasons.length > 0 && (
          <div className={cn('rounded-md p-2', SEVERITY.warning.bg)}>
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className={cn('h-3.5 w-3.5', SEVERITY.warning.text)} />
              <span className={cn('text-xs font-medium', SEVERITY.warning.text)}>Review needed</span>
            </div>
            <ul className="space-y-0.5">
              {extraction.review_reasons.map((reason, i) => (
                <li key={i} className={cn(TEXT.caption, SEVERITY.warning.text)}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Confidence bars for fields that have values */}
        <div className="space-y-1.5">
          {extraction.doc_type_confidence != null && (
            <ConfidenceBar confidence={extraction.doc_type_confidence} label="Doc type" />
          )}
          {Object.entries(extraction.field_confidences).map(([key, conf]) => {
            if (conf <= 0) return null;
            return <ConfidenceBar key={key} confidence={conf} label={key.replace(/_/g, ' ')} />;
          })}
        </div>

        {/* Expandable field editor */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full justify-between"
        >
          <span className={TEXT.body}>
            {expanded ? 'Hide fields' : 'Edit extracted fields'}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {Object.entries(editedFields).map(([key, value]) => {
              const confidence = extraction.field_confidences[key] ?? 0;
              const level = confidence > 0 ? confidenceLevel(confidence) : 'neutral' as const;
              const borderClass = confidence > 0 ? SEVERITY[level].border : '';

              return (
                <div key={key} className="space-y-1">
                  <label className={TEXT.label}>{key.replace(/_/g, ' ')}</label>
                  <Input
                    value={value ?? ''}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    className={cn('h-8 text-sm', borderClass)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Page info */}
        {extraction.total_pages > 0 && (
          <p className={TEXT.caption}>
            Processed {extraction.pages_processed} of {extraction.total_pages} page{extraction.total_pages !== 1 ? 's' : ''}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            disabled={isPending}
            className="gap-1.5"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isPending}
            className="gap-1.5"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExtractionReviewQueue() {
  const { data: extractions, isLoading, error } = useExtractionReviewQueue();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className={TEXT.sectionHeading}>Extraction Review Queue</h2>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('rounded-lg p-4', SEVERITY.critical.bg)}>
        <p className={cn(TEXT.body, SEVERITY.critical.text)}>
          Failed to load review queue: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  const items = extractions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={TEXT.sectionHeading}>Extraction Review Queue</h2>
        {items.length > 0 && (
          <Badge className={SEVERITY.warning.badge}>{items.length} pending</Badge>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className={TEXT.body}>No documents need review</p>
            <p className={TEXT.caption}>All extractions have been processed with high confidence</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(extraction => (
            <ExtractionCard key={extraction.id} extraction={extraction} />
          ))}
        </div>
      )}
    </div>
  );
}
