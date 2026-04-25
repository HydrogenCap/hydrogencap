import { CheckCircle2, Circle, Clock, ArrowRight, XCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateUK } from '@/lib/calculations';
import {
  PIPELINE_STAGES,
  getPipelineStage,
  getPipelineStageIndex,
  useAdvanceWorkOrder,
  type PipelineStage,
} from '@/hooks/useWorkOrderLifecycle';
import type { WorkOrderWithDetails } from '@/hooks/useWorkOrders';

// Extended fields not yet in the WorkOrderWithDetails type
type WorkOrderWithApproval = WorkOrderWithDetails & {
  approval_required?: boolean | null;
  approval_threshold?: number | null;
};

interface WorkOrderPipelineProps {
  wo: WorkOrderWithDetails;
  onApprove?: () => void;
  onReject?: () => void;
}

const stageColors: Record<string, string> = {
  raised: 'bg-slate-500',
  pending_approval: 'bg-amber-500',
  approved: 'bg-emerald-500',
  contractor_assigned: 'bg-blue-500',
  scheduled: 'bg-indigo-500',
  in_progress: 'bg-orange-500',
  completed: 'bg-teal-500',
  signed_off: 'bg-green-600',
};

function getStageDates(wo: WorkOrderWithDetails, stage: PipelineStage): string | null {
  switch (stage) {
    case 'raised': return wo.created_at ? formatDateUK(wo.created_at) : null;
    case 'pending_approval': return wo.status === 'submitted' ? formatDateUK(wo.updated_at) : null;
    case 'approved': return wo.approved_at ? formatDateUK(wo.approved_at) : null;
    case 'scheduled': return wo.target_start_date ? formatDateUK(wo.target_start_date) : null;
    case 'in_progress': return wo.actual_start_date ? formatDateUK(wo.actual_start_date) : null;
    case 'completed': return wo.actual_completion_date ? formatDateUK(wo.actual_completion_date) : null;
    default: return null;
  }
}

export function WorkOrderPipeline({ wo, onApprove, onReject }: WorkOrderPipelineProps) {
  const advance = useAdvanceWorkOrder();
  const currentStage = getPipelineStage(wo);
  const currentIndex = getPipelineStageIndex(currentStage);
  const isCancelled = wo.status === 'cancelled';
  const isRejected = wo.status === 'rejected';
  const woExt = wo as WorkOrderWithApproval;
  const needsApproval = (woExt.approval_required || (wo.estimated_cost && wo.estimated_cost >= (woExt.approval_threshold || 500)))
    && currentStage === 'pending_approval';

  const getNextStage = (): PipelineStage | null => {
    if (isCancelled || isRejected) return null;
    if (currentStage === 'pending_approval') return null; // must go through approval
    const nextIdx = currentIndex + 1;
    if (nextIdx >= PIPELINE_STAGES.length) return null;
    // Skip pending_approval if not required
    const next = PIPELINE_STAGES[nextIdx];
    if (next.value === 'pending_approval' && !woExt.approval_required && !(wo.estimated_cost && wo.estimated_cost >= (woExt.approval_threshold || 500))) {
      return PIPELINE_STAGES[nextIdx + 1]?.value || null;
    }
    return next.value;
  };

  const nextStage = getNextStage();

  return (
    <div className="space-y-4">
      {/* Pipeline visual */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage, idx) => {
          const isComplete = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;
          const date = getStageDates(wo, stage.value);

          return (
            <div key={stage.value} className="flex items-center">
              <div className={cn(
                'flex flex-col items-center min-w-[90px]',
                isFuture && 'opacity-40',
              )}>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs',
                  isComplete && stageColors[stage.value],
                  isCurrent && cn(stageColors[stage.value], 'ring-2 ring-offset-2 ring-primary'),
                  isFuture && 'bg-muted text-muted-foreground',
                  (isCancelled || isRejected) && isCurrent && 'bg-destructive ring-destructive',
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                <span className={cn(
                  'text-[10px] mt-1 text-center leading-tight',
                  isCurrent && 'font-semibold',
                  isFuture && 'text-muted-foreground',
                )}>
                  {stage.label}
                </span>
                {date && (
                  <span className="text-[9px] text-muted-foreground">{date}</span>
                )}
              </div>
              {idx < PIPELINE_STAGES.length - 1 && (
                <div className={cn(
                  'w-6 h-0.5 mx-0.5',
                  idx < currentIndex ? 'bg-primary' : 'bg-muted',
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Status messages */}
      {isCancelled && (
        <Badge variant="destructive" className="text-xs">
          <XCircle className="h-3 w-3 mr-1" /> Cancelled
        </Badge>
      )}
      {isRejected && (
        <Badge variant="destructive" className="text-xs">
          <XCircle className="h-3 w-3 mr-1" /> Rejected{wo.rejected_reason ? `: ${wo.rejected_reason}` : ''}
        </Badge>
      )}

      {/* Approval gate */}
      {needsApproval && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
          <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">Approval required</p>
            <p className="text-amber-700 dark:text-amber-400 text-xs">
              Estimated cost ({new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(wo.estimated_cost || 0)}) exceeds approval threshold ({new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(woExt.approval_threshold || 500)})
            </p>
          </div>
          <div className="flex gap-2">
            {onApprove && (
              <Button size="sm" onClick={onApprove}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
              </Button>
            )}
            {onReject && (
              <Button size="sm" variant="destructive" onClick={onReject}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Advance button */}
      {nextStage && !isCancelled && !isRejected && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => advance.mutate({ id: wo.id, targetStage: nextStage })}
          disabled={advance.isPending}
        >
          <ArrowRight className="h-3.5 w-3.5 mr-1" />
          Advance to {PIPELINE_STAGES.find(s => s.value === nextStage)?.label}
        </Button>
      )}
    </div>
  );
}
