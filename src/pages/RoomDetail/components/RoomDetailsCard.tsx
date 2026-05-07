import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROOM_TYPES, OCCUPANCY_STATUSES } from '@/hooks/useRoomsV2';
import { Row } from './Row';
import { fmtRent, getLabel } from '../utils/format';
import type { RoomDetailState } from '../hooks/useRoomDetailState';

export function RoomDetailsCard({ state }: { state: RoomDetailState }) {
  const { room } = state;
  if (!room) return null;
  const isVacant = room.occupancy_status === 'vacant';
  const targetRent = room.target_rent_pcm ?? room.current_rent_pcm;
  const dailyVoidCost = isVacant && targetRent ? (targetRent / 30.44) : null;
  const rentDiff = room.current_rent_pcm != null && room.target_rent_pcm != null
    ? room.current_rent_pcm - room.target_rent_pcm : null;

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="space-y-2">
              <Row label="Room Type" value={getLabel(ROOM_TYPES, room.room_type)} />
              <Row label="Floor" value={room.floor != null ? `Floor ${room.floor}` : '—'} />
              <Row label="Has En-suite" value={room.has_ensuite ? 'Yes' : 'No'} />
              <Row label="Is Lettable" value={room.is_lettable ? 'Yes' : 'No'} />
            </div>
            <div className="space-y-2">
              <Row label="Current Rent" value={`${fmtRent(room.current_rent_pcm)} /pcm`} />
              <Row label="Target Rent" value={`${fmtRent(room.target_rent_pcm)} /pcm`} />
              <Row label="Occupancy" value={getLabel(OCCUPANCY_STATUSES, room.occupancy_status)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {isVacant && dailyVoidCost != null && (
        <Card className="border-destructive/30 bg-red-50/50 dark:bg-red-950/10">
          <CardContent className="pt-4 pb-3">
            <p className="text-destructive font-semibold text-lg">
              This room is costing £{dailyVoidCost.toFixed(2)} per day in lost rent
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Based on target rent of {fmtRent(targetRent)} /pcm
            </p>
          </CardContent>
        </Card>
      )}

      {rentDiff != null && rentDiff !== 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className={`font-semibold ${rentDiff < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              Current rent is £{Math.abs(rentDiff).toFixed(2)} {rentDiff < 0 ? 'below' : 'above'} target
            </p>
            <p className="text-sm text-muted-foreground">
              Annual impact: £{(Math.abs(rentDiff) * 12).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
