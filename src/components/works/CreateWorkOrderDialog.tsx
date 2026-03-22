import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateWorkOrder, WO_CATEGORIES, type WOCategory, type WOPriority } from '@/hooks/useWorkOrders';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { usePropertiesV2, type PropertyWithEntity } from '@/hooks/usePropertiesV2';
import { usePropertyRooms, type RoomV2 } from '@/hooks/useRoomsV2';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkOrderDialog({ open, onOpenChange }: Props) {
  const createWO = useCreateWorkOrder();
  const { data: entities } = useLegalEntities();
  const { data: allProperties } = usePropertiesV2();

  const [form, setForm] = useState({
    title: '',
    description: '',
    entity_id: '',
    property_id: '',
    room_id: '',
    category: 'general' as WOCategory,
    priority: 'normal' as WOPriority,
    estimated_cost: '',
    target_start_date: '',
    target_completion_date: '',
    internal_notes: '',
  });

  // Filter properties by selected entity
  const filteredProperties: PropertyWithEntity[] = allProperties?.filter(
    (property) => !form.entity_id || property.entity_id === form.entity_id
  ) ?? [];

  const { data: rooms = [] } = usePropertyRooms(form.property_id || undefined);

  // Reset downstream selects when parent changes
  useEffect(() => {
    setForm(f => ({ ...f, property_id: '', room_id: '' }));
  }, [form.entity_id]);

  useEffect(() => {
    setForm(f => ({ ...f, room_id: '' }));
  }, [form.property_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.entity_id) return;

    await createWO.mutateAsync({
      title: form.title,
      description: form.description || undefined,
      entity_id: form.entity_id,
      property_id: form.property_id || undefined,
      room_id: form.room_id || undefined,
      category: form.category,
      priority: form.priority,
      estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : undefined,
      target_start_date: form.target_start_date || undefined,
      target_completion_date: form.target_completion_date || undefined,
      internal_notes: form.internal_notes || undefined,
    });

    setForm({
      title: '', description: '', entity_id: '', property_id: '', room_id: '',
      category: 'general', priority: 'normal', estimated_cost: '',
      target_start_date: '', target_completion_date: '', internal_notes: '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Work Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Bathroom refurbishment Room 3"
              required
            />
          </div>

          <div>
            <Label>Entity *</Label>
            <Select value={form.entity_id} onValueChange={v => setForm(f => ({ ...f, entity_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
              <SelectContent>
                {entities?.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as WOCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WO_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as WOPriority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Property</Label>
            <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {filteredProperties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.address_line_1}, {p.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.property_id && rooms.length > 0 && (
            <div>
              <Label>Room</Label>
              <Select value={form.room_id} onValueChange={v => setForm(f => ({ ...f, room_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r: RoomV2) => (
                    <SelectItem key={r.id} value={r.id}>{r.room_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div>
            <Label>Estimated Cost (£)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.estimated_cost}
              onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Target Start</Label>
              <Input
                type="date"
                value={form.target_start_date}
                onChange={e => setForm(f => ({ ...f, target_start_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Target Completion</Label>
              <Input
                type="date"
                value={form.target_completion_date}
                onChange={e => setForm(f => ({ ...f, target_completion_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label>Internal Notes</Label>
            <Textarea
              value={form.internal_notes}
              onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWO.isPending || !form.title || !form.entity_id}>
              {createWO.isPending ? 'Creating...' : 'Create Work Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
