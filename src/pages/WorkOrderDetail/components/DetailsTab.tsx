import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { WO_CATEGORIES } from '@/hooks/useWorkOrders';
import { formatGBP, formatDateUK } from '../utils/format';
import type { WorkOrderDetailState } from '../hooks/useWorkOrderDetailState';

export function DetailsTab({ state }: { state: WorkOrderDetailState }) {
  const { wo } = state;
  if (!wo) return null;
  const isOverBudget = wo.actual_cost && wo.approved_budget && wo.actual_cost > wo.approved_budget;
  const budgetProgress = wo.approved_budget
    ? Math.min(((wo.actual_cost || wo.estimated_cost || 0) / wo.approved_budget) * 100, 150)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Budget vs Actual</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-xs text-muted-foreground">Estimated</p><p className="text-lg font-bold">{formatGBP(wo.estimated_cost)}</p></div>
              <div><p className="text-xs text-muted-foreground">Approved</p><p className="text-lg font-bold">{formatGBP(wo.approved_budget)}</p></div>
              <div><p className="text-xs text-muted-foreground">Actual</p>
                <p className={cn('text-lg font-bold', isOverBudget && 'text-destructive')}>{formatGBP(wo.actual_cost)}</p>
              </div>
            </div>
            {wo.approved_budget && (
              <div>
                <Progress value={Math.min(budgetProgress, 100)} className={cn('h-2', isOverBudget && '[&>div]:bg-destructive')} />
                {isOverBudget && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Over budget by {formatGBP((wo.actual_cost || 0) - wo.approved_budget)}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{WO_CATEGORIES.find(c => c.value === wo.category)?.label}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><span className="capitalize">{wo.priority}</span></div>
            {wo.target_start_date && <div className="flex justify-between"><span className="text-muted-foreground">Target Start</span><span>{formatDateUK(wo.target_start_date)}</span></div>}
            {wo.target_completion_date && <div className="flex justify-between"><span className="text-muted-foreground">Target Completion</span><span>{formatDateUK(wo.target_completion_date)}</span></div>}
            {wo.actual_completion_date && <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span>{formatDateUK(wo.actual_completion_date)}</span></div>}
            {wo.invoice_reference && <div className="flex justify-between"><span className="text-muted-foreground">Invoice Ref</span><span>{wo.invoice_reference}</span></div>}
            {wo.description && <div className="pt-2 border-t"><p className="text-muted-foreground text-xs mb-1">Description</p><p>{wo.description}</p></div>}
            {wo.internal_notes && <div className="pt-2 border-t"><p className="text-muted-foreground text-xs mb-1">Internal Notes</p><p>{wo.internal_notes}</p></div>}
          </CardContent>
        </Card>
      </div>

      {(wo.jobs || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Linked Jobs ({wo.jobs.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {wo.jobs.map(job => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="flex items-center justify-between py-2 px-2 rounded hover:bg-accent/50 transition-colors">
                  <span className="text-sm">{job.id.slice(0, 8)}...</span>
                  <div className="flex items-center gap-2">
                    {job.final_amount_gbp && <span className="text-sm">{formatGBP(job.final_amount_gbp)}</span>}
                    <Badge variant="outline" className="text-xs capitalize">{job.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {wo.maintenance_request_id && (
        <div className="text-sm">
          <Link to={`/maintenance/${wo.maintenance_request_id}`} className="text-primary hover:underline">
            View linked maintenance request →
          </Link>
        </div>
      )}
    </div>
  );
}
