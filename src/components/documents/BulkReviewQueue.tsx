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
import { Check, X, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

  const persistRow = async (item: QueueItem, decision: RowDecision) => {
    const update: Record<string, unknown> = {
      category: decision.finalCategory || 'other',
      review_status: 'accepted',
    };
    if (decision.propertyId) update.property_id = decision.propertyId;
    if (decision.tenantId) update.tenant_id = decision.tenantId;
    const { error } = await supabaseAny
      .from('documents')
      .update(update)
      .eq('id', item.documentId!);
    if (error) throw error;
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
      toast.error(`Failed to approve: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  };

  const handleSkip = (id: string) => updateDecision(id, { status: 'skipped' });

  const handleDiscard = async (item: QueueItem) => {
    if (!item.documentId) return;
    try {
      // Soft delete by setting review_status; mirrors the inbox "discard" flow.
      await supabaseAny
        .from('documents')
        .update({ review_status: 'discarded' })
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

  const pendingCount = Object.values(decisions).filter((d) => d.status === 'pending').length;
  const confidentPending = reviewable.filter(
    (i) => isConfident(i) && decisions[i.id]?.status === 'pending',
  ).length;

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
          <p className="text-xs text-muted-foreground mt-0.5">
            {pendingCount} pending · {confidentPending} confident
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">File</th>
                <th className="px-3 py-2 text-left">Filename hint</th>
                <th className="px-3 py-2 text-left">AI hint</th>
                <th className="px-3 py-2 text-left">Final category</th>
                <th className="px-3 py-2 text-left">Property</th>
                <th className="px-3 py-2 text-left">Tenant</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewable.map((item) => {
                const d = decisions[item.id];
                if (!d) return null;
                const confident = isConfident(item);
                const rowDim = d.status !== 'pending' ? 'opacity-50' : '';
                return (
                  <tr key={item.id} className={`border-t ${rowDim}`}>
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
      </CardContent>
    </Card>
  );
}
