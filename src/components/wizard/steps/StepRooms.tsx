import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import type { WizardPayload, WizardRoom } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

const ROOM_TYPES = ['bedroom', 'studio', 'living_room', 'kitchen', 'bathroom', 'ensuite', 'communal', 'storage', 'other'];

const emptyRoom = (): WizardRoom => ({
  room_name: '',
  room_type: 'bedroom',
  floor: 0,
  has_ensuite: false,
  is_lettable: true,
});

export function StepRooms({ payload, updatePayload }: StepProps) {
  const rooms = ((payload.rooms as WizardRoom[]) || []);
  const [expanded, setExpanded] = useState<number | null>(rooms.length > 0 ? 0 : null);

  const addRoom = () => {
    const updated = [...rooms, emptyRoom()];
    updatePayload({ rooms: updated as unknown as WizardPayload['rooms'] });
    setExpanded(updated.length - 1);
  };

  const removeRoom = (idx: number) => {
    const updated = rooms.filter((_, i) => i !== idx);
    updatePayload({ rooms: updated as unknown as WizardPayload['rooms'] });
    setExpanded(null);
  };

  const updateRoom = (idx: number, field: keyof WizardRoom, value: unknown) => {
    const updated = rooms.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    updatePayload({ rooms: updated as unknown as WizardPayload['rooms'] });
  };

  return (
    <div className="space-y-4">
      {rooms.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
          No rooms added yet. Click below to add one.
        </p>
      )}

      {rooms.map((room, idx) => (
        <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <button
              className="text-sm font-medium text-foreground hover:text-primary"
              onClick={() => setExpanded(expanded === idx ? null : idx)}
            >
              {room.room_name || `Room ${idx + 1}`}
            </button>
            <Button variant="ghost" size="sm" onClick={() => removeRoom(idx)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          {expanded === idx && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={room.room_name}
                    onChange={(e) => updateRoom(idx, 'room_name', e.target.value)}
                    placeholder="Room 1"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={room.room_type} onValueChange={(v) => updateRoom(idx, 'room_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROOM_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Floor</Label>
                  <Input
                    type="number"
                    value={room.floor}
                    onChange={(e) => updateRoom(idx, 'floor', Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Target rent (£/pcm)</Label>
                  <Input
                    type="number"
                    value={room.target_rent_pcm || ''}
                    onChange={(e) => updateRoom(idx, 'target_rent_pcm', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={room.has_ensuite} onCheckedChange={(v) => updateRoom(idx, 'has_ensuite', v)} />
                  <Label>En-suite</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={room.is_lettable} onCheckedChange={(v) => updateRoom(idx, 'is_lettable', v)} />
                  <Label>Lettable</Label>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <Button variant="outline" className="w-full" onClick={addRoom}>
        <Plus className="h-4 w-4 mr-1" /> Add Room
      </Button>
    </div>
  );
}
