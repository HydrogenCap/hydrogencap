import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COST_CATEGORIES, type CostCategory } from '@/hooks/useWorkOrders';
import type { WorkOrderDetailState } from '../hooks/useWorkOrderDetailState';

export function WorkOrderDialogs({ state }: { state: WorkOrderDetailState }) {
  const {
    showApprove, setShowApprove, approvedBudget, setApprovedBudget, approveWO, handleApprove,
    showReject, setShowReject, rejectReason, setRejectReason, rejectWO, handleReject,
    showInvoice, setShowInvoice, invoiceRef, setInvoiceRef, invoiceAmount, setInvoiceAmount, updateWO, handleRecordInvoice,
    showAddCost, setShowAddCost, costForm, setCostForm, addCost, handleAddCost,
  } = state;

  return (
    <>
      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Work Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Approved Budget (£)</Label>
              <Input type="number" step="0.01" value={approvedBudget} onChange={e => setApprovedBudget(e.target.value)} />
            </div>
            <Button onClick={handleApprove} disabled={!approvedBudget || approveWO.isPending}>
              {approveWO.isPending ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Work Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
            </div>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason || rejectWO.isPending}>
              {rejectWO.isPending ? 'Rejecting...' : 'Reject'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Invoice Reference</Label><Input value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} /></div>
            <div><Label>Invoice Amount (£)</Label><Input type="number" step="0.01" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} /></div>
            <Button onClick={handleRecordInvoice} disabled={updateWO.isPending}>
              {updateWO.isPending ? 'Recording...' : 'Record Invoice'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddCost} onOpenChange={setShowAddCost}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Cost Item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Description</Label><Input value={costForm.description} onChange={e => setCostForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div>
              <Label>Category</Label>
              <Select value={costForm.category} onValueChange={v => setCostForm(f => ({ ...f, category: v as CostCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COST_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Amount (£)</Label><Input type="number" step="0.01" value={costForm.amount} onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>VAT (£)</Label><Input type="number" step="0.01" value={costForm.vat_amount} onChange={e => setCostForm(f => ({ ...f, vat_amount: e.target.value }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={costForm.is_estimated} onChange={e => setCostForm(f => ({ ...f, is_estimated: e.target.checked }))} />
              Estimated (not actual)
            </label>
            <Button onClick={handleAddCost} disabled={!costForm.description || !costForm.amount || addCost.isPending}>
              {addCost.isPending ? 'Adding...' : 'Add Cost'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
