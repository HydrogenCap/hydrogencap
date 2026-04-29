import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Send, Play, FileText, CreditCard, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingState, MobileDetailsSheet } from '@/components/common';
import { formatGBP, formatDateUK } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import {
  useWorkOrder,
  useSubmitWorkOrder,
  useApproveWorkOrder,
  useRejectWorkOrder,
  useUpdateWorkOrder,
  useCompleteWorkOrder,
  useAddCostItem,
  useDeleteCostItem,
  WO_STATUSES,
  WO_CATEGORIES,
  COST_CATEGORIES,
  type CostCategory,
} from '@/hooks/useWorkOrders';
import { WorkOrderPipeline } from '@/components/works/WorkOrderPipeline';
import { ApprovalWorkflow } from '@/components/works/ApprovalWorkflow';
import { MaterialTracker } from '@/components/works/MaterialTracker';
import { WarrantyTracker } from '@/components/works/WarrantyTracker';

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: wo, isLoading } = useWorkOrder(id);

  const submitWO = useSubmitWorkOrder();
  const approveWO = useApproveWorkOrder();
  const rejectWO = useRejectWorkOrder();
  const updateWO = useUpdateWorkOrder();
  const completeWO = useCompleteWorkOrder();
  const addCost = useAddCostItem();
  const deleteCost = useDeleteCostItem();

  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showAddCost, setShowAddCost] = useState(false);
  const [approvedBudget, setApprovedBudget] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [costForm, setCostForm] = useState({
    description: '',
    category: 'labour' as CostCategory,
    amount: '',
    vat_amount: '',
    is_estimated: false,
  });

  if (isLoading) return <AppLayout><LoadingState text="Loading work order..." /></AppLayout>;
  if (!wo) return <AppLayout><div className="container py-6">Work order not found.</div></AppLayout>;

  const statusConfig = WO_STATUSES.find(s => s.value === wo.status);
  const isOverBudget = wo.actual_cost && wo.approved_budget && wo.actual_cost > wo.approved_budget;
  const budgetProgress = wo.approved_budget
    ? Math.min(((wo.actual_cost || wo.estimated_cost || 0) / wo.approved_budget) * 100, 150)
    : 0;

  const costTotal = (wo.cost_items || []).reduce((s, i) => s + i.amount + (i.vat_amount || 0), 0);

  const handleApprove = async () => {
    if (!approvedBudget) return;
    await approveWO.mutateAsync({ id: wo.id, approvedBudget: parseFloat(approvedBudget) });
    setShowApprove(false);
  };

  const handleReject = async () => {
    if (!rejectReason) return;
    await rejectWO.mutateAsync({ id: wo.id, reason: rejectReason });
    setShowReject(false);
  };

  const handleRecordInvoice = async () => {
    await updateWO.mutateAsync({
      id: wo.id,
      status: 'invoiced',
      invoice_reference: invoiceRef || null,
      invoice_amount: invoiceAmount ? parseFloat(invoiceAmount) : null,
      invoice_date: new Date().toISOString().split('T')[0],
    });
    setShowInvoice(false);
  };

  const handleAddCost = async () => {
    if (!costForm.description || !costForm.amount) return;
    await addCost.mutateAsync({
      work_order_id: wo.id,
      description: costForm.description,
      category: costForm.category,
      amount: parseFloat(costForm.amount),
      vat_amount: costForm.vat_amount ? parseFloat(costForm.vat_amount) : 0,
      is_estimated: costForm.is_estimated,
    });
    setCostForm({ description: '', category: 'labour', amount: '', vat_amount: '', is_estimated: false });
    setShowAddCost(false);
  };

  const actionButtons = (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:flex-wrap">
      {wo.status === 'draft' && (
        <Button size="sm" onClick={() => submitWO.mutate(wo.id)} disabled={submitWO.isPending} className="w-full lg:w-auto">
          <Send className="h-4 w-4 mr-1" /> Submit for Approval
        </Button>
      )}
      {wo.status === 'submitted' && (
        <>
          <Button size="sm" onClick={() => { setApprovedBudget(String(wo.estimated_cost || '')); setShowApprove(true); }} className="w-full lg:w-auto">
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

  return (
    <AppLayout>
      <div className="container py-6 space-y-6 pb-24 lg:pb-6">
        {/* Back + Header */}
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/work-orders')} className="mb-2" aria-label="Back to work orders">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-mono text-muted-foreground">{wo.wo_number}</p>
              <h1 className="text-2xl font-bold break-words">{wo.title}</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-muted-foreground">
                {wo.entity && <span>{wo.entity.entity_name}</span>}
                {wo.property && <span>• {wo.property.address_line_1}, {wo.property.city}</span>}
                {wo.room && <span>• {wo.room.room_name}</span>}
              </div>
            </div>
            <Badge className={cn('text-sm shrink-0 self-start', statusConfig?.color)}>
              {statusConfig?.label}
            </Badge>
          </div>
        </div>

        {/* Pipeline */}
        <Card>
          <CardContent className="py-4">
            <WorkOrderPipeline
              wo={wo}
              onApprove={wo.status === 'submitted' ? () => { setApprovedBudget(String(wo.estimated_cost || '')); setShowApprove(true); } : undefined}
              onReject={wo.status === 'submitted' ? () => setShowReject(true) : undefined}
            />
          </CardContent>
        </Card>

        {/* Approval section for pending work orders */}
        {wo.status === 'submitted' && (
          <ApprovalWorkflow defaultThreshold={(wo as { approval_threshold?: number }).approval_threshold || 500} />
        )}

        {/* Action Bar — desktop only; mobile uses bottom sheet */}
        <Card className="hidden lg:block">
          <CardContent className="py-3">{actionButtons}</CardContent>
        </Card>

        {/* Tabbed Content */}
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="overflow-x-auto max-w-full justify-start">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="warranty">Warranty</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Budget Progress */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Budget vs Actual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Estimated</p>
                      <p className="text-lg font-bold">{formatGBP(wo.estimated_cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Approved</p>
                      <p className="text-lg font-bold">{formatGBP(wo.approved_budget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Actual</p>
                      <p className={cn('text-lg font-bold', isOverBudget && 'text-destructive')}>
                        {formatGBP(wo.actual_cost)}
                      </p>
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

              {/* Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span>{WO_CATEGORIES.find(c => c.value === wo.category)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Priority</span>
                    <span className="capitalize">{wo.priority}</span>
                  </div>
                  {wo.target_start_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target Start</span>
                      <span>{formatDateUK(wo.target_start_date)}</span>
                    </div>
                  )}
                  {wo.target_completion_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target Completion</span>
                      <span>{formatDateUK(wo.target_completion_date)}</span>
                    </div>
                  )}
                  {wo.actual_completion_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span>{formatDateUK(wo.actual_completion_date)}</span>
                    </div>
                  )}
                  {wo.invoice_reference && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice Ref</span>
                      <span>{wo.invoice_reference}</span>
                    </div>
                  )}
                  {wo.description && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground text-xs mb-1">Description</p>
                      <p>{wo.description}</p>
                    </div>
                  )}
                  {wo.internal_notes && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground text-xs mb-1">Internal Notes</p>
                      <p>{wo.internal_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Linked Jobs */}
            {(wo.jobs || []).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Linked Jobs ({wo.jobs.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {wo.jobs.map(job => (
                      <Link
                        key={job.id}
                        to={`/jobs/${job.id}`}
                        className="flex items-center justify-between py-2 px-2 rounded hover:bg-accent/50 transition-colors"
                      >
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

            {/* Maintenance Request Link */}
            {wo.maintenance_request_id && (
              <div className="text-sm">
                <Link to={`/maintenance/${wo.maintenance_request_id}`} className="text-primary hover:underline">
                  View linked maintenance request →
                </Link>
              </div>
            )}
          </TabsContent>

          {/* Costs Tab */}
          <TabsContent value="costs" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">Cost Items ({wo.cost_items?.length || 0})</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatGBP(costTotal)}</span>
                  <Button size="sm" variant="outline" onClick={() => setShowAddCost(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(wo.cost_items || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No cost items yet</p>
                ) : (
                  <div className="space-y-2">
                    {wo.cost_items.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {COST_CATEGORIES.find(c => c.value === item.category)?.label}
                            {item.is_estimated && ' - Estimated'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{formatGBP(item.amount + (item.vat_amount || 0))}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteCost.mutate({ id: item.id, workOrderId: wo.id })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Materials Tab */}
          <TabsContent value="materials" className="space-y-6">
            <MaterialTracker workOrderId={wo.id} approvedBudget={wo.approved_budget} />
          </TabsContent>

          {/* Warranty Tab */}
          <TabsContent value="warranty" className="space-y-6">
            <WarrantyTracker workOrderId={wo.id} propertyId={wo.property_id} />
          </TabsContent>
        </Tabs>
      </div>

      <MobileDetailsSheet title="Work Order Actions" triggerLabel="Actions">
        {actionButtons}
      </MobileDetailsSheet>

      {/* Approve Dialog */}
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

      {/* Reject Dialog */}
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

      {/* Invoice Dialog */}
      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Invoice Reference</Label>
              <Input value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} />
            </div>
            <div>
              <Label>Invoice Amount (£)</Label>
              <Input type="number" step="0.01" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)} />
            </div>
            <Button onClick={handleRecordInvoice} disabled={updateWO.isPending}>
              {updateWO.isPending ? 'Recording...' : 'Record Invoice'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Cost Dialog */}
      <Dialog open={showAddCost} onOpenChange={setShowAddCost}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Cost Item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Description</Label>
              <Input value={costForm.description} onChange={e => setCostForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={costForm.category} onValueChange={v => setCostForm(f => ({ ...f, category: v as CostCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COST_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (£)</Label>
                <Input type="number" step="0.01" value={costForm.amount} onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>VAT (£)</Label>
                <Input type="number" step="0.01" value={costForm.vat_amount} onChange={e => setCostForm(f => ({ ...f, vat_amount: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={costForm.is_estimated}
                onChange={e => setCostForm(f => ({ ...f, is_estimated: e.target.checked }))}
              />
              Estimated (not actual)
            </label>
            <Button onClick={handleAddCost} disabled={!costForm.description || !costForm.amount || addCost.isPending}>
              {addCost.isPending ? 'Adding...' : 'Add Cost'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
