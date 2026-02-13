import { useState } from 'react';
import { format } from 'date-fns';
import {
  DoorOpen, Plus, Pencil, Trash2, User, PoundSterling,
  BedDouble, BedSingle, Bath, Square, MoreVertical,
  Maximize2, CheckCircle2, AlertTriangle, Wrench, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useRoomsWithTenancy, useDeleteRoom, useRoomStats,
  type RoomWithTenancy, type RoomStatus, type RoomType,
} from '@/hooks/useRooms';
import { AddRoomDialog } from './AddRoomDialog';
import { EditRoomDialog } from './EditRoomDialog';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<RoomStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  occupied: { label: 'Occupied', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  vacant: { label: 'Vacant', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
  notice: { label: 'Notice', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  maintenance: { label: 'Maintenance', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Wrench },
};

const ROOM_TYPE_ICONS: Record<RoomType, typeof BedDouble> = {
  single: BedSingle,
  double: BedDouble,
  ensuite: Bath,
  studio: Maximize2,
};

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  single: 'Single',
  double: 'Double',
  ensuite: 'En-suite',
  studio: 'Studio',
};

interface RoomManagementPanelProps {
  propertyId: string;
}

export function RoomManagementPanel({ propertyId }: RoomManagementPanelProps) {
  const { data: rooms, isLoading } = useRoomsWithTenancy(propertyId);
  const stats = useRoomStats(propertyId);
  const deleteRoom = useDeleteRoom();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomWithTenancy | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<RoomWithTenancy | null>(null);

  const handleDelete = async () => {
    if (!deletingRoom) return;
    await deleteRoom.mutateAsync(deletingRoom.id);
    setDeletingRoom(null);
  };

  const totalActualRent = rooms?.reduce((sum, r) =>
    sum + (r.current_tenancy?.rent_amount_pcm || 0), 0) || 0;
  const totalTargetRent = rooms?.reduce((sum, r) =>
    sum + (r.target_rent_pcm || 0), 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5" />Rooms
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-lg" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5" />
            Rooms & Units
            {rooms && rooms.length > 0 && (
              <Badge variant="secondary" className="ml-1">{rooms.length}</Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />Add Room
          </Button>
        </div>

        {stats && stats.total > 0 && (
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Occupancy: <span className="font-semibold text-foreground">{stats.occupancyRate}%</span>
              </span>
              <span className="text-emerald-600">{stats.occupied} occupied</span>
              {stats.vacant > 0 && <span className="text-amber-600">{stats.vacant} vacant</span>}
              {stats.notice > 0 && <span className="text-blue-600">{stats.notice} on notice</span>}
              {stats.maintenance > 0 && <span className="text-red-600">{stats.maintenance} maintenance</span>}
            </div>
            <div className="flex-1 max-w-32">
              <Progress value={stats.occupancyRate} className="h-2" />
            </div>
          </div>
        )}

        {rooms && rooms.length > 0 && (
          <div className="flex items-center gap-4 text-sm pt-1">
            <span className="text-muted-foreground">
              Monthly rent: <span className="font-semibold text-foreground">£{totalActualRent.toLocaleString()}</span>
              {totalTargetRent > 0 && totalTargetRent !== totalActualRent && (
                <span className="text-muted-foreground"> / £{totalTargetRent.toLocaleString()} target</span>
              )}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {!rooms || rooms.length === 0 ? (
          <div className="text-center py-8">
            <DoorOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium mb-1">No rooms configured</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add rooms to track individual units, tenancies, and rent per room.
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />Add First Room
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.map(room => {
              const sc = STATUS_CONFIG[room.status];
              const StatusIcon = sc.icon;
              const TypeIcon = ROOM_TYPE_ICONS[room.room_type] || BedDouble;

              return (
                <div
                  key={room.id}
                  className={cn(
                    'border rounded-lg p-3.5 relative group transition-colors',
                    room.status === 'vacant' && 'border-amber-200 dark:border-amber-800/50',
                    room.status === 'occupied' && 'border-border',
                    room.status === 'notice' && 'border-blue-200 dark:border-blue-800/50',
                    room.status === 'maintenance' && 'border-red-200 dark:border-red-800/50',
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-sm truncate">{room.room_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={cn('text-[10px] px-1.5 h-5', sc.color)}>
                        <StatusIcon className="h-3 w-3 mr-0.5" />{sc.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingRoom(room)}>
                            <Pencil className="h-4 w-4 mr-2" />Edit Room
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingRoom(room)}>
                            <Trash2 className="h-4 w-4 mr-2" />Delete Room
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>{ROOM_TYPE_LABELS[room.room_type]}{room.floor !== null && room.floor !== undefined ? ` · Floor ${room.floor}` : ''}</span>
                      {room.square_footage && (
                        <span className="flex items-center gap-0.5">
                          <Square className="h-3 w-3" />{room.square_footage} sq ft
                        </span>
                      )}
                    </div>

                    {room.current_tenancy ? (
                      <div className="flex items-center justify-between text-foreground">
                        <span className="flex items-center gap-1">
                          <PoundSterling className="h-3 w-3" />
                          <span className="font-medium">£{room.current_tenancy.rent_amount_pcm.toLocaleString()}/mo</span>
                        </span>
                        {room.target_rent_pcm && room.current_tenancy.rent_amount_pcm < room.target_rent_pcm && (
                          <span className="text-amber-500 text-[10px]">
                            Target: £{room.target_rent_pcm.toLocaleString()}
                          </span>
                        )}
                      </div>
                    ) : room.target_rent_pcm ? (
                      <div className="flex items-center gap-1">
                        <PoundSterling className="h-3 w-3" />
                        <span>Target: £{room.target_rent_pcm.toLocaleString()}/mo</span>
                      </div>
                    ) : null}

                    {room.current_tenant ? (
                      <div className="flex items-center justify-between pt-1 border-t mt-1.5">
                        <span className="flex items-center gap-1 text-foreground">
                          <User className="h-3 w-3" />
                          {room.current_tenant.first_name} {room.current_tenant.last_name}
                        </span>
                        {room.current_tenancy?.end_date && (
                          <span className="text-[10px]">
                            Until {format(new Date(room.current_tenancy.end_date), 'dd MMM yy')}
                          </span>
                        )}
                      </div>
                    ) : room.status === 'vacant' ? (
                      <div className="pt-1 border-t mt-1.5">
                        <span className="text-amber-500 italic text-[10px]">No tenant assigned</span>
                      </div>
                    ) : null}

                    {room.amenities && room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {room.amenities.slice(0, 3).map((a, i) => (
                          <span key={i} className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{a}</span>
                        ))}
                        {room.amenities.length > 3 && (
                          <span className="text-[10px]">+{room.amenities.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AddRoomDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        propertyId={propertyId}
      />

      {editingRoom && (
        <EditRoomDialog
          open={!!editingRoom}
          onOpenChange={() => setEditingRoom(null)}
          room={editingRoom}
        />
      )}

      <AlertDialog open={!!deletingRoom} onOpenChange={() => setDeletingRoom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingRoom?.room_name}"?
              {deletingRoom?.status === 'occupied' && (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: This room has an active tenant. End the tenancy first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingRoom?.status === 'occupied'}
            >
              {deleteRoom.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
