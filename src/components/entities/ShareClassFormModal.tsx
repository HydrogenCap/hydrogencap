import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useCreateShareClass, useUpdateShareClass, type ShareClassV2,
} from '@/hooks/useShareCapital';
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  editingShareClass?: ShareClassV2 | null;
}

export function ShareClassFormModal({ open, onOpenChange, entityId, editingShareClass }: Props) {
  const create = useCreateShareClass();
  const update = useUpdateShareClass();
  const isEditing = !!editingShareClass;

  const [form, setForm] = useState({
    class_name: 'Ordinary',
    issued_shares: '100',
    nominal_value: '1.00',
    voting_rights: true,
    is_primary: false,
  });

  useEffect(() => {
    if (open) {
      if (editingShareClass) {
        setForm({
          class_name: editingShareClass.class_name,
          issued_shares: String(editingShareClass.issued_shares),
          nominal_value: editingShareClass.nominal_value ? String(editingShareClass.nominal_value) : '',
          voting_rights: editingShareClass.voting_rights,
          is_primary: editingShareClass.is_primary,
        });
      } else {
        setForm({ class_name: 'Ordinary', issued_shares: '100', nominal_value: '1.00', voting_rights: true, is_primary: false });
      }
    }
  }, [open, editingShareClass]);

  const isPending = create.isPending || update.isPending;

  const handleSubmit = async () => {
    if (!form.class_name.trim()) {
      toast.error('Missing class name', { description: 'Give it a label like Ordinary or Preference.' });
      return;
    }
    const issued = parseInt(form.issued_shares, 10);
    if (isNaN(issued) || issued < 1) {
      toast.error('At least one share', { description: 'A class needs at least one issued share.' });
      return;
    }

    const payload = {
      entity_id: entityId,
      class_name: form.class_name.trim(),
      issued_shares: issued,
      nominal_value: form.nominal_value ? parseFloat(form.nominal_value) : null,
      voting_rights: form.voting_rights,
      is_primary: form.is_primary,
    };

    try {
      if (isEditing && editingShareClass) {
        await update.mutateAsync({ id: editingShareClass.id, ...payload });
        toast('Share class on file');
      } else {
        await create.mutateAsync(payload);
        toast.success('New share class added');
      }
      onOpenChange(false);
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Failed to save share class';
      toast({ title: "Share class didn't save", description, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Share Class' : 'Add Share Class'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of this share class.' : 'Define a new share class — ordinary, preference, or custom.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Class Name *</Label>
            <Input value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} placeholder="e.g. Ordinary, Preference A" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issued Shares *</Label>
              <Input type="number" min="1" value={form.issued_shares} onChange={e => setForm(f => ({ ...f, issued_shares: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nominal Value (£)</Label>
              <Input type="number" min="0" step="0.01" value={form.nominal_value} onChange={e => setForm(f => ({ ...f, nominal_value: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.voting_rights} onCheckedChange={v => setForm(f => ({ ...f, voting_rights: v as boolean }))} />
              <Label className="text-sm">Voting rights</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_primary} onCheckedChange={v => setForm(f => ({ ...f, is_primary: v as boolean }))} />
              <Label className="text-sm">Primary class</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
