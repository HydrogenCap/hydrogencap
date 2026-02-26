import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateShareholder,
  useUpdateShareholder,
  type EntityShareholder,
} from '@/hooks/useLegalEntities';
import { useToast } from '@/hooks/use-toast';

interface ShareholderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  editingShareholder?: EntityShareholder | null;
}

export function ShareholderFormModal({ open, onOpenChange, entityId, editingShareholder }: ShareholderFormModalProps) {
  const { toast } = useToast();
  const createShareholder = useCreateShareholder();
  const updateShareholder = useUpdateShareholder();
  const isEditing = !!editingShareholder;

  const [form, setForm] = useState({
    shareholder_name: '',
    share_class: 'Ordinary',
    shares_held: '',
    percentage: '',
    effective_date: '',
  });

  useEffect(() => {
    if (open) {
      if (editingShareholder) {
        setForm({
          shareholder_name: editingShareholder.shareholder_name,
          share_class: editingShareholder.share_class,
          shares_held: String(editingShareholder.shares_held),
          percentage: String(editingShareholder.percentage),
          effective_date: editingShareholder.effective_date,
        });
      } else {
        setForm({ shareholder_name: '', share_class: 'Ordinary', shares_held: '', percentage: '', effective_date: '' });
      }
    }
  }, [open, editingShareholder]);

  const isPending = createShareholder.isPending || updateShareholder.isPending;

  const handleSubmit = async () => {
    if (!form.shareholder_name.trim()) {
      toast({ title: 'Error', description: 'Shareholder name is required', variant: 'destructive' });
      return;
    }
    const shares = parseInt(form.shares_held, 10);
    const pct = parseFloat(form.percentage);
    if (isNaN(shares) || shares <= 0) {
      toast({ title: 'Error', description: 'Shares held must be a positive number', variant: 'destructive' });
      return;
    }
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast({ title: 'Error', description: 'Percentage must be between 0 and 100', variant: 'destructive' });
      return;
    }
    if (!form.effective_date) {
      toast({ title: 'Error', description: 'Effective date is required', variant: 'destructive' });
      return;
    }

    const payload = {
      entity_id: entityId,
      shareholder_name: form.shareholder_name.trim(),
      share_class: form.share_class.trim() || 'Ordinary',
      shares_held: shares,
      percentage: pct,
      effective_date: form.effective_date,
    };

    try {
      if (isEditing && editingShareholder) {
        await updateShareholder.mutateAsync({ id: editingShareholder.id, ...payload });
        toast({ title: 'Shareholder updated' });
      } else {
        await createShareholder.mutateAsync(payload);
        toast({ title: 'Shareholder added' });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Shareholder' : 'Add Shareholder'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Shareholder Name *</Label>
            <Input value={form.shareholder_name} onChange={(e) => setForm(f => ({ ...f, shareholder_name: e.target.value }))} placeholder="e.g. John Smith or Hydrogen Capital Ltd" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Share Class</Label>
              <Input value={form.share_class} onChange={(e) => setForm(f => ({ ...f, share_class: e.target.value }))} placeholder="Ordinary" />
            </div>
            <div className="space-y-2">
              <Label>Shares Held *</Label>
              <Input type="number" min="1" value={form.shares_held} onChange={(e) => setForm(f => ({ ...f, shares_held: e.target.value }))} placeholder="100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Percentage *</Label>
              <Input type="number" min="0" max="100" step="0.01" value={form.percentage} onChange={(e) => setForm(f => ({ ...f, percentage: e.target.value }))} placeholder="50.00" />
            </div>
            <div className="space-y-2">
              <Label>Effective Date *</Label>
              <Input type="date" value={form.effective_date} onChange={(e) => setForm(f => ({ ...f, effective_date: e.target.value }))} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : isEditing ? 'Update' : 'Add Shareholder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
