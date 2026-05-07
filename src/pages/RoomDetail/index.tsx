import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ROOM_TYPES, OCCUPANCY_STATUSES } from '@/hooks/useRoomsV2';
import { RoomFormModal } from '@/components/properties-v2/RoomFormModal';
import { CreateTenancyAgreementModal } from '@/components/tenants-v2/CreateTenancyAgreementModal';
import { useRoomDetailState } from './hooks/useRoomDetailState';
import { ROOM_TYPE_BG, OCCUPANCY_BG } from './utils/badges';
import { getLabel } from './utils/format';
import { RoomDetailsCard } from './components/RoomDetailsCard';
import { CurrentTenantCard } from './components/CurrentTenantCard';
import { VoidHistoryCard } from './components/VoidHistoryCard';
import { RentHistoryCard } from './components/RentHistoryCard';
import { NotesCard } from './components/NotesCard';
import { RoomComplianceCard } from './components/RoomComplianceCard';
import { RoomMetricsCard } from './components/RoomMetricsCard';
import { RoomPnLCard } from './components/RoomPnLCard';
import { SEO } from '@/components/SEO';

export default function RoomDetail() {
  const navigate = useNavigate();
  const state = useRoomDetailState();
  const { room, isLoading, showEdit, setShowEdit, showCreateAgreement, setShowCreateAgreement } = state;

  if (isLoading) {
    return <AppLayout><div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-48 w-full" /></div></AppLayout>;
  }
  if (!room) {
    return <AppLayout><div className="text-center py-16 text-muted-foreground">Room not found.</div></AppLayout>;
  }
  const prop = room.properties_v2;

  return (
    <AppLayout>
      <div className="space-y-6">
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

        <RoomDetailsCard state={state} />
        <CurrentTenantCard state={state} />
        <VoidHistoryCard state={state} />
        <RentHistoryCard state={state} />
        <NotesCard state={state} />
        <RoomComplianceCard state={state} />
        <RoomMetricsCard state={state} />
        <RoomPnLCard state={state} />
      </div>

      <RoomFormModal open={showEdit} onOpenChange={setShowEdit} propertyId={room.property_id} editingRoom={room} />
      <CreateTenancyAgreementModal
        open={showCreateAgreement}
        onOpenChange={setShowCreateAgreement}
        preselectedPropertyId={room.property_id}
        preselectedRoomId={room.id}
      />
    </AppLayout>
  );
}
