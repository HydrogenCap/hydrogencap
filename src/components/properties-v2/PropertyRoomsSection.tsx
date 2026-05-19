import { useState } from 'react';
import { Plus, Layers, Home, Building2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePropertyRooms } from '@/hooks/useRoomsV2';
import { usePropertyUnits, useDeletePropertyUnit, type PropertyUnit } from '@/hooks/usePropertyUnits';
import { RoomCard } from './RoomCard';
import { RoomFormModal } from './RoomFormModal';
import { BulkAddRoomsModal } from './BulkAddRoomsModal';
import { UnitFormModal } from './UnitFormModal';
import { useToast } from '@/hooks/use-toast';
import type { RoomV2 } from '@/hooks/useRoomsV2';

interface Props {
  propertyId: string;
  rentBasis?: 'room' | 'whole_house';
  wholeHouseRentPcm?: number | null;
}

type RoomWithUnit = RoomV2 & { unit_id?: string | null };

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function fmtGBP(v: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
}

export function PropertyRoomsSection({ propertyId }: Props) {
  const { data: rooms } = usePropertyRooms(propertyId);
  const { data: units } = usePropertyUnits(propertyId);
  const deleteUnit = useDeletePropertyUnit();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomV2 | null>(null);
  const [addToUnitId, setAddToUnitId] = useState<string | null>(null);
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<PropertyUnit | null>(null);

  const hasMultipleUnits = (units?.length || 0) > 1;

  // Group rooms by unit
  const roomsByUnit = new Map<string, RoomV2[]>();
  (rooms as RoomWithUnit[] | undefined)?.forEach(room => {
    const uid = room.unit_id || 'unassigned';
    if (!roomsByUnit.has(uid)) roomsByUnit.set(uid, []);
    roomsByUnit.get(uid)!.push(room);
  });

  const handleDeleteUnit = async (unit: PropertyUnit) => {
    try {
      await deleteUnit.mutateAsync({ id: unit.id, propertyId });
      toast({ title: `Unit "${unit.unit_name}" deleted` });
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const renderUnitStats = (unitRooms: RoomV2[], unit?: PropertyUnit) => {
    if (unit?.rent_basis === 'whole_house') {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-primary/10 text-primary">
            <Home className="h-3 w-3 mr-1" /> Whole Unit
          </Badge>
          {unit.whole_house_rent_pcm != null && unit.whole_house_rent_pcm > 0 && (
            <span className="text-sm font-medium text-foreground">{fmtGBP(unit.whole_house_rent_pcm)} /month</span>
          )}
        </div>
      );
    }

    const lettable = unitRooms.filter(r => r.is_lettable);
    const occupied = lettable.filter(r => r.occupancy_status === 'occupied');
    const grossRent = occupied.reduce((s, r) => s + (r.current_rent_pcm || 0), 0);
    const occupancyRate = lettable.length > 0 ? (occupied.length / lettable.length) * 100 : 0;
    const occupancyColor = occupancyRate >= 100
      ? 'bg-emerald-100 text-emerald-700'
      : occupancyRate >= 80
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';

    return (
      <div className="flex items-center gap-2 flex-wrap">
        {lettable.length > 0 && (
          <Badge className={occupancyColor}>
            {occupied.length} / {lettable.length} occupied
          </Badge>
        )}
        {grossRent > 0 && (
          <span className="text-sm font-medium text-foreground">{fmtGBP(grossRent)} /month</span>
        )}
      </div>
    );
  };

  const renderUnitSection = (unit: PropertyUnit) => {
    const unitRooms = roomsByUnit.get(unit.id) || [];

    return (
      <div key={unit.id} className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">{unit.unit_name}</h4>
            </div>
            {renderUnitStats(unitRooms, unit)}
          </div>
          <div className="flex gap-1">
            <Button aria-label="Edit" variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => { setEditingUnit(unit); setShowUnitForm(true); }}>
              <Pencil className="h-3 w-3" />
            </Button>
            {hasMultipleUnits && unitRooms.length === 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button aria-label="Delete" variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete unit?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the "{unit.unit_name}" unit. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteUnit(unit)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {unit.rent_basis !== 'whole_house' && (
              <Button variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => { setAddToUnitId(unit.id); setEditingRoom(null); setShowAdd(true); }}>
                <Plus className="h-3 w-3 mr-1" /> Room
              </Button>
            )}
          </div>
        </div>
        {unit.rent_basis === 'whole_house' ? (
          <p className="text-muted-foreground text-sm pl-6">
            This unit is let as a whole. Rent is tracked at the unit level.
          </p>
        ) : unitRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
            {unitRooms.map(room => (
              <RoomCard key={room.id} room={room}
                onEdit={(r) => { setEditingRoom(r); setAddToUnitId(unit.id); setShowAdd(true); }} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-3 pl-6">
            No rooms in this unit yet.
          </p>
        )}
      </div>
    );
  };

  // Total stats across all units
  const allLettable = rooms?.filter(r => r.is_lettable) || [];
  const allOccupied = allLettable.filter(r => r.occupancy_status === 'occupied');
  const totalRoomRent = allOccupied.reduce((s, r) => s + (r.current_rent_pcm || 0), 0);
  const totalUnitRent = (units || [])
    .filter(u => u.rent_basis === 'whole_house')
    .reduce((s, u) => s + (u.whole_house_rent_pcm || 0), 0);
  const totalRent = totalRoomRent + totalUnitRent;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle>Units & Rooms</CardTitle>
            {totalRent > 0 && (
              <span className="text-sm font-medium text-foreground">{fmtGBP(totalRent)} /month total</span>
            )}
            {hasMultipleUnits && (
              <Badge variant="secondary">{units!.length} units</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditingUnit(null); setShowUnitForm(true); }}>
              <Building2 className="h-4 w-4 mr-1" /> Add Unit
            </Button>
            {!hasMultipleUnits && units?.[0]?.rent_basis !== 'whole_house' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowBulk(true)}>
                  <Layers className="h-4 w-4 mr-1" /> Quick Add
                </Button>
                <Button size="sm" onClick={() => { setEditingRoom(null); setAddToUnitId(units?.[0]?.id || null); setShowAdd(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Add Room
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {units && units.length > 0 ? (
            units.map(unit => renderUnitSection(unit))
          ) : (
            <p className="text-muted-foreground text-center py-6">
              No units configured. Add a unit to get started.
            </p>
          )}
        </CardContent>
      </Card>

      <RoomFormModal
        open={showAdd}
        onOpenChange={setShowAdd}
        propertyId={propertyId}
        editingRoom={editingRoom}
        unitId={addToUnitId}
      />
      <BulkAddRoomsModal
        open={showBulk}
        onOpenChange={setShowBulk}
        propertyId={propertyId}
        existingRoomCount={rooms?.length || 0}
        unitId={units?.[0]?.id}
      />
      <UnitFormModal
        open={showUnitForm}
        onOpenChange={setShowUnitForm}
        propertyId={propertyId}
        editingUnit={editingUnit}
        existingCount={units?.length || 0}
      />
    </>
  );
}
