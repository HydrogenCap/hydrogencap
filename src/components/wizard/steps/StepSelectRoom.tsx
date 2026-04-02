import { useEffect, useState } from 'react';
import { DoorOpen, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

interface Room {
  id: string;
  room_name: string;
  room_type: string;
}

export function StepSelectRoom({ payload, updatePayload }: StepProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const propertyId = payload.property_id as string | undefined;

  useEffect(() => {
    if (!propertyId) {
      setRooms([]);
      setLoaded(true);
      updatePayload({ room_id: null, _room_name: undefined });
      return;
    }

    setLoading(true);
    (supabase as any)
      .from('rooms_v2')
      .select('id, room_name, room_type')
      .eq('property_id', propertyId)
      .order('room_name')
      .then(({ data }) => {
        const list = data || [];
        setRooms(list);
        setLoaded(true);
        setLoading(false);
        if (list.length === 0) {
          updatePayload({ room_id: null, _room_name: undefined });
        }
      });
  }, [propertyId, updatePayload]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading rooms…
      </div>
    );
  }

  if (loaded && rooms.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border p-4 bg-muted/30">
        <DoorOpen className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">No rooms found</p>
          <p className="text-sm text-muted-foreground">
            This document will apply to the whole property.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Room (optional)</Label>
        <Select
          value={(payload.room_id as string) || '__none__'}
          onValueChange={(v) => {
            const roomId = v === '__none__' ? null : v;
            const room = rooms.find((r) => r.id === v);
            updatePayload({
              room_id: roomId,
              _room_name: room ? room.room_name : undefined,
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Whole property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Whole property</SelectItem>
            {rooms.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.room_name} ({r.room_type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Assign to a specific room for HMO room-level compliance
        </p>
      </div>
    </div>
  );
}
