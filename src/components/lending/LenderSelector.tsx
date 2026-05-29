import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useLenders, useCreateLender, LENDER_TYPES, type Lender } from '@/hooks/useLenders';
import { toast } from "sonner";

interface LenderSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

type LenderFormState = Omit<Lender, 'id' | 'org_id' | 'created_at' | 'updated_at'>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function LenderSelector({ value, onChange }: LenderSelectorProps) {
  const { data: lenders = [] } = useLenders();
  const createLender = useCreateLender();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<LenderFormState>({
    lender_name: '', lender_type: 'high_street',
    contact_name: '', contact_email: '', contact_phone: '',
    broker_name: '', broker_email: '', broker_phone: '',
    notes: '',
  });

  const handleCreate = async () => {
    if (!form.lender_name.trim()) { toast.error('Lender name required'); return; }
    try {
      const created = await createLender.mutateAsync({
        lender_name: form.lender_name,
        lender_type: form.lender_type,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        broker_name: form.broker_name || null,
        broker_email: form.broker_email || null,
        broker_phone: form.broker_phone || null,
        notes: form.notes || null,
      });
      onChange(created.id);
      setShowAdd(false);
      toast.success('Lender created');
    } catch (err: unknown) {
      console.error('Failed to create lender:', err);
      toast.error('Error', { description: getErrorMessage(err) });
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select lender..." />
          </SelectTrigger>
          <SelectContent>
            {lenders.map(l => (
              <SelectItem key={l.id} value={l.id}>
                <span className="font-medium">{l.lender_name}</span>
                <span className="text-muted-foreground text-xs ml-2">
                  {LENDER_TYPES.find(t => t.value === l.lender_type)?.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button aria-label="Add" type="button" variant="outline" size="icon" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Lender</DialogTitle>
            <DialogDescription>
              Register a new lender that you can attach future loan facilities to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Lender Name *</Label>
              <Input value={form.lender_name} onChange={e => setForm(f => ({ ...f, lender_name: e.target.value }))} />
            </div>
            <div>
              <Label>Lender Type *</Label>
              <Select value={form.lender_type} onValueChange={v => setForm(f => ({ ...f, lender_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LENDER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
              <div><Label>Contact Email</Label><Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Broker Name</Label><Input value={form.broker_name} onChange={e => setForm(f => ({ ...f, broker_name: e.target.value }))} /></div>
              <div><Label>Broker Email</Label><Input value={form.broker_email} onChange={e => setForm(f => ({ ...f, broker_email: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createLender.isPending}>Add Lender</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
