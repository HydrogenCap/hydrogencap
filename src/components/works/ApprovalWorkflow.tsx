import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatGBP, formatDateUK } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import {
  usePendingApprovals,
  useApproveWorkOrderLifecycle,
  useRejectWorkOrderLifecycle,
} from '@/hooks/useWorkOrderLifecycle';

interface ApprovalWorkflowProps {
  defaultThreshold?: number;
}

export function ApprovalWorkflow({ defaultThreshold = 500 }: ApprovalWorkflowProps) {
  const { data: pendingWOs, isLoading } = usePendingApprovals();
  const approve = useApproveWorkOrderLifecycle();
  const reject = useRejectWorkOrderLifecycle();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [approvedBudget, setApprovedBudget] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const selectedWO = (pendingWOs || []).find((w: any) => w.id === selectedId);

  const handleApprove = async () => {
    if (!selectedId || !approvedBudget) return;
    await approve.mutateAsync({ id: selectedId, approvedBudget: parseFloat(approvedBudget) });
    closeDialog();
  };

  const handleReject = async () => {
    if (!selectedId || !rejectReason) return;
    await reject.mutateAsync({ id: selectedId, reason: rejectReason });
    closeDialog();
  };

  const closeDialog = () => {
    setSelectedId(null);
    setAction(null);
    setApprovedBudget('');
    setRejectReason('');
  };

  if (isLoading) return null;
  if (!pendingWOs?.length) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            Pending Approvals ({pendingWOs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingWOs.map((wo: any) => {
            const overThreshold = wo.estimated_cost && wo.estimated_cost >= defaultThreshold;
            return (
              <div
                key={wo.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-muted-foreground">{wo.wo_number}</p>
                    {overThreshold && (
                      <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                        Over threshold
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{wo.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {wo.entity && <span>{wo.entity.entity_name}</span>}
                    {wo.property && <span>- {wo.property.address_line_1}</span>}
                    <span>- {formatDateUK(wo.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium">
                    {formatGBP(wo.estimated_cost)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedId(wo.id);
                      setApprovedBudget(String(wo.estimated_cost || ''));
                      setAction('approve');
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setSelectedId(wo.id);
                      setAction('reject');
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={action === 'approve'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Work Order</DialogTitle>
            <DialogDescription>
              Approve this work order to release it for scheduling and billing.
            </DialogDescription>
          </DialogHeader>
          {selectedWO && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-mono text-muted-foreground">{selectedWO.wo_number}</p>
                <p className="text-sm font-medium">{selectedWO.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Estimated: {formatGBP(selectedWO.estimated_cost)}
                </p>
              </div>
              <div>
                <Label>Approved Budget (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={approvedBudget}
                  onChange={e => setApprovedBudget(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Org approval threshold: {formatGBP(defaultThreshold)}
                </p>
              </div>
              <Button
                onClick={handleApprove}
                disabled={!approvedBudget || approve.isPending}
                className="w-full"
              >
                {approve.isPending ? 'Approving...' : 'Approve Work Order'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={action === 'reject'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Work Order</DialogTitle>
            <DialogDescription>
              Reject this work order and return it to the raiser with a reason.
            </DialogDescription>
          </DialogHeader>
          {selectedWO && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-mono text-muted-foreground">{selectedWO.wo_number}</p>
                <p className="text-sm font-medium">{selectedWO.title}</p>
              </div>
              <div>
                <Label>Reason for Rejection</Label>
                <Textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why this work order is being rejected..."
                />
              </div>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectReason || reject.isPending}
                className="w-full"
              >
                {reject.isPending ? 'Rejecting...' : 'Reject Work Order'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
