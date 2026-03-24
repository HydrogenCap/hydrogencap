import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreateRoom, useUpdateRoom, ROOM_TYPES, OCCUPANCY_STATUSES } from '@/hooks/useRoomsV2';
import { useToast } from '@/hooks/use-toast';
import type { RoomV2 } from '@/hooks/useRoomsV2';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  editingRoom?: RoomV2 | null;
  unitId?: string | null;
}

const initialForm = {
  room_name: '',
  room_type: 'double' as RoomV2['room_type'],
  floor: '',
  has_ensuite: false,
  is_lettable: true,
  current_rent_pcm: '',
  target_rent_pcm: '',
  occupancy_status: 'vacant' as RoomV2['occupancy_status'],
  notes: '',
};

type RoomFormState = typeof initialForm;
type RoomCreateInput = Omit<RoomV2, 'id' | 'created_at' | 'updated_at'> & {
  unit_id?: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function RoomFormModal({ open, onOpenChange, propertyId, editingRoom, unitId }: Props) {
  const create = useCreateRoom();
  const update = useUpdateRoom();
  const { toast } = useToast();

  const [form, setForm] = useState<RoomFormState>(initialForm);

  useEffect(() => {
    if (editingRoom) {
      setForm({
        room_name: editingRoom.room_name,
        room_type: editingRoom.room_type,
        floor: editingRoom.floor?.toString() || '',
        has_ensuite: editingRoom.has_ensuite,
        is_lettable: editingRoom.is_lettable,
        current_rent_pcm: editingRoom.current_rent_pcm?.toString() || '',
        target_rent_pcm: editingRoom.target_rent_pcm?.toString() || '',
        occupancy_status: editingRoom.occupancy_status,
        notes: editingRoom.notes || '',
      });
    } else {
      setForm(initialForm);
    }
  }, [editingRoom, open]);

  useEffect(() => {
    if (form.room_type === 'communal') {
      setForm(f => ({ ...f, is_lettable: false, occupancy_status: 'unavailable' }));
    }
    if (form.room_type === 'ensuite') {
      setForm(f => ({ ...f, has_ensuite: true }));
    }
  }, [form.room_type]);

  useEffect(() => {
    if (!form.is_lettable) {
      setForm(f => ({ ...f, occupancy_status: 'unavailable' }));
    }
  }, [form.is_lettable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.room_name) {
      toast({ title: 'Room name is required', variant: 'destructive' });
      return;
    }
    const payload: RoomCreateInput = {
      property_id: propertyId,
      room_name: form.room_name.trim(),
      room_type: form.room_type,
      floor: form.floor ? parseInt(form.floor) : null,
      has_ensuite: form.has_ensuite,
      is_lettable: form.is_lettable,
      current_rent_pcm: form.current_rent_pcm ? parseFloat(form.current_rent_pcm) : null,
      target_rent_pcm: form.target_rent_pcm ? parseFloat(form.target_rent_pcm) : null,
      occupancy_status: form.occupancy_status,
      notes: form.notes || null,
    };
    if (unitId) payload.unit_id = unitId;
    try {
      if (editingRoom) {
        await update.mutateAsync({ id: editingRoom.id, ...payload });
        toast({ title: 'Room updated' });
      } else {
        await create.mutateAsync(payload);
        toast({ title: 'Room created' });
      }
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const set = <K extends keyof RoomFormState>(key: K, value: RoomFormState[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingRoom ? 'Edit Room' : 'Add Room'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Room Name *</Label><Input value={form.room_name} onChange={e => set('room_name', e.target.value)} placeholder="e.g. Room 1, Ground Floor Studio" required /></div>
          <div>
            <Label>Room Type *</Label>
            <Select value={form.room_type} onValueChange={v => set('room_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROOM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.room_type === 'communal' && (
            <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded">Communal rooms are automatically marked as non-lettable.</p>
          )}
          <div><Label>Floor</Label><Input type="number" value={form.floor} onChange={e => set('floor', e.target.value)} placeholder="0 = ground" /></div>
          <div className="flex items-center gap-3">
            <Switch checked={form.has_ensuite} onCheckedChange={v => set('has_ensuite', v)} disabled={form.room_type === 'ensuite'} />
            <Label>Has En-suite</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_lettable} onCheckedChange={v => set('is_lettable', v)} disabled={form.room_type === 'communal'} />
            <Label>Is Lettable</Label>
          </div>
          <div><Label>Current Rent (£ /pcm)</Label><Input type="number" step="0.01" value={form.current_rent_pcm} onChange={e => set('current_rent_pcm', e.target.value)} /></div>
          <div>
            <Label>Target Rent (£ /pcm)</Label>
            <Input type="number" step="0.01" value={form.target_rent_pcm} onChange={e => set('target_rent_pcm', e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">What this room should achieve at market rate</p>
          </div>
          {form.is_lettable && (
            <div>
              <Label>Occupancy Status *</Label>
              <Select value={form.occupancy_status} onValueChange={v => set('occupancy_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OCCUPANCY_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editingRoom ? 'Save' : 'Add Room'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
