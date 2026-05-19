/**
 * BulkReviewQueue — batched review screen for the Bulk Document Scanner v2.
 *
 * After all uploads + AI extraction complete, this table lets the landlord
 * triage the whole batch in one place: confirm category, attach property
 * (and optionally tenant), then bulk-approve everything that's confident.
 *
 * "Confident" = filename hint matches AI hint AND a property was suggested.
 * Per row, "Review separately" navigates back to the single-document
 * extraction-review modal flow so the existing single-file path is unchanged.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, ArrowRight, Sparkles, AlertTriangle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { QueueItem } from '@/hooks/useBulkDocumentUpload';

interface PropertyLite {
  id: string;
  address_line_1?: string | null;
  postcode?: string | null;
}

interface TenantLite {
  id: string;
  first_name: string;
  last_name: string;
}

const CATEGORY_OPTIONS = [
  { value: 'gas_safety_certificate', label: 'Gas Safety Certificate' },
  { value: 'electrical_certificate', label: 'EICR / Electrical' },
  { value: 'epc', label: 'EPC' },
  { value: 'fire_alarm_certificate', label: 'Fire / Alarm' },
  { value: 'pat_certificate', label: 'PAT' },
  { value: 'legionella_risk_assessment', label: 'Legionella' },
  { value: 'building_insurance', label: 'Building Insurance' },
  { value: 'tenancy_agreement', label: 'Tenancy Agreement' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'hmo_licence', label: 'HMO Licence' },
  { value: 'property_survey', label: 'Property Survey' },
  { value: 'valuation_report', label: 'Valuation' },
  { value: 'floorplan', label: 'Floor Plan' },
  { value: 'other', label: 'Other' },
];

interface RowDecision {
  finalCategory: string;
  propertyId: string | null;
  tenantId: string | null;
  status: 'pending' | 'approved' | 'skipped' | 'discarded';
}

interface BulkReviewQueueProps {
  items: QueueItem[];
  properties: PropertyLite[];
  tenants?: TenantLite[];
  onDone: () => void;
}

function pickDefaultCategory(item: QueueItem): string {
  // 1. AI hint if reasonably confident
  if (item.classification.category && item.classification.confidence >= 0.7) {
    return item.classification.category;
  }
  // 2. Filename hint
  if (item.filenameHint?.category) return item.filenameHint.category;
  // 3. AI hint at any confidence
  if (item.classification.category) return item.classification.category;
  return '';
}

export function BulkReviewQueue({ items, properties, tenants = [], onDone }: BulkReviewQueueProps) {
  const reviewable = useMemo(
    () => items.filter((i) => i.status === 'done' && i.documentId),
    [items],
  );

  const [decisions, setDecisions] = useState<Record<string, RowDecision>>(() => {
    const init: Record<string, RowDecision> = {};
    for (const item of reviewable) {
      init[item.id] = {
        finalCategory: pickDefaultCategory(item),
        propertyId: item.matchedPropertyId ?? item.selectedPropertyId ?? null,
        tenantId: null,
        status: 'pending',
      };
    }
    return init;
  });

  const [busy, setBusy] = useState(false);

  const updateDecision = (id: string, patch: Partial<RowDecision>) =>
    setDecisions((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const isConfident = (item: QueueItem): boolean => {
    const aiCat = item.classification.category;
    const fnCat = item.filenameHint?.category;
    return Boolean(aiCat && fnCat && aiCat === fnCat);
  };

  /**
   * Low-confidence = anything that warrants a human eye:
   *   - AI category confidence below 0.7
   *   - any extracted field below 0.6
   *   - filename hint and AI hint disagree
   *   - no property could be auto-matched
   * Surfaced as a row highlight and a "Needs review" filter.
   */
  const isLowConfidence = (item: QueueItem): boolean => {
    if (item.classification.confidence > 0 && item.classification.confidence < 0.7) return true;
    const fieldVals = Object.values(item.extraction.fieldConfidences || {});
    if (fieldVals.some((c) => c > 0 && c < 0.6)) return true;
    const aiCat = item.classification.category;
    const fnCat = item.filenameHint?.category;
    if (aiCat && fnCat && aiCat !== fnCat) return true;
    if (!item.matchedPropertyId && !item.selectedPropertyId) return true;
    return false;
  };

  const persistRow = async (item: QueueItem, decision: RowDecision) => {
    // doc_type is the canonical column the rest of the app reads (compliance pipeline,
    // documents vault, AI bridge). category is a legacy free-text label kept in sync.
    const update: Record<string, unknown> = {
      doc_type: decision.finalCategory || 'other',
      category: decision.finalCategory || 'other',
      review_status: 'accepted',
    };
    if (decision.propertyId) update.property_id = decision.propertyId;
    if (decision.tenantId) update.tenant_id = decision.tenantId;
    const { data, error, status, statusText } = await supabaseAny
      .from('documents')
      .update(update)
      .eq('id', item.documentId!)
      .select('id');
    if (error) {
      // Surface the real PostgREST error rather than a generic "unknown".
      const detail =
        error.message ||
        (error as { details?: string }).details ||
        (error as { hint?: string }).hint ||
        `${status} ${statusText}` ||
        'unknown';
      console.error('[BulkReviewQueue] update failed', { error, update, id: item.documentId });
      throw new Error(detail);
    }
    if (!data || data.length === 0) {
      throw new Error('No row updated — check you still have access to this document');
    }
  };

  const handleApprove = async (item: QueueItem) => {
    const d = decisions[item.id];
    if (!d?.finalCategory) {
      toast.error('Choose a category first');
      return;
    }
    try {
      await persistRow(item, d);
      updateDecision(item.id, { status: 'approved' });
      toast.success(`Approved ${item.file.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to approve: ${msg}`);
    }
  };

  const handleSkip = (id: string) => updateDecision(id, { status: 'skipped' });

  const handleDiscard = async (item: QueueItem) => {
    if (!item.documentId) return;
    try {
      // Soft delete by setting review_status; mirrors the inbox "discard" flow.
      await supabaseAny
        .from('documents')
        .update({ review_status: 'rejected' })
        .eq('id', item.documentId);
      // Also remove the file from storage to free quota.
      if (item.storagePath) {
        await supabase.storage.from('documents').remove([item.storagePath]);
      }
      updateDecision(item.id, { status: 'discarded' });
      toast.success(`Discarded ${item.file.name}`);
    } catch (e) {
      toast.error(`Discard failed: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  };

  const handleApproveAllConfident = async () => {
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const item of reviewable) {
      const d = decisions[item.id];
      if (!d || d.status !== 'pending') continue;
      if (!isConfident(item)) continue;
      if (!d.finalCategory) continue;
      try {
        await persistRow(item, d);
        updateDecision(item.id, { status: 'approved' });
        ok++;
      } catch {
        fail++;
      }
    }
    setBusy(false);
    if (ok) toast.success(`Approved ${ok} confident document${ok === 1 ? '' : 's'}`);
    if (fail) toast.error(`${fail} failed to approve`);
  };

  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  const pendingCount = Object.values(decisions).filter((d) => d.status === 'pending').length;
  const confidentPending = reviewable.filter(
    (i) => isConfident(i) && decisions[i.id]?.status === 'pending',
  ).length;
  const needsReviewCount = reviewable.filter(
    (i) => isLowConfidence(i) && decisions[i.id]?.status === 'pending',
  ).length;

  const visibleItems = onlyNeedsReview
    ? reviewable.filter((i) => isLowConfidence(i))
    : reviewable;

  if (reviewable.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Nothing to review — upload some documents first.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="sticky top-0 z-10 bg-card border-b flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Review Queue</CardTitle>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{pendingCount} pending</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {confidentPending} confident
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span className={needsReviewCount > 0 ? 'text-amber-600 font-medium' : ''}>
                {needsReviewCount} need review
              </span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Switch
              id="only-needs-review"
              checked={onlyNeedsReview}
              onCheckedChange={setOnlyNeedsReview}
              aria-label="Show only items that need review"
            />
            <Label htmlFor="only-needs-review" className="text-xs cursor-pointer">
              Only needs review
            </Label>
          </div>
          <Button
            size="sm"
            variant="default"
            disabled={busy || confidentPending === 0}
            onClick={handleApproveAllConfident}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Approve all confident ({confidentPending})
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Done
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <TooltipProvider delayDuration={150}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">File</th>
                <th className="px-3 py-2 text-left">Filename hint</th>
                <th className="px-3 py-2 text-left">AI hint</th>
                <th className="px-3 py-2 text-left">Extracted</th>
                <th className="px-3 py-2 text-left">Final category</th>
                <th className="px-3 py-2 text-left">Property</th>
                <th className="px-3 py-2 text-left">Tenant</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    Nothing matches the current filter.
                  </td>
                </tr>
              )}
              {visibleItems.map((item) => {
                const d = decisions[item.id];
                if (!d) return null;
                const confident = isConfident(item);
                const lowConf = isLowConfidence(item);
                const isPending = d.status === 'pending';
                const rowClass = cn(
                  'border-t border-l-2 transition-colors',
                  !isPending && 'opacity-50',
                  isPending && lowConf
                    ? 'border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                    : 'border-l-transparent',
                );
                return (
                  <tr key={item.id} className={rowClass}>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-start gap-2">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            className="h-10 w-10 rounded object-cover border"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted border flex items-center justify-center text-[10px] text-muted-foreground">
                            {item.file.name.split('.').pop()?.toUpperCase() ?? 'DOC'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate max-w-[200px]" title={item.file.name}>
                            {item.file.name}
                          </div>
                          {item.relativePath && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                              {item.relativePath}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {item.filenameHint?.category ? (
                        <Badge variant="outline" className="text-[11px]">
                          {item.filenameHint.category}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {item.classification.category ? (
                        <Badge
                          variant={confident ? 'default' : 'secondary'}
                          className="text-[11px]"
                        >
                          {item.classification.category}
                          {item.classification.confidence > 0 && (
                            <span className="ml-1 opacity-70">
                              {Math.round(item.classification.confidence * 100)}%
                            </span>
                          )}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <ExtractedFieldsCell extraction={item.extraction} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Select
                        value={d.finalCategory}
                        onValueChange={(v) => updateDecision(item.id, { finalCategory: v })}
                        disabled={d.status !== 'pending'}
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value} className="text-xs">
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Select
                        value={d.propertyId ?? ''}
                        onValueChange={(v) => updateDecision(item.id, { propertyId: v })}
                        disabled={d.status !== 'pending'}
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.address_line_1 ?? p.postcode ?? p.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Select
                        value={d.tenantId ?? ''}
                        onValueChange={(v) => updateDecision(item.id, { tenantId: v })}
                        disabled={d.status !== 'pending' || tenants.length === 0}
                      >
                        <SelectTrigger className="h-8 w-[160px] text-xs">
                          <SelectValue placeholder={tenants.length ? 'Optional' : '—'} />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              {t.first_name} {t.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      {d.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2 gap-1"
                            onClick={() => handleApprove(item)}
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => handleSkip(item.id)}
                          >
                            Skip
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive"
                            onClick={() => handleDiscard(item)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Link
                            to={`/inbox?doc=${item.documentId}`}
                            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 ml-1"
                          >
                            Review separately <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {d.status}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ExtractedFieldsCell — colour-coded confidence badges per extracted field.
// Threshold buckets:
//   ≥ 0.85  → "high"   (emerald)
//   ≥ 0.60  → "medium" (amber)
//   < 0.60  → "low"    (rose / destructive)
// Fields that weren't extracted at all are omitted.
// ---------------------------------------------------------------------------

interface ExtractionShape {
  address: string | null;
  postcode: string | null;
  expiryDate: string | null;
  issueDate: string | null;
  certificateNumber: string | null;
  rating: string | null;
  fieldConfidences: Record<string, number>;
}

const FIELD_LABELS: Array<{
  /** UI label */
  label: string;
  /** key on `extraction` */
  valueKey: keyof Omit<ExtractionShape, 'fieldConfidences'>;
  /** confidence-map key(s) the AI pipeline uses (first match wins) */
  confKeys: string[];
}> = [
  { label: 'Address', valueKey: 'address', confKeys: ['address'] },
  { label: 'Postcode', valueKey: 'postcode', confKeys: ['postcode'] },
  { label: 'Issued', valueKey: 'issueDate', confKeys: ['issue_date'] },
  { label: 'Expires', valueKey: 'expiryDate', confKeys: ['expiry_date'] },
  { label: 'Ref', valueKey: 'certificateNumber', confKeys: ['reference_number', 'certificate_number'] },
  { label: 'Rating', valueKey: 'rating', confKeys: ['epc_rating', 'rating'] },
];

function confidenceTier(c: number | undefined): 'none' | 'low' | 'medium' | 'high' {
  if (!c || c <= 0) return 'none';
  if (c >= 0.85) return 'high';
  if (c >= 0.6) return 'medium';
  return 'low';
}

const TIER_CLASS: Record<'none' | 'low' | 'medium' | 'high', string> = {
  none: 'border-border bg-muted text-muted-foreground',
  high: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  low: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

function ExtractedFieldsCell({ extraction }: { extraction: ExtractionShape }) {
  const populated = FIELD_LABELS.filter((f) => {
    const v = extraction[f.valueKey];
    return v !== null && v !== undefined && String(v).length > 0;
  });
  if (populated.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1 max-w-[260px]">
      {populated.map((f) => {
        const value = String(extraction[f.valueKey] ?? '');
        const conf =
          f.confKeys.map((k) => extraction.fieldConfidences?.[k]).find((c) => typeof c === 'number') ?? 0;
        const tier = confidenceTier(conf);
        const pct = conf > 0 ? `${Math.round(conf * 100)}%` : 'no score';
        return (
          <Tooltip key={f.label}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] leading-none max-w-[120px]',
                  TIER_CLASS[tier],
                )}
              >
                <span className="font-medium uppercase tracking-wide opacity-80">{f.label}</span>
                <span className="truncate" title={value}>
                  {value}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="font-medium">{f.label}</div>
              <div className="text-muted-foreground">Confidence: {pct}</div>
              <div className="max-w-[260px] break-words">{value}</div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
