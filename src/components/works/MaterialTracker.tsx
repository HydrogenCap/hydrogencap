import { useState } from 'react';
import { Plus, Trash2, Package, AlertTriangle, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
  useWorkOrderMaterials,
  useAddMaterial,
  useDeleteMaterial,
} from '@/hooks/useWorkOrderLifecycle';

interface MaterialTrackerProps {
  workOrderId: string;
  approvedBudget: number | null;
}

export function MaterialTracker({ workOrderId, approvedBudget }: MaterialTrackerProps) {
  const { data: materials, isLoading } = useWorkOrderMaterials(workOrderId);
  const addMaterial = useAddMaterial();
  const deleteMaterial = useDeleteMaterial();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    material_name: '',
    quantity: '',
    unit_cost: '',
    supplier: '',
    receipt_url: '',
  });

  const totalCost = (materials || []).reduce((sum, m) => sum + m.total_cost, 0);
  const budgetUsed = approvedBudget ? (totalCost / approvedBudget) * 100 : 0;
  const overBudget = approvedBudget ? totalCost > approvedBudget : false;

  const handleAdd = async () => {
    if (!form.material_name || !form.quantity || !form.unit_cost) return;
    await addMaterial.mutateAsync({
      work_order_id: workOrderId,
      material_name: form.material_name,
      quantity: parseFloat(form.quantity),
      unit_cost: parseFloat(form.unit_cost),
      supplier: form.supplier || undefined,
      receipt_url: form.receipt_url || undefined,
      purchased_at: new Date().toISOString(),
    });
    setForm({ material_name: '', quantity: '', unit_cost: '', supplier: '', receipt_url: '' });
    setShowAdd(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Materials ({materials?.length || 0})
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className={cn('text-sm font-medium', overBudget && 'text-destructive')}>
              {formatGBP(totalCost)}
              {approvedBudget ? ` / ${formatGBP(approvedBudget)}` : ''}
            </span>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add Material
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Budget comparison */}
          {approvedBudget && (
            <div>
              <Progress
                value={Math.min(budgetUsed, 100)}
                className={cn('h-2', overBudget && '[&>div]:bg-destructive')}
              />
              {overBudget && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Materials cost exceeds approved budget by {formatGBP(totalCost - approvedBudget)}
                </p>
              )}
            </div>
          )}

          {/* Materials list */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading materials...</p>
          ) : (materials || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No materials recorded yet</p>
          ) : (
            <div className="space-y-2">
              {materials!.map(material => (
                <div
                  key={material.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{material.material_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{material.quantity} x {formatGBP(material.unit_cost)}</span>
                      {material.supplier && <span>- {material.supplier}</span>}
                      {material.purchased_at && <span>- {formatDateUK(material.purchased_at)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {material.receipt_url && (
                      <a
                        href={material.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <span className="text-sm font-medium">{formatGBP(material.total_cost)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMaterial.mutate({ id: material.id, workOrderId })}
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

      {/* Add Material Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
            <DialogDescription>
              Log a material or consumable used against this work order's budget.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Material Name</Label>
              <Input
                value={form.material_name}
                onChange={e => setForm(f => ({ ...f, material_name: e.target.value }))}
                placeholder="e.g. Copper pipe 15mm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div>
                <Label>Unit Cost (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.unit_cost}
                  onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                />
              </div>
            </div>
            {form.quantity && form.unit_cost && (
              <p className="text-sm text-muted-foreground">
                Total: {formatGBP(parseFloat(form.quantity) * parseFloat(form.unit_cost))}
              </p>
            )}
            <div>
              <Label>Supplier</Label>
              <Input
                value={form.supplier}
                onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>Receipt URL</Label>
              <Input
                value={form.receipt_url}
                onChange={e => setForm(f => ({ ...f, receipt_url: e.target.value }))}
                placeholder="Optional - link to uploaded receipt"
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={!form.material_name || !form.quantity || !form.unit_cost || addMaterial.isPending}
              className="w-full"
            >
              {addMaterial.isPending ? 'Adding...' : 'Add Material'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
