import { useState } from 'react';
import { DoorOpen } from 'lucide-react';
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
import { useCreateRoom, type RoomType, type RoomStatus } from '@/hooks/useRooms';

interface AddRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function AddRoomDialog({ open, onOpenChange, propertyId }: AddRoomDialogProps) {
  const createRoom = useCreateRoom();
  const [formData, setFormData] = useState({
    room_name: '',
    room_number: '',
    floor: '0',
    room_type: 'double' as RoomType,
    status: 'vacant' as RoomStatus,
    target_rent_pcm: '',
    square_footage: '',
    description: '',
    amenities: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.room_name) return;

    await createRoom.mutateAsync({
      property_id: propertyId,
      room_name: formData.room_name,
      room_number: formData.room_number || null,
      floor: parseInt(formData.floor) || 0,
      room_type: formData.room_type,
      status: formData.status,
      target_rent_pcm: formData.target_rent_pcm ? parseFloat(formData.target_rent_pcm) : null,
      square_footage: formData.square_footage ? parseFloat(formData.square_footage) : null,
      description: formData.description || null,
      amenities: formData.amenities
        ? formData.amenities.split(',').map(a => a.trim()).filter(Boolean)
        : null,
      photos: null,
    });

    setFormData({
      room_name: '', room_number: '', floor: '0', room_type: 'double',
      status: 'vacant', target_rent_pcm: '', square_footage: '', description: '', amenities: '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5" />Add Room
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="room_name">Room Name *</Label>
              <Input
                id="room_name"
                placeholder="e.g. Room 1, Master Bedroom"
                value={formData.room_name}
                onChange={e => setFormData(prev => ({ ...prev, room_name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="room_number">Room Number</Label>
              <Input
                id="room_number"
                placeholder="e.g. 1A"
                value={formData.room_number}
                onChange={e => setFormData(prev => ({ ...prev, room_number: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="room_type">Type</Label>
              <Select
                value={formData.room_type}
                onValueChange={v => setFormData(prev => ({ ...prev, room_type: v as RoomType }))}
              >
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
              <Label htmlFor="floor">Floor</Label>
              <Select
                value={formData.floor}
                onValueChange={v => setFormData(prev => ({ ...prev, floor: v }))}
              >
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
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={v => setFormData(prev => ({ ...prev, status: v as RoomStatus }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="target_rent">Target Rent (£/month)</Label>
              <Input
                id="target_rent"
                type="number"
                placeholder="e.g. 650"
                value={formData.target_rent_pcm}
                onChange={e => setFormData(prev => ({ ...prev, target_rent_pcm: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="sqft">Size (sq ft)</Label>
              <Input
                id="sqft"
                type="number"
                placeholder="e.g. 120"
                value={formData.square_footage}
                onChange={e => setFormData(prev => ({ ...prev, square_footage: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="amenities">Amenities (comma-separated)</Label>
            <Input
              id="amenities"
              placeholder="e.g. en-suite, wardrobe, desk, window"
              value={formData.amenities}
              onChange={e => setFormData(prev => ({ ...prev, amenities: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="description">Notes</Label>
            <Textarea
              id="description"
              placeholder="Any additional notes about this room"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createRoom.isPending || !formData.room_name}>
              {createRoom.isPending ? 'Adding…' : 'Add Room'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
