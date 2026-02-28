import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreatePropertyUnit, useUpdatePropertyUnit, type PropertyUnit } from '@/hooks/usePropertyUnits';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  editingUnit?: PropertyUnit | null;
  existingCount: number;
}

export function UnitFormModal({ open, onOpenChange, propertyId, editingUnit, existingCount }: Props) {
  const create = useCreatePropertyUnit();
  const update = useUpdatePropertyUnit();
  const { toast } = useToast();

  const [form, setForm] = useState({
    unit_name: '',
    rent_basis: 'room' as 'room' | 'whole_house',
    whole_house_rent_pcm: '',
    notes: '',
  });

  useEffect(() => {
    if (editingUnit) {
      setForm({
        unit_name: editingUnit.unit_name,
        rent_basis: editingUnit.rent_basis,
        whole_house_rent_pcm: editingUnit.whole_house_rent_pcm?.toString() || '',
        notes: editingUnit.notes || '',
      });
    } else {
      setForm({ unit_name: '', rent_basis: 'room', whole_house_rent_pcm: '', notes: '' });
    }
  }, [editingUnit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unit_name) {
      toast({ title: 'Unit name is required', variant: 'destructive' });
      return;
    }
    const payload = {
      property_id: propertyId,
      unit_name: form.unit_name,
      rent_basis: form.rent_basis,
      whole_house_rent_pcm: form.rent_basis === 'whole_house' && form.whole_house_rent_pcm
        ? parseFloat(form.whole_house_rent_pcm) : null,
      is_lettable: true,
      sort_order: editingUnit ? editingUnit.sort_order : existingCount,
      notes: form.notes || null,
    };
    try {
      if (editingUnit) {
        await update.mutateAsync({ id: editingUnit.id, ...payload });
        toast({ title: 'Unit updated' });
      } else {
        await create.mutateAsync(payload);
        toast({ title: 'Unit added' });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingUnit ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Unit Name *</Label>
            <Input value={form.unit_name} onChange={e => set('unit_name', e.target.value)}
              placeholder="e.g. Main House, Annex, Flat 1" required />
          </div>
          <div>
            <Label>Rent Basis</Label>
            <Select value={form.rent_basis} onValueChange={v => set('rent_basis', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="room">Per Room</SelectItem>
                <SelectItem value="whole_house">Whole Unit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.rent_basis === 'whole_house' && (
            <div>
              <Label>Whole Unit Rent (£/month)</Label>
              <Input type="number" step="0.01" value={form.whole_house_rent_pcm}
                onChange={e => set('whole_house_rent_pcm', e.target.value)} placeholder="e.g. 1500" />
            </div>
          )}
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editingUnit ? 'Save' : 'Add Unit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
