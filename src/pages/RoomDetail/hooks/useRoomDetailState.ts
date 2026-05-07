import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { useRoom, useUpdateRoom } from '@/hooks/useRoomsV2';
import { useRoomPnL, type RoomPnLPeriod } from '@/hooks/useRoomPnL';
import { useTenancyAgreements } from '@/hooks/useTenancyAgreements';
import { useToast } from '@/hooks/use-toast';
import { supabaseAny } from '@/integrations/supabase/client';

export interface ComplianceDocument {
  id: string;
  document_type: string;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
}

interface MaintenanceCostRow { actual_cost: number | null }

export function useRoomDetailState() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: room, isLoading } = useRoom(id);
  const { data: roomAgreements } = useTenancyAgreements({ roomId: id });
  const updateRoom = useUpdateRoom();

  const [showEdit, setShowEdit] = useState(false);
  const [showCreateAgreement, setShowCreateAgreement] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [compliance, setCompliance] = useState<ComplianceDocument[]>([]);
  const [maintenanceCosts, setMaintenanceCosts] = useState<MaintenanceCostRow[]>([]);
  const [pnlPeriod, setPnlPeriod] = useState<RoomPnLPeriod>('last_12_months');
  const { data: roomPnL, isLoading: pnlLoading } = useRoomPnL(id, pnlPeriod);

  useEffect(() => {
    if (!id) return;
    void supabaseAny.from('compliance_documents_v2').select('*').eq('room_id', id)
      .order('expiry_date', { ascending: true })
      .then(({ data }) => setCompliance((data as ComplianceDocument[] | null) || []));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void supabaseAny.from('maintenance_requests').select('actual_cost').eq('room_v2_id', id)
      .not('actual_cost', 'is', null)
      .then(({ data }) => setMaintenanceCosts((data as MaintenanceCostRow[] | null) || []));
  }, [id]);

  const activeAgreement = useMemo(
    () => roomAgreements?.find(a => a.status === 'active' || a.status === 'notice_period'),
    [roomAgreements],
  );

  const sortedAgreements = useMemo(() => {
    if (!roomAgreements) return [];
    const dir = pnlPeriod === 'all_time' ? 1 : -1;
    return [...roomAgreements].sort((a, b) => dir * a.start_date.localeCompare(b.start_date));
  }, [roomAgreements, pnlPeriod]);

  const voidPeriods = useMemo(() => {
    if (!roomAgreements || roomAgreements.length === 0) return [];
    const ended = roomAgreements.filter(a => a.actual_end_date)
      .sort((a, b) => a.actual_end_date!.localeCompare(b.actual_end_date!));
    const periods: { start: string; end: string | null; days: number; cost: number }[] = [];
    const targetRent = room?.target_rent_pcm || room?.current_rent_pcm || 0;
    for (let i = 0; i < ended.length; i++) {
      const endDate = ended[i].actual_end_date!;
      const nextStart = ended[i + 1]?.start_date || (activeAgreement ? activeAgreement.start_date : null);
      if (nextStart && nextStart > endDate) {
        const days = differenceInDays(new Date(nextStart), new Date(endDate));
        periods.push({ start: endDate, end: nextStart, days, cost: days * targetRent / 30.44 });
      }
    }
    if (!activeAgreement && ended.length > 0) {
      const lastEnd = ended[ended.length - 1].actual_end_date!;
      const days = differenceInDays(new Date(), new Date(lastEnd));
      if (days > 0) periods.push({ start: lastEnd, end: null, days, cost: days * targetRent / 30.44 });
    }
    return periods;
  }, [roomAgreements, activeAgreement, room]);

  const rentTrend = useMemo(() => {
    if (!roomAgreements || roomAgreements.length < 2) return null;
    const sorted = [...roomAgreements].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const first = sorted[0].rent_amount_pcm;
    const last = sorted[sorted.length - 1].rent_amount_pcm;
    return last > first ? 'up' : last < first ? 'down' : 'flat';
  }, [roomAgreements]);

  const maintenanceCostTotal = useMemo(
    () => maintenanceCosts.reduce((sum, row) => sum + (row.actual_cost || 0), 0),
    [maintenanceCosts],
  );

  const annualRent = useMemo(() => {
    const active = roomAgreements?.find((a) => a.status === 'active');
    if (active) return active.rent_amount_pcm * 12;
    if (roomAgreements && roomAgreements.length > 0) return roomAgreements[0].rent_amount_pcm * 12;
    return 0;
  }, [roomAgreements]);

  const handleSaveNotes = async () => {
    if (!room) return;
    try {
      await updateRoom.mutateAsync({ id: room.id, notes: notesValue || null });
      setEditingNotes(false);
      toast({ title: 'Notes saved' });
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Failed to save notes';
      toast({ title: 'Error', description, variant: 'destructive' });
    }
  };

  return {
    id, room, isLoading, roomAgreements, sortedAgreements, activeAgreement,
    compliance, maintenanceCosts, maintenanceCostTotal, annualRent,
    voidPeriods, rentTrend,
    showEdit, setShowEdit, showCreateAgreement, setShowCreateAgreement,
    editingNotes, setEditingNotes, notesValue, setNotesValue, handleSaveNotes,
    updateRoomPending: updateRoom.isPending,
    pnlPeriod, setPnlPeriod, roomPnL, pnlLoading,
  };
}

export type RoomDetailState = ReturnType<typeof useRoomDetailState>;
