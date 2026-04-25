import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreatePropertyUnit, useUpdatePropertyUnit, type PropertyUnit } from '@/hooks/usePropertyUnits';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  editingUnit?: PropertyUnit | null;
  existingCount: number;
}

const initialForm = {
  unit_name: '',
  notes: '',
};

type UnitFormState = typeof initialForm;
type PropertyUnitCreateInput = Omit<PropertyUnit, 'id' | 'created_at' | 'updated_at'>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function UnitFormModal({ open, onOpenChange, propertyId, editingUnit, existingCount }: Props) {
  const create = useCreatePropertyUnit();
  const update = useUpdatePropertyUnit();
  const { toast } = useToast();

  const [form, setForm] = useState<UnitFormState>(initialForm);

  useEffect(() => {
    if (editingUnit) {
      setForm({
        unit_name: editingUnit.unit_name,
        notes: editingUnit.notes || '',
      });
    } else {
      setForm(initialForm);
    }
  }, [editingUnit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unit_name) {
      toast({ title: 'Unit name is required', variant: 'destructive' });
      return;
    }
    const payload: PropertyUnitCreateInput = {
      property_id: propertyId,
      unit_name: form.unit_name,
      rent_basis: editingUnit ? editingUnit.rent_basis : 'room' as const,
      whole_house_rent_pcm: editingUnit ? editingUnit.whole_house_rent_pcm : null,
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
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const set = <K extends keyof UnitFormState>(key: K, value: UnitFormState[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingUnit ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
          <DialogDescription>
            {editingUnit ? 'Update this unit\'s details.' : 'Add a new self-contained unit to this property.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Unit Name *</Label>
            <Input value={form.unit_name} onChange={e => set('unit_name', e.target.value)}
              placeholder="e.g. Main House, Annex, Flat 1" required />
          </div>
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
