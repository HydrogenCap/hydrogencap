/**
 * Void Detection — identifies rooms with no active tenancy and no tracked void period.
 */

export interface DetectedVoid {
  roomId: string;
  roomName: string;
  propertyId: string;
  propertyAddress: string;
  currentRentPcm: number | null;
}

interface RoomV2 {
  id: string;
  property_id: string;
  room_name: string;
  is_lettable: boolean;
  occupancy_status: string | null;
  current_rent_pcm: number | null;
}

interface TenancyAgreement {
  room_id: string;
  status: string;
  start_date: string;
  actual_end_date: string | null;
}

interface VoidPeriodRef {
  property_id: string;
  room_id: string | null;
  end_date: string | null;
}

interface PropertyRef {
  id: string;
  address_line_1: string;
  postcode: string;
}

export function detectVoidRooms(
  rooms: RoomV2[],
  tenancies: TenancyAgreement[],
  existingVoids: VoidPeriodRef[],
  properties: PropertyRef[],
): DetectedVoid[] {
  const today = new Date().toISOString().split('T')[0];
  const propertyMap = new Map(properties.map(p => [p.id, p]));
  const detected: DetectedVoid[] = [];

  for (const room of rooms) {
    if (!room.is_lettable) continue;

    // Check for active tenancy on this room
    const hasActiveTenancy = tenancies.some(t =>
      t.room_id === room.id &&
      ['active', 'periodic', 'notice_served', 'notice_period'].includes(t.status) &&
      t.start_date <= today &&
      (!t.actual_end_date || t.actual_end_date >= today)
    );

    if (hasActiveTenancy) continue;

    // Check for existing open void period for this room
    const hasOpenVoid = existingVoids.some(v =>
      v.end_date === null &&
      (v.room_id === room.id || (!v.room_id && v.property_id === room.property_id))
    );

    if (hasOpenVoid) continue;

    const prop = propertyMap.get(room.property_id);
    detected.push({
      roomId: room.id,
      roomName: room.room_name,
      propertyId: room.property_id,
      propertyAddress: prop ? `${prop.address_line_1}, ${prop.postcode}` : 'Unknown',
      currentRentPcm: room.current_rent_pcm,
    });
  }

  return detected;
}
