import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useUpdateRoom, type Room, type RoomType, type RoomStatus } from '@/hooks/useRooms';

interface EditRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
}

export function EditRoomDialog({ open, onOpenChange, room }: EditRoomDialogProps) {
  const updateRoom = useUpdateRoom();
  const [formData, setFormData] = useState({
    room_name: room.room_name,
    room_number: room.room_number || '',
    floor: String(room.floor ?? 0),
    room_type: room.room_type,
    status: room.status,
    target_rent_pcm: room.target_rent_pcm ? String(room.target_rent_pcm) : '',
    square_footage: room.square_footage ? String(room.square_footage) : '',
    description: room.description || '',
    amenities: room.amenities?.join(', ') || '',
  });

  useEffect(() => {
    setFormData({
      room_name: room.room_name,
      room_number: room.room_number || '',
      floor: String(room.floor ?? 0),
      room_type: room.room_type,
      status: room.status,
      target_rent_pcm: room.target_rent_pcm ? String(room.target_rent_pcm) : '',
      square_footage: room.square_footage ? String(room.square_footage) : '',
      description: room.description || '',
      amenities: room.amenities?.join(', ') || '',
    });
  }, [room]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.room_name) return;

    await updateRoom.mutateAsync({
      id: room.id,
      room_name: formData.room_name,
      room_number: formData.room_number || null,
      floor: parseInt(formData.floor) || 0,
      room_type: formData.room_type as RoomType,
      status: formData.status as RoomStatus,
      target_rent_pcm: formData.target_rent_pcm ? parseFloat(formData.target_rent_pcm) : null,
      square_footage: formData.square_footage ? parseFloat(formData.square_footage) : null,
      description: formData.description || null,
      amenities: formData.amenities
        ? formData.amenities.split(',').map(a => a.trim()).filter(Boolean)
        : null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />Edit Room — {room.room_name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="room_name">Room Name *</Label>
              <Input id="room_name" value={formData.room_name}
                onChange={e => setFormData(prev => ({ ...prev, room_name: e.target.value }))} required />
            </div>
            <div>
              <Label htmlFor="room_number">Room Number</Label>
              <Input id="room_number" value={formData.room_number}
                onChange={e => setFormData(prev => ({ ...prev, room_number: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={formData.room_type} onValueChange={v => setFormData(prev => ({ ...prev, room_type: v as RoomType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                  <SelectItem value="ensuite">En-suite</SelectItem>
                  <SelectItem value="studio">Studio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Floor</Label>
              <Select value={formData.floor} onValueChange={v => setFormData(prev => ({ ...prev, floor: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">Basement</SelectItem>
                  <SelectItem value="0">Ground</SelectItem>
                  <SelectItem value="1">1st</SelectItem>
                  <SelectItem value="2">2nd</SelectItem>
                  <SelectItem value="3">3rd</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData(prev => ({ ...prev, status: v as RoomStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="notice">Notice</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target Rent (£/month)</Label>
              <Input type="number" value={formData.target_rent_pcm}
                onChange={e => setFormData(prev => ({ ...prev, target_rent_pcm: e.target.value }))} />
            </div>
            <div>
              <Label>Size (sq ft)</Label>
              <Input type="number" value={formData.square_footage}
                onChange={e => setFormData(prev => ({ ...prev, square_footage: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label>Amenities (comma-separated)</Label>
            <Input value={formData.amenities}
              onChange={e => setFormData(prev => ({ ...prev, amenities: e.target.value }))} />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateRoom.isPending || !formData.room_name}>
              {updateRoom.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
