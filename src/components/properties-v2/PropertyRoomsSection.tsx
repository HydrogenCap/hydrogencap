import { useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePropertyRooms } from '@/hooks/useRoomsV2';
import { RoomCard } from './RoomCard';
import { RoomFormModal } from './RoomFormModal';
import { BulkAddRoomsModal } from './BulkAddRoomsModal';
import type { RoomV2 } from '@/hooks/useRoomsV2';

interface Props {
  propertyId: string;
}

function fmtGBP(v: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
}

export function PropertyRoomsSection({ propertyId }: Props) {
  const { data: rooms } = usePropertyRooms(propertyId);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomV2 | null>(null);

  const lettable = rooms?.filter(r => r.is_lettable) || [];
  const occupied = lettable.filter(r => r.occupancy_status === 'occupied');
  const occupancyRate = lettable.length > 0 ? (occupied.length / lettable.length) * 100 : 0;
  const grossRent = occupied.reduce((s, r) => s + (r.current_rent_pcm || 0), 0);
  const potentialRent = lettable.reduce((s, r) => s + (r.target_rent_pcm ?? r.current_rent_pcm ?? 0), 0);

  const occupancyColor = occupancyRate >= 100
    ? 'bg-emerald-100 text-emerald-700'
    : occupancyRate >= 80
    ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle>Rooms</CardTitle>
            {lettable.length > 0 && (
              <Badge className={occupancyColor}>
                {occupied.length} / {lettable.length} occupied
              </Badge>
            )}
            {grossRent > 0 && (
              <span className="text-sm font-medium text-foreground">{fmtGBP(grossRent)} /month</span>
            )}
            {potentialRent > 0 && potentialRent !== grossRent && (
              <span className="text-xs text-muted-foreground">{fmtGBP(potentialRent)} /month potential</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowBulk(true)}>
              <Layers className="h-4 w-4 mr-1" /> Quick Add
            </Button>
            <Button size="sm" onClick={() => { setEditingRoom(null); setShowAdd(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Room
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rooms && rooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onEdit={(r) => { setEditingRoom(r); setShowAdd(true); }}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6">
              No rooms added yet. Add rooms to track occupancy and rent.
            </p>
          )}
        </CardContent>
      </Card>

      <RoomFormModal
        open={showAdd}
        onOpenChange={setShowAdd}
        propertyId={propertyId}
        editingRoom={editingRoom}
      />
      <BulkAddRoomsModal
        open={showBulk}
        onOpenChange={setShowBulk}
        propertyId={propertyId}
        existingRoomCount={rooms?.length || 0}
      />
    </>
  );
}
