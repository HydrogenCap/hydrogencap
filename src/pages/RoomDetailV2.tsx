import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Plus, TrendingUp } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRoom, useUpdateRoom, ROOM_TYPES, OCCUPANCY_STATUSES } from '@/hooks/useRoomsV2';
import { useTenancyAgreements, TENANCY_TYPES } from '@/hooks/useTenancyAgreements';
import { RoomFormModal } from '@/components/properties-v2/RoomFormModal';
import { CreateTenancyAgreementModal } from '@/components/tenants-v2/CreateTenancyAgreementModal';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { supabaseAny } from '@/integrations/supabase/client';

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

interface ComplianceDocument {
  id: string;
  document_type: string;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
}

interface MaintenanceCostRow {
  actual_cost: number | null;
}

export default function RoomDetailV2() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (!id) return;
    supabaseAny
      .from('compliance_documents_v2')
      .select('*')
      .eq('room_id', id)
      .order('expiry_date', { ascending: true })
      .then(({ data }) => setCompliance((data as ComplianceDocument[] | null) || []));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    supabaseAny
      .from('maintenance_requests')
      .select('actual_cost')
      .eq('room_v2_id', id)
      .not('actual_cost', 'is', null)
      .then(({ data }) => setMaintenanceCosts((data as MaintenanceCostRow[] | null) || []));
  }, [id]);

  const activeAgreement = useMemo(() => roomAgreements?.find(a => a.status === 'active' || a.status === 'notice_period'), [roomAgreements]);

  // Void periods
  const voidPeriods = useMemo(() => {
    if (!roomAgreements || roomAgreements.length === 0) return [];
    const ended = roomAgreements.filter(a => a.actual_end_date).sort((a, b) => a.actual_end_date!.localeCompare(b.actual_end_date!));
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
    // Current void
    if (!activeAgreement && ended.length > 0) {
      const lastEnd = ended[ended.length - 1].actual_end_date!;
      const days = differenceInDays(new Date(), new Date(lastEnd));
      if (days > 0) periods.push({ start: lastEnd, end: null, days, cost: days * targetRent / 30.44 });
    }
    return periods;
  }, [roomAgreements, activeAgreement, room]);

  // Rent trend
  const rentTrend = useMemo(() => {
    if (!roomAgreements || roomAgreements.length < 2) return null;
    const sorted = [...roomAgreements].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const first = sorted[0].rent_amount_pcm;
    const last = sorted[sorted.length - 1].rent_amount_pcm;
    return last > first ? 'up' : last < first ? 'down' : 'flat';
  }, [roomAgreements]);

  const maintenanceCostTotal = useMemo(() =>
    maintenanceCosts.reduce((sum, row) => sum + (row.actual_cost || 0), 0),
  [maintenanceCosts]);

  const annualRent = useMemo(() => {
    const active = roomAgreements?.find((agreement) => agreement.status === 'active');
    if (active) return active.rent_amount_pcm * 12;
    if (roomAgreements && roomAgreements.length > 0) return roomAgreements[0].rent_amount_pcm * 12;
    return 0;
  }, [roomAgreements]);

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
    } catch (err) {
      console.error('Failed to save room notes:', err);
      const description = err instanceof Error ? err.message : 'Failed to save notes';
      toast({ title: 'Error', description, variant: 'destructive' });
    }
  };

  const netProfit = annualRent - maintenanceCostTotal;
  const profitMargin = annualRent > 0 ? Math.max(0, Math.min(100, (netProfit / annualRent) * 100)) : 0;

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
          <CardHeader><CardTitle>Current Tenant</CardTitle></CardHeader>
          <CardContent>
            {activeAgreement ? (
              <div className="space-y-2 text-sm">
                <Row label="Tenant" value={<Link to={`/tenants-v2/${activeAgreement.tenant_id}`} className="text-primary underline font-medium">{activeAgreement.tenant_name || '—'}</Link>} />
                <Row label="Type" value={<Badge variant="secondary">{TENANCY_TYPES.find(t => t.value === activeAgreement.tenancy_type)?.label || activeAgreement.tenancy_type}</Badge>} />
                <Row label="Start Date" value={format(new Date(activeAgreement.start_date), 'dd/MM/yyyy')} />
                <Row label="Rent PCM" value={fmtRent(activeAgreement.rent_amount_pcm)} />
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">No current tenant</p>
                <Button onClick={() => setShowCreateAgreement(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Assign Tenant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Void History */}
        <Card>
          <CardHeader><CardTitle>Void History</CardTitle></CardHeader>
          <CardContent>
            {voidPeriods.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No void periods recorded.</p>
            ) : (
              <div className="space-y-3">
                {voidPeriods.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <span>{format(new Date(v.start), 'dd/MM/yyyy')}</span>
                      <span className="mx-2">→</span>
                      <span>{v.end ? format(new Date(v.end), 'dd/MM/yyyy') : 'Present'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{v.days} days</span>
                      <span className="text-destructive font-semibold">-£{v.cost.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                  <span>Total void cost</span>
                  <span className="text-destructive">-£{voidPeriods.reduce((s, v) => s + v.cost, 0).toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rent History */}
        {roomAgreements && roomAgreements.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Rent History</CardTitle>
              {rentTrend && (
                <Badge className={rentTrend === 'up' ? 'bg-emerald-100 text-emerald-700' : rentTrend === 'down' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}>
                  Rents trending {rentTrend}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead className="text-right">Rent PCM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roomAgreements.map(a => (
                      <TableRow key={a.id}>
                        <TableCell><Link to={`/tenants-v2/${a.tenant_id}`} className="text-primary underline">{a.tenant_name || '—'}</Link></TableCell>
                        <TableCell>{format(new Date(a.start_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{a.actual_end_date ? format(new Date(a.actual_end_date), 'dd/MM/yyyy') : '—'}</TableCell>
                        <TableCell className="text-right font-medium">{fmtRent(a.rent_amount_pcm)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

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
        {/* Room Compliance */}
        <Card>
          <CardHeader>
            <CardTitle>Room Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            {compliance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No compliance documents for this room.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compliance.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.document_type}</TableCell>
                      <TableCell>{doc.issue_date ? format(new Date(doc.issue_date), 'dd MMM yyyy') : '—'}</TableCell>
                      <TableCell>{doc.expiry_date ? format(new Date(doc.expiry_date), 'dd MMM yyyy') : '—'}</TableCell>
                      <TableCell><Badge variant={doc.status === 'valid' ? 'default' : 'destructive'}>{doc.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Profitability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Profitability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Annual Rent</p>
                <p className="text-xl font-bold text-emerald-600">{fmtRent(annualRent)}</p>
              </div>
              <div className="space-y-1 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <p className="text-xs text-muted-foreground">Maintenance Costs</p>
                <p className="text-xl font-bold text-destructive">-{fmtRent(maintenanceCostTotal)}</p>
                <p className="text-xs text-muted-foreground">{maintenanceCosts.length} job{maintenanceCosts.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="space-y-1 p-3 rounded-lg" style={{ background: netProfit >= 0 ? 'rgb(240 253 244)' : 'rgb(254 242 242)' }}>
                <p className="text-xs text-muted-foreground">Net Annual Profit</p>
                <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{fmtRent(netProfit)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Profit margin after maintenance</span>
                <span>{Math.round(profitMargin)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: profitMargin + '%' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <RoomFormModal
        open={showEdit}
        onOpenChange={setShowEdit}
        propertyId={room.property_id}
        editingRoom={room}
      />
      <CreateTenancyAgreementModal
        open={showCreateAgreement}
        onOpenChange={setShowCreateAgreement}
        preselectedPropertyId={room.property_id}
        preselectedRoomId={room.id}
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
