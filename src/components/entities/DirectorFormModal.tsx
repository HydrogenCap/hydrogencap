import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useCreateDirector,
  useUpdateDirector,
  type EntityDirector,
} from '@/hooks/useLegalEntities';
import { toast } from "sonner";

interface DirectorFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  editingDirector?: EntityDirector | null;
}

export function DirectorFormModal({ open, onOpenChange, entityId, editingDirector }: DirectorFormModalProps) {
  const createDirector = useCreateDirector();
  const updateDirector = useUpdateDirector();
  const isEditing = !!editingDirector;

  const [form, setForm] = useState({
    director_name: '',
    appointment_date: '',
    resignation_date: '',
    is_current: true,
  });

  useEffect(() => {
    if (open) {
      if (editingDirector) {
        setForm({
          director_name: editingDirector.director_name,
          appointment_date: editingDirector.appointment_date,
          resignation_date: editingDirector.resignation_date || '',
          is_current: editingDirector.is_current,
        });
      } else {
        setForm({ director_name: '', appointment_date: '', resignation_date: '', is_current: true });
      }
    }
  }, [open, editingDirector]);

  const isPending = createDirector.isPending || updateDirector.isPending;

  const handleSubmit = async () => {
    if (!form.director_name.trim() || !form.appointment_date) {
      toast.error('Error', { description: 'Name and appointment date are required' });
      return;
    }

    const payload = {
      entity_id: entityId,
      director_name: form.director_name.trim(),
      appointment_date: form.appointment_date,
      resignation_date: form.resignation_date || null,
      is_current: form.is_current,
    };

    try {
      if (isEditing && editingDirector) {
        await updateDirector.mutateAsync({ id: editingDirector.id, ...payload });
        toast.success('Director updated');
      } else {
        await createDirector.mutateAsync(payload);
        toast.success('Director added');
      }
      onOpenChange(false);
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Failed to save director';
      toast({ title: 'Error', description, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Director' : 'Add Director'}</DialogTitle>
          <DialogDescription>
            Record this company's director details and appointment dates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Director Name *</Label>
            <Input value={form.director_name} onChange={(e) => setForm(f => ({ ...f, director_name: e.target.value }))} placeholder="e.g. John Smith" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Appointment Date *</Label>
              <Input type="date" value={form.appointment_date} onChange={(e) => setForm(f => ({ ...f, appointment_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Resignation Date</Label>
              <Input type="date" value={form.resignation_date} onChange={(e) => setForm(f => ({ ...f, resignation_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Currently Active</Label>
            <Switch checked={form.is_current} onCheckedChange={(v) => setForm(f => ({ ...f, is_current: v }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : isEditing ? 'Update' : 'Add Director'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
