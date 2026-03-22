import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useBulkCreateRooms, ROOM_TYPES } from '@/hooks/useRoomsV2';
import { useToast } from '@/hooks/use-toast';
import type { RoomV2 } from '@/hooks/useRoomsV2';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  existingRoomCount: number;
  unitId?: string;
}

type RoomCreateInput = Omit<RoomV2, 'id' | 'created_at' | 'updated_at'> & {
  unit_id?: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function BulkAddRoomsModal({ open, onOpenChange, propertyId, existingRoomCount, unitId }: Props) {
  const bulkCreate = useBulkCreateRooms();
  const { toast } = useToast();
  const [count, setCount] = useState('3');
  const [roomType, setRoomType] = useState('double');
  const [rent, setRent] = useState('');
  const [startNum, setStartNum] = useState((existingRoomCount + 1).toString());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(count);
    if (!n || n < 1 || n > 20) {
      toast({ title: 'Enter 1-20 rooms', variant: 'destructive' });
      return;
    }
    const start = parseInt(startNum) || (existingRoomCount + 1);
    const rooms: RoomCreateInput[] = [];
    for (let i = 0; i < n; i++) {
      const room: RoomCreateInput = {
        property_id: propertyId,
        room_name: `Room ${start + i}`,
        room_type: roomType as RoomV2['room_type'],
        floor: null,
        has_ensuite: roomType === 'ensuite',
        is_lettable: roomType !== 'communal',
        current_rent_pcm: rent ? parseFloat(rent) : null,
        target_rent_pcm: rent ? parseFloat(rent) : null,
        occupancy_status: roomType === 'communal' ? 'unavailable' : 'vacant',
        notes: null,
      };
      if (unitId) room.unit_id = unitId;
      rooms.push(room);
    }
    try {
      await bulkCreate.mutateAsync(rooms);
      toast({ title: `${n} rooms added` });
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick Add Rooms</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Number of rooms (1–20)</Label><Input type="number" min="1" max="20" value={count} onChange={e => setCount(e.target.value)} /></div>
          <div>
            <Label>Default room type</Label>
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROOM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Default rent (£ /pcm)</Label><Input type="number" step="0.01" value={rent} onChange={e => setRent(e.target.value)} placeholder="Optional" /></div>
          <div><Label>Starting room number</Label><Input type="number" value={startNum} onChange={e => setStartNum(e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={bulkCreate.isPending}>Add Rooms</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
