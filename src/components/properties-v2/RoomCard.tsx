import { useNavigate } from 'react-router-dom';
import { Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDeleteRoom } from '@/hooks/useRoomsV2';
import { useToast } from '@/hooks/use-toast';
import type { RoomV2 } from '@/hooks/useRoomsV2';

const ROOM_TYPE_BG: Record<string, string> = {
  single: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  double: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  ensuite: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  studio: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  bedsit: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  communal: 'bg-muted text-muted-foreground',
};

const OCCUPANCY_BG: Record<string, string> = {
  occupied: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  vacant: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  under_offer: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  unavailable: 'bg-muted text-muted-foreground',
  refurbishment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

const OCCUPANCY_BORDER: Record<string, string> = {
  occupied: 'border-l-emerald-500',
  vacant: 'border-l-red-500',
  under_offer: 'border-l-amber-500',
  unavailable: 'border-l-muted-foreground',
  refurbishment: 'border-l-orange-500',
};

const OCCUPANCY_LABELS: Record<string, string> = {
  occupied: 'Occupied', vacant: 'Vacant', under_offer: 'Under Offer',
  unavailable: 'Unavailable', refurbishment: 'Refurbishment',
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  single: 'Single', double: 'Double', ensuite: 'En-suite',
  studio: 'Studio', bedsit: 'Bedsit', communal: 'Communal',
};

function fmtRent(v: number | null) {
  if (v == null) return '—';
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
  room: RoomV2;
  onEdit: (room: RoomV2) => void;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function RoomCard({ room, onEdit }: Props) {
  const navigate = useNavigate();
  const deleteRoom = useDeleteRoom();
  const { toast } = useToast();

  const isVacant = room.occupancy_status === 'vacant';
  const targetRent = room.target_rent_pcm ?? room.current_rent_pcm;
  const dailyVoidCost = isVacant && targetRent ? (targetRent / 30.44) : null;

  return (
    <Card
      className={`border-l-4 ${OCCUPANCY_BORDER[room.occupancy_status]} cursor-pointer hover:shadow-md transition-shadow ${isVacant ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}
      onClick={() => navigate(`/rooms-v2/${room.id}`)}
    >
      <CardContent className="pt-4 pb-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-foreground truncate">{room.room_name}</span>
            <Badge variant="secondary" className={`text-xs ${ROOM_TYPE_BG[room.room_type]}`}>
              {ROOM_TYPE_LABELS[room.room_type]}
            </Badge>
            {room.has_ensuite && room.room_type !== 'ensuite' && (
              <Badge variant="secondary" className="text-xs bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">En-suite</Badge>
            )}
          </div>
        </div>

        {/* Occupancy */}
        <Badge className={`${OCCUPANCY_BG[room.occupancy_status]} ${isVacant ? 'animate-pulse' : ''}`}>
          {OCCUPANCY_LABELS[room.occupancy_status]}
        </Badge>

        {/* Tenant placeholder */}
        <p className="text-xs text-muted-foreground italic">Tenant details available after tenants module</p>

        {/* Rent */}
        <div>
          {isVacant ? (
            <>
              <span className="font-bold text-destructive">£0 /pcm</span>
              {targetRent && <span className="text-xs text-muted-foreground ml-2">Target: {fmtRent(targetRent)} /pcm</span>}
            </>
          ) : (
            <>
              <span className="font-bold text-foreground">{fmtRent(room.current_rent_pcm)} /pcm</span>
              {room.target_rent_pcm && room.target_rent_pcm !== room.current_rent_pcm && (
                <span className="text-xs text-muted-foreground ml-2">Target: {fmtRent(room.target_rent_pcm)} /pcm</span>
              )}
            </>
          )}
        </div>

        {/* Floor */}
        {room.floor != null && <p className="text-xs text-muted-foreground">Floor {room.floor}</p>}

        {/* Void cost */}
        {dailyVoidCost != null && (
          <p className="text-xs text-destructive font-medium">Void cost: £{dailyVoidCost.toFixed(2)} /day</p>
        )}

        {/* Actions */}
        <div className="flex gap-1 pt-1" onClick={e => e.stopPropagation()}>
          <Button aria-label="Edit" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(room)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button aria-label="Delete" variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {room.room_name}?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={async () => {
                    try {
                      await deleteRoom.mutateAsync({ id: room.id, propertyId: room.property_id });
                      toast({ title: 'Room deleted' });
                    } catch (error: unknown) {
                      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
                    }
                  }}
                >Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
