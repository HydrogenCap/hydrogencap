import { CheckCircle2, XCircle, Send, Play, FileText, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorkOrderDetailState } from '../hooks/useWorkOrderDetailState';

export function ActionButtons({ state }: { state: WorkOrderDetailState }) {
  const { wo, submitWO, updateWO, completeWO, openApproveFromBudget, setShowReject, setShowInvoice } = state;
  if (!wo) return null;
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:flex-wrap">
      {wo.status === 'draft' && (
        <Button size="sm" onClick={() => submitWO.mutate(wo.id)} disabled={submitWO.isPending} className="w-full lg:w-auto">
          <Send className="h-4 w-4 mr-1" /> Submit for Approval
        </Button>
      )}
      {wo.status === 'submitted' && (
        <>
          <Button size="sm" onClick={openApproveFromBudget} className="w-full lg:w-auto">
            <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setShowReject(true)} className="w-full lg:w-auto">
            <XCircle className="h-4 w-4 mr-1" /> Reject
          </Button>
        </>
      )}
      {wo.status === 'approved' && (
        <Button size="sm" onClick={() => updateWO.mutate({ id: wo.id, status: 'in_progress', actual_start_date: new Date().toISOString().split('T')[0] })} className="w-full lg:w-auto">
          <Play className="h-4 w-4 mr-1" /> Mark In Progress
        </Button>
      )}
      {wo.status === 'in_progress' && (
        <Button size="sm" onClick={() => completeWO.mutate({ id: wo.id })} disabled={completeWO.isPending} className="w-full lg:w-auto">
          <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
        </Button>
      )}
      {wo.status === 'completed' && (
        <Button size="sm" onClick={() => setShowInvoice(true)} className="w-full lg:w-auto">
          <FileText className="h-4 w-4 mr-1" /> Record Invoice
        </Button>
      )}
      {wo.status === 'invoiced' && (
        <Button size="sm" onClick={() => updateWO.mutate({ id: wo.id, status: 'closed', payment_status: 'paid' })} className="w-full lg:w-auto">
          <CreditCard className="h-4 w-4 mr-1" /> Mark Paid & Close
        </Button>
      )}
      {!['closed', 'cancelled', 'rejected'].includes(wo.status) && (
        <Button size="sm" variant="outline" onClick={() => updateWO.mutate({ id: wo.id, status: 'cancelled' })} className="w-full lg:w-auto lg:ml-auto">
          Cancel
        </Button>
      )}
    </div>
  );
}
