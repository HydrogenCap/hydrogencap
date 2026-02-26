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
}

export function RoomFormModal({ open, onOpenChange, propertyId, editingRoom }: Props) {
  const create = useCreateRoom();
  const update = useUpdateRoom();
  const { toast } = useToast();

  const [form, setForm] = useState({
    room_name: '',
    room_type: 'double' as string,
    floor: '',
    has_ensuite: false,
    is_lettable: true,
    current_rent_pcm: '',
    target_rent_pcm: '',
    occupancy_status: 'vacant' as string,
    notes: '',
  });

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
      setForm({
        room_name: '', room_type: 'double', floor: '', has_ensuite: false,
        is_lettable: true, current_rent_pcm: '', target_rent_pcm: '',
        occupancy_status: 'vacant', notes: '',
      });
    }
  }, [editingRoom, open]);

  // Auto-logic for communal and ensuite
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
    const payload = {
      property_id: propertyId,
      room_name: form.room_name,
      room_type: form.room_type as RoomV2['room_type'],
      floor: form.floor ? parseInt(form.floor) : null,
      has_ensuite: form.has_ensuite,
      is_lettable: form.is_lettable,
      current_rent_pcm: form.current_rent_pcm ? parseFloat(form.current_rent_pcm) : null,
      target_rent_pcm: form.target_rent_pcm ? parseFloat(form.target_rent_pcm) : null,
      occupancy_status: form.occupancy_status as RoomV2['occupancy_status'],
      notes: form.notes || null,
    };
    try {
      if (editingRoom) {
        await update.mutateAsync({ id: editingRoom.id, ...payload });
        toast({ title: 'Room updated' });
      } else {
        await create.mutateAsync(payload);
        toast({ title: 'Room created' });
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
