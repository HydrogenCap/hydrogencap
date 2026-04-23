import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Pencil, X } from 'lucide-react';
import { useUpdateWorksOrder, type WorksOrderWithContractor } from '@/hooks/useWorksOrders';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WORKS_ORDER_STATUS_CONFIG, WORKS_ORDER_PIPELINE, type WorksOrderStatus } from '@/lib/maintenanceTypes';

interface Props {
  worksOrder: WorksOrderWithContractor;
}

export function WorksOrderDetailForm({ worksOrder: wo }: Props) {
  const updateWO = useUpdateWorksOrder();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    contractor_id: wo.contractor_id || '',
    contractor_name_override: wo.contractor_name_override || '',
    quoted_amount: wo.quoted_amount?.toString() || '',
    approved_amount: wo.approved_amount?.toString() || '',
    invoice_amount: wo.invoice_amount?.toString() || '',
    paid_amount: wo.paid_amount?.toString() || '',
    scheduled_date: wo.scheduled_date || '',
    scheduled_time_slot: wo.scheduled_time_slot || '',
    invoice_reference: wo.invoice_reference || '',
    completion_notes: wo.completion_notes || '',
    notes: wo.notes || '',
    tenant_access_required: wo.tenant_access_required,
    warranty_months: wo.warranty_months?.toString() || '',
  });

  // Load contractors for assignment
  const { data: contractors } = useQuery({
    queryKey: ['compliance_contractors_v2_list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('compliance_contractors_v2')
        .select('id, company_name, rating, service_types')
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
  });

  const handleSave = () => {
    updateWO.mutate({
      id: wo.id,
      contractor_id: form.contractor_id || null,
      contractor_name_override: form.contractor_name_override || null,
      quoted_amount: form.quoted_amount ? parseFloat(form.quoted_amount) : null,
      approved_amount: form.approved_amount ? parseFloat(form.approved_amount) : null,
      invoice_amount: form.invoice_amount ? parseFloat(form.invoice_amount) : null,
      paid_amount: form.paid_amount ? parseFloat(form.paid_amount) : null,
      scheduled_date: form.scheduled_date || null,
      scheduled_time_slot: form.scheduled_time_slot || null,
      invoice_reference: form.invoice_reference || null,
      completion_notes: form.completion_notes || null,
      notes: form.notes || null,
      tenant_access_required: form.tenant_access_required,
      warranty_months: form.warranty_months ? parseInt(form.warranty_months) : null,
    }, { onSuccess: () => setEditing(false) });
  };

  const handleAdvance = (status: WorksOrderStatus) => {
    updateWO.mutate({ id: wo.id, status });
  };

  const currentIdx = WORKS_ORDER_PIPELINE.indexOf(wo.status);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          Works Order
          <Badge variant="outline">{wo.order_number}</Badge>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
          {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status pipeline */}
        <div className="flex flex-wrap gap-1">
          {WORKS_ORDER_PIPELINE.map((s, idx) => {
            const isPast = idx < currentIdx;
            const isCurrent = s === wo.status;
            return (
              <Badge key={s} variant={isCurrent ? 'default' : 'outline'} className={`text-[10px] ${isPast ? 'bg-green-100 text-green-700 border-green-200' : ''}`}>
                {isPast && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                {WORKS_ORDER_STATUS_CONFIG[s].label}
              </Badge>
            );
          })}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Contractor</Label>
              <Select value={form.contractor_id} onValueChange={v => setForm({ ...form, contractor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select contractor" /></SelectTrigger>
                <SelectContent>
                  {contractors?.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name} {c.rating ? `(★${c.rating})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Or enter name manually" value={form.contractor_name_override} onChange={e => setForm({ ...form, contractor_name_override: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Quoted (£)</Label>
                <Input type="number" step="0.01" value={form.quoted_amount} onChange={e => setForm({ ...form, quoted_amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Approved (£)</Label>
                <Input type="number" step="0.01" value={form.approved_amount} onChange={e => setForm({ ...form, approved_amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invoice (£)</Label>
                <Input type="number" step="0.01" value={form.invoice_amount} onChange={e => setForm({ ...form, invoice_amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Paid (£)</Label>
                <Input type="number" step="0.01" value={form.paid_amount} onChange={e => setForm({ ...form, paid_amount: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Scheduled Date</Label>
                <Input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Time Slot</Label>
                <Select value={form.scheduled_time_slot} onValueChange={v => setForm({ ...form, scheduled_time_slot: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="all_day">All Day</SelectItem>
                    <SelectItem value="specific">Specific Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Invoice Reference</Label>
              <Input value={form.invoice_reference} onChange={e => setForm({ ...form, invoice_reference: e.target.value })} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Warranty (months)</Label>
              <Input type="number" value={form.warranty_months} onChange={e => setForm({ ...form, warranty_months: e.target.value })} />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.tenant_access_required} onCheckedChange={v => setForm({ ...form, tenant_access_required: v })} />
              <Label className="text-xs">Tenant access required</Label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Completion Notes</Label>
              <Textarea value={form.completion_notes} onChange={e => setForm({ ...form, completion_notes: e.target.value })} rows={2} />
            </div>

            <Button size="sm" className="w-full" onClick={handleSave} disabled={updateWO.isPending}>
              {updateWO.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        ) : (
          <>
            {/* Read-only view */}
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">Contractor</p>
              <p className="font-medium">{wo.contractor?.company_name || wo.contractor_name_override || 'Unassigned'}</p>
            </div>

            <div className="text-sm space-y-1">
              {wo.quoted_amount != null && <p>Quoted: <span className="font-medium">£{wo.quoted_amount.toFixed(2)}</span></p>}
              {wo.approved_amount != null && <p>Approved: <span className="font-medium">£{wo.approved_amount.toFixed(2)}</span></p>}
              {wo.invoice_amount != null && <p>Invoiced: <span className="font-medium">£{wo.invoice_amount.toFixed(2)}</span></p>}
              {wo.paid_amount != null && <p>Paid: <span className="font-medium text-green-600">£{wo.paid_amount.toFixed(2)}</span></p>}
            </div>

            {wo.scheduled_date && (
              <div className="text-sm">
                <p className="text-muted-foreground">Scheduled</p>
                <p className="font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {format(new Date(wo.scheduled_date), 'dd MMM yyyy')}</p>
              </div>
            )}

            {wo.invoice_reference && (
              <div className="text-sm">
                <p className="text-muted-foreground">Invoice Ref</p>
                <p className="font-medium">{wo.invoice_reference}</p>
              </div>
            )}

            {wo.warranty_months && (
              <div className="text-sm">
                <p className="text-muted-foreground">Warranty</p>
                <p className="font-medium">{wo.warranty_months} months</p>
              </div>
            )}

            {wo.notes && (
              <div className="text-sm">
                <p className="text-muted-foreground">Notes</p>
                <p>{wo.notes}</p>
              </div>
            )}

            {/* Context-dependent actions */}
            <div className="border-t pt-3 space-y-2">
              {wo.status === 'draft' && <Button size="sm" className="w-full" onClick={() => handleAdvance('sent_to_contractor')}>Send to Contractor</Button>}
              {wo.status === 'sent_to_contractor' && <Button size="sm" className="w-full" onClick={() => handleAdvance('quote_received')}>Record Quote Received</Button>}
              {wo.status === 'quote_received' && <Button size="sm" className="w-full" onClick={() => handleAdvance('approved')}>Approve Quote</Button>}
              {wo.status === 'approved' && <Button size="sm" className="w-full" onClick={() => handleAdvance('scheduled')}>Mark Scheduled</Button>}
              {wo.status === 'scheduled' && <Button size="sm" className="w-full" onClick={() => handleAdvance('in_progress')}>Mark In Progress</Button>}
              {wo.status === 'in_progress' && <Button size="sm" className="w-full" onClick={() => handleAdvance('completed')}>Mark Complete</Button>}
              {wo.status === 'completed' && <Button size="sm" className="w-full" onClick={() => handleAdvance('invoiced')}>Record Invoice</Button>}
              {wo.status === 'invoiced' && <Button size="sm" className="w-full" onClick={() => handleAdvance('paid')}>Record Payment</Button>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
