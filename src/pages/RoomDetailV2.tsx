import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useRoom, useUpdateRoom, ROOM_TYPES, OCCUPANCY_STATUSES } from '@/hooks/useRoomsV2';
import { RoomFormModal } from '@/components/properties-v2/RoomFormModal';
import { useToast } from '@/hooks/use-toast';

const ROOM_TYPE_BG: Record<string, string> = {
  single: 'bg-slate-100 text-slate-700', double: 'bg-blue-100 text-blue-700',
  ensuite: 'bg-indigo-100 text-indigo-700', studio: 'bg-purple-100 text-purple-700',
  bedsit: 'bg-teal-100 text-teal-700', communal: 'bg-muted text-muted-foreground',
};

const OCCUPANCY_BG: Record<string, string> = {
  occupied: 'bg-emerald-100 text-emerald-700', vacant: 'bg-red-100 text-red-700',
  under_offer: 'bg-amber-100 text-amber-700', unavailable: 'bg-muted text-muted-foreground',
  refurbishment: 'bg-orange-100 text-orange-700',
};

function getLabel(arr: readonly { value: string; label: string }[], v: string) {
  return arr.find(x => x.value === v)?.label || v;
}

function fmtRent(v: number | null) {
  if (v == null) return '—';
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RoomDetailV2() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: room, isLoading } = useRoom(id);
  const updateRoom = useUpdateRoom();
  const [showEdit, setShowEdit] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');

  if (isLoading) {
    return <AppLayout><div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-48 w-full" /></div></AppLayout>;
  }
  if (!room) {
    return <AppLayout><div className="text-center py-16 text-muted-foreground">Room not found.</div></AppLayout>;
  }

  const prop = room.properties_v2;
  const isVacant = room.occupancy_status === 'vacant';
  const targetRent = room.target_rent_pcm ?? room.current_rent_pcm;
  const dailyVoidCost = isVacant && targetRent ? (targetRent / 30.44) : null;
  const rentDiff = room.current_rent_pcm != null && room.target_rent_pcm != null
    ? room.current_rent_pcm - room.target_rent_pcm : null;

  const handleSaveNotes = async () => {
    try {
      await updateRoom.mutateAsync({ id: room.id, notes: notesValue || null });
      setEditingNotes(false);
      toast({ title: 'Notes saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/properties-v2/${room.property_id}`)} className="mb-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> {prop.address_line_1}, {prop.city}
            </Button>
            <h1 className="text-2xl font-bold text-foreground">{room.room_name}</h1>
            <div className="flex items-center gap-2">
              <Badge className={ROOM_TYPE_BG[room.room_type]}>{getLabel(ROOM_TYPES, room.room_type)}</Badge>
              <Badge className={OCCUPANCY_BG[room.occupancy_status]}>{getLabel(OCCUPANCY_STATUSES, room.occupancy_status)}</Badge>
              {room.has_ensuite && room.room_type !== 'ensuite' && (
                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700">En-suite</Badge>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        </div>

        {/* Details */}
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

        {/* Void Cost */}
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

        {/* Rent Differential */}
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

        {/* Tenant */}
        <Card>
          <CardHeader><CardTitle>Tenant</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-6">Tenant history will appear here once the tenants module is built.</p>
          </CardContent>
        </Card>

        {/* Void History */}
        <Card>
          <CardHeader><CardTitle>Void History</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-6">Void period tracking will appear here once tenancy agreements are linked.</p>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Notes</CardTitle>
            {!editingNotes && (
              <Button variant="ghost" size="sm" onClick={() => { setNotesValue(room.notes || ''); setEditingNotes(true); }}>
                <Edit className="h-3 w-3 mr-1" /> Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={4} />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveNotes} disabled={updateRoom.isPending}>Save</Button>
                </div>
              </div>
            ) : (
              <p className={room.notes ? 'text-foreground' : 'text-muted-foreground'}>{room.notes || 'No notes'}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <RoomFormModal
        open={showEdit}
        onOpenChange={setShowEdit}
        propertyId={room.property_id}
        editingRoom={room}
      />
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
