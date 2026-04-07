import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Circle, ArrowRight, Calendar, FileText, X } from 'lucide-react';
import {
  type MortgageApplicationWithProperty,
  useUpdateApplicationStatus,
  PIPELINE_STAGES,
  STAGE_DOCUMENTS,
  APPLICATION_STATUSES,
} from '@/hooks/useRefinanceWorkflow';
import { fmtGBP, fmtDate } from '@/hooks/useLoanFacilities';

interface Props {
  application: MortgageApplicationWithProperty;
}

const STATUS_ORDER = APPLICATION_STATUSES.map((s) => s.value);

function getStageIndex(status: string): number {
  const idx = PIPELINE_STAGES.findIndex((s) => s.value === status);
  if (status === 'researching') return -1;
  if (status === 'dip_approved') return 0;
  if (status === 'valuation_received') return 2;
  if (status === 'offer_accepted') return 3;
  if (status === 'withdrawn') return -2;
  return idx;
}

function isStageCompleted(currentStatus: string, stageValue: string): boolean {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus as any);
  const stageIdx = STATUS_ORDER.indexOf(stageValue as any);
  return stageIdx >= 0 && currentIdx > stageIdx;
}

function isStageCurrent(currentStatus: string, stageValue: string): boolean {
  if (currentStatus === stageValue) return true;
  if (currentStatus === 'dip_approved' && stageValue === 'dip_submitted') return true;
  if (currentStatus === 'valuation_received' && stageValue === 'valuation_instructed') return true;
  if (currentStatus === 'offer_accepted' && stageValue === 'offer_issued') return true;
  return false;
}

export function ApplicationTracker({ application }: Props) {
  const updateStatus = useUpdateApplicationStatus();
  const [notes, setNotes] = useState(application.notes || '');
  const [editingNotes, setEditingNotes] = useState(false);

  const isWithdrawn = application.status === 'withdrawn';
  const isCompleted = application.status === 'completed';

  const nextStatus = (() => {
    if (isWithdrawn || isCompleted) return null;
    const idx = STATUS_ORDER.indexOf(application.status);
    if (idx < 0 || idx >= STATUS_ORDER.length - 2) return null;
    return STATUS_ORDER[idx + 1];
  })();

  const nextLabel = nextStatus
    ? APPLICATION_STATUSES.find((s) => s.value === nextStatus)?.label
    : null;

  const handleAdvance = () => {
    if (!nextStatus) return;
    const dateUpdates: Record<string, string> = {};
    const now = new Date().toISOString().split('T')[0];

    if (nextStatus === 'dip_submitted') dateUpdates.dip_submitted_at = now;
    if (nextStatus === 'dip_approved') dateUpdates.dip_approved_at = now;
    if (nextStatus === 'full_app') dateUpdates.full_app_submitted_at = now;
    if (nextStatus === 'valuation_instructed') dateUpdates.valuation_date = now;
    if (nextStatus === 'offer_issued') dateUpdates.offer_date = now;
    if (nextStatus === 'completed') dateUpdates.completed_at = now;

    updateStatus.mutate({
      id: application.id,
      status: nextStatus,
      ...dateUpdates,
    } as any);
  };

  const handleSaveNotes = () => {
    updateStatus.mutate({ id: application.id, notes } as any);
    setEditingNotes(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{application.property_address}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {application.lender_name || 'No lender'} ·{' '}
              {application.product_rate != null
                ? `${application.product_rate}%`
                : 'Rate TBC'}{' '}
              · {fmtGBP(application.loan_amount ?? 0)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {application.monthly_saving != null && application.monthly_saving > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Saving {fmtGBP(application.monthly_saving)}/mo
              </Badge>
            )}
            <Badge
              className={
                isWithdrawn
                  ? 'bg-muted text-muted-foreground'
                  : isCompleted
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }
            >
              {APPLICATION_STATUSES.find((s) => s.value === application.status)?.label ||
                application.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pipeline Steps */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage, idx) => {
            const completed = isStageCompleted(application.status, stage.value);
            const current = isStageCurrent(application.status, stage.value);
            const dateValue = (application as any)[stage.dateField];

            return (
              <div key={stage.value} className="flex items-center">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      completed
                        ? 'bg-emerald-500 text-white'
                        : current
                          ? 'bg-blue-500 text-white ring-2 ring-blue-200'
                          : isWithdrawn
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {completed ? (
                      <Check className="h-4 w-4" />
                    ) : current ? (
                      <Circle className="h-3 w-3 fill-current" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] mt-1 text-center ${current ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                  >
                    {stage.label}
                  </span>
                  {dateValue && (
                    <span className="text-[9px] text-muted-foreground">
                      {fmtDate(dateValue)}
                    </span>
                  )}
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground mx-1 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Date Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {application.dip_submitted_at && (
            <div>
              <p className="text-xs text-muted-foreground">DIP Submitted</p>
              <p className="font-medium">{fmtDate(application.dip_submitted_at)}</p>
            </div>
          )}
          {application.offer_date && (
            <div>
              <p className="text-xs text-muted-foreground">Offer Date</p>
              <p className="font-medium">{fmtDate(application.offer_date)}</p>
            </div>
          )}
          {application.completion_target && (
            <div>
              <p className="text-xs text-muted-foreground">Target Completion</p>
              <p className="font-medium">{fmtDate(application.completion_target)}</p>
            </div>
          )}
          {application.completed_at && (
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="font-medium">{fmtDate(application.completed_at)}</p>
            </div>
          )}
        </div>

        {/* Document Checklist */}
        {!isCompleted && !isWithdrawn && STAGE_DOCUMENTS[application.status] && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              Documents Needed
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {STAGE_DOCUMENTS[application.status].map((doc) => (
                <div
                  key={doc}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Circle className="h-3 w-3 shrink-0" />
                  {doc}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-sm">Notes</Label>
            {!editingNotes && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingNotes(true)}
              >
                Edit
              </Button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add notes about this application..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNotes} disabled={updateStatus.isPending}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNotes(application.notes || '');
                    setEditingNotes(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {application.notes || 'No notes yet.'}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {nextStatus && (
            <Button
              size="sm"
              onClick={handleAdvance}
              disabled={updateStatus.isPending}
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Advance to {nextLabel}
            </Button>
          )}
          {!isWithdrawn && !isCompleted && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600"
              disabled={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate({ id: application.id, status: 'withdrawn' } as any)
              }
            >
              <X className="h-4 w-4 mr-1" /> Withdraw
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
