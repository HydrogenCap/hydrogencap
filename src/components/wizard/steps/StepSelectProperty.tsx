import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import type { WizardPayload } from '@/lib/wizard/types';

interface StepProps {
  payload: WizardPayload;
  updatePayload: (partial: Partial<WizardPayload>) => void;
}

interface Property {
  id: string;
  address_line_1: string;
  postcode: string;
}

interface Room {
  id: string;
  room_name: string;
  room_type: string;
}

export function StepSelectProperty({ payload, updatePayload }: StepProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const orgId = await fetchUserOrgId();
      setOrgId(orgId);
      const { data } = await supabase
        .from('properties_v2')
        .select('id, address_line_1, postcode')
        .eq('org_id', orgId)
        .order('address_line_1');
      if (data) setProperties(data);
    }
    load();
  }, []);

  // Load rooms when property changes
  useEffect(() => {
    const propertyId = payload.property_id as string;
    if (!propertyId || !orgId) {
      setRooms([]);
      return;
    }
    async function loadRooms() {
      const { data } = await supabase
        .from('rooms_v2')
        .select('id, room_name, room_type')
        .eq('property_id', propertyId)
        .eq('org_id', orgId)
        .order('room_name');
      setRooms(data || []);
    }
    loadRooms();
  }, [payload.property_id, orgId]);

  return (
    <div className="space-y-4">
      <div>
        <Label>Property *</Label>
        <Select
          value={(payload.property_id as string) || ''}
          onValueChange={(v) => {
            const prop = properties.find((p) => p.id === v);
            updatePayload({
              property_id: v,
              _property_address: prop ? `${prop.address_line_1}, ${prop.postcode}` : '',
              room_id: undefined,
              _room_name: undefined,
            });
          }}
        >
          <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.address_line_1}, {p.postcode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rooms.length > 0 && (
        <div>
          <Label>Room (optional)</Label>
          <Select
            value={(payload.room_id as string) || '__none__'}
            onValueChange={(v) => {
              const roomId = v === '__none__' ? undefined : v;
              const room = rooms.find((r) => r.id === v);
              updatePayload({
                room_id: roomId,
                _room_name: room ? room.room_name : undefined,
              });
            }}
          >
            <SelectTrigger><SelectValue placeholder="Whole property" /></SelectTrigger>
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
      )}
    </div>
  );
}
