import { useState } from 'react';
import { Plus, Trash2, Shield, AlertTriangle, FileText, Calendar } from 'lucide-react';
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
import { formatDateUK } from '@/lib/calculations';
import {
  useWorkOrderWarranties,
  useCreateWarranty,
  useDeleteWarranty,
  useExpiringWarranties,
  useAllActiveWarranties,
  type WorkOrderWarranty,
} from '@/hooks/useWorkOrderLifecycle';

type WarrantyWithJoins = WorkOrderWarranty & {
  work_order?: { id: string; wo_number: string; title: string } | null;
  property?: { id: string; address_line_1: string; city: string } | null;
};

// ─── Single WO Warranty Section ─────────────────────────────────────

interface WarrantyTrackerProps {
  workOrderId: string;
  propertyId?: string | null;
}

function getDaysUntilExpiry(warrantyEnd: string): number {
  const end = new Date(warrantyEnd);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getExpiryBadge(warrantyEnd: string) {
  const days = getDaysUntilExpiry(warrantyEnd);
  if (days < 0) return <Badge variant="destructive" className="text-[9px]">Expired</Badge>;
  if (days <= 30) return <Badge className="text-[9px] bg-red-100 text-red-700">Expires in {days}d</Badge>;
  if (days <= 90) return <Badge className="text-[9px] bg-amber-100 text-amber-700">Expires in {days}d</Badge>;
  return <Badge variant="outline" className="text-[9px]">{days}d remaining</Badge>;
}

export function WarrantyTracker({ workOrderId, propertyId }: WarrantyTrackerProps) {
  const { data: warranties, isLoading } = useWorkOrderWarranties(workOrderId);
  const createWarranty = useCreateWarranty();
  const deleteWarranty = useDeleteWarranty();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    description: '',
    warranty_provider: '',
    warranty_start: new Date().toISOString().split('T')[0],
    warranty_end: '',
    terms: '',
    document_url: '',
  });

  const handleAdd = async () => {
    if (!form.description || !form.warranty_start || !form.warranty_end) return;
    await createWarranty.mutateAsync({
      work_order_id: workOrderId,
      property_id: propertyId || undefined,
      description: form.description,
      warranty_provider: form.warranty_provider || undefined,
      warranty_start: form.warranty_start,
      warranty_end: form.warranty_end,
      terms: form.terms || undefined,
      document_url: form.document_url || undefined,
    });
    setForm({
      description: '',
      warranty_provider: '',
      warranty_start: new Date().toISOString().split('T')[0],
      warranty_end: '',
      terms: '',
      document_url: '',
    });
    setShowAdd(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Warranties ({warranties?.length || 0})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Warranty
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading warranties...</p>
          ) : (warranties || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No warranties recorded yet</p>
          ) : (
            <div className="space-y-3">
              {warranties!.map(warranty => (
                <div
                  key={warranty.id}
                  className="p-3 rounded-lg border space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{warranty.description}</p>
                        {getExpiryBadge(warranty.warranty_end)}
                      </div>
                      {warranty.warranty_provider && (
                        <p className="text-xs text-muted-foreground">Provider: {warranty.warranty_provider}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteWarranty.mutate({ id: warranty.id, workOrderId })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateUK(warranty.warranty_start)} - {formatDateUK(warranty.warranty_end)}
                    </span>
                    {warranty.document_url && (
                      <a
                        href={warranty.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" /> Document
                      </a>
                    )}
                  </div>
                  {warranty.terms && (
                    <p className="text-xs text-muted-foreground border-t pt-2">{warranty.terms}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Warranty Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Warranty</DialogTitle>
            <DialogDescription>
              Log a product or workmanship warranty attached to this work order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Boiler installation warranty"
              />
            </div>
            <div>
              <Label>Warranty Provider</Label>
              <Input
                value={form.warranty_provider}
                onChange={e => setForm(f => ({ ...f, warranty_provider: e.target.value }))}
                placeholder="e.g. British Gas"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.warranty_start}
                  onChange={e => setForm(f => ({ ...f, warranty_start: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.warranty_end}
                  onChange={e => setForm(f => ({ ...f, warranty_end: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Terms</Label>
              <Textarea
                value={form.terms}
                onChange={e => setForm(f => ({ ...f, terms: e.target.value }))}
                rows={3}
                placeholder="Optional warranty terms and conditions"
              />
            </div>
            <div>
              <Label>Document URL</Label>
              <Input
                value={form.document_url}
                onChange={e => setForm(f => ({ ...f, document_url: e.target.value }))}
                placeholder="Optional - link to warranty document"
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={!form.description || !form.warranty_start || !form.warranty_end || createWarranty.isPending}
              className="w-full"
            >
              {createWarranty.isPending ? 'Saving...' : 'Record Warranty'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Warranty Dashboard (all active warranties) ─────────────────────

export function WarrantyDashboard() {
  const { data: activeWarranties, isLoading: loadingActive } = useAllActiveWarranties();
  const { data: expiringWarranties, isLoading: _loadingExpiring } = useExpiringWarranties(90);

  const expiringSoon = ((expiringWarranties || []) as WarrantyWithJoins[]).filter((w) => getDaysUntilExpiry(w.warranty_end) <= 90);

  return (
    <div className="space-y-6">
      {/* Expiring Soon Alerts */}
      {expiringSoon.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Expiring Within 90 Days ({expiringSoon.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringSoon.map((w) => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{w.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {w.work_order && <span>{w.work_order.wo_number}</span>}
                      {w.property && <span>- {w.property.address_line_1}</span>}
                      {w.warranty_provider && <span>- {w.warranty_provider}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 ml-3">
                    {getExpiryBadge(w.warranty_end)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Active Warranties */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Active Warranties ({activeWarranties?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingActive ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading warranties...</p>
          ) : (activeWarranties || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No active warranties</p>
          ) : (
            <div className="space-y-2">
              {(activeWarranties as WarrantyWithJoins[]).map((w) => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{w.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {w.work_order && <span>{w.work_order.wo_number} - {w.work_order.title}</span>}
                      {w.property && <span>- {w.property.address_line_1}, {w.property.city}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {w.warranty_provider && <span>Provider: {w.warranty_provider}</span>}
                      <span>- {formatDateUK(w.warranty_start)} to {formatDateUK(w.warranty_end)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 ml-3">
                    {getExpiryBadge(w.warranty_end)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
