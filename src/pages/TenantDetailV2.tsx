import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, FileWarning, Check, X, AlertTriangle, Plus, Bell, DoorOpen, RefreshCw } from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTenantV2, TENANT_TYPES, TENANT_STATUSES, useUpdateTenantV2 } from '@/hooks/useTenantsV2';
import { useTenancyAgreements, useTenancyComplianceChecks, TENANCY_TYPES } from '@/hooks/useTenancyAgreements';
import { AddTenantModal } from '@/components/tenants-v2/AddTenantModal';
import { CreateTenancyAgreementModal } from '@/components/tenants-v2/CreateTenancyAgreementModal';
import { ServeNoticeModal } from '@/components/tenants-v2/ServeNoticeModal';
import { EndTenancyModal } from '@/components/tenants-v2/EndTenancyModal';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const STATUS_BG: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700', prospective: 'bg-blue-100 text-blue-700',
  in_notice: 'bg-amber-100 text-amber-700', departed: 'bg-muted text-muted-foreground',
  evicted: 'bg-red-100 text-red-700', archived: 'bg-muted/50 text-muted-foreground',
};

const AGREEMENT_STATUS_BG: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700', pending: 'bg-blue-100 text-blue-700',
  notice_period: 'bg-amber-100 text-amber-700', ended: 'bg-muted text-muted-foreground',
  terminated: 'bg-red-100 text-red-700',
};

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return '—'; }
}
function fmtRent(v: number | null | undefined) {
  if (v == null) return '—';
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function getLabel(arr: readonly { value: string; label: string }[], v: string) {
  return arr.find(x => x.value === v)?.label || v;
}
function ComplianceRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium">{value}</span>
        {ok ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-destructive" />}
      </div>
    </div>
  );
}

export default function TenantDetailV2() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: tenant, isLoading } = useTenantV2(id);
  const { data: agreements } = useTenancyAgreements({ tenantId: id });
  const { data: allCompliance } = useTenancyComplianceChecks();
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateAgreement, setShowCreateAgreement] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const activeAgreement = useMemo(() => agreements?.find(a => a.status === 'active' || a.status === 'notice_period'), [agreements]);
  const compliance = useMemo(() => allCompliance?.find(c => c.tenant_id === id), [allCompliance, id]);

  if (isLoading) return <AppLayout><div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-48 w-full" /></div></AppLayout>;
  if (!tenant) return <AppLayout><div className="text-center py-16 text-muted-foreground">Tenant not found.</div></AppLayout>;

  const age = tenant.date_of_birth ? differenceInYears(new Date(), new Date(tenant.date_of_birth)) : null;
  const hasComplianceIssues = compliance && !compliance.section_21_ready;

  const [charges, setCharges] = useState<any[]>([]);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [newCharge, setNewCharge] = useState({ description: '', amount: '', frequency: 'monthly' });

  useEffect(() => {
    if (!id) return;
    (supabase as any).from('recurring_charges').select('*')
      .eq('tenant_id', id).order('created_at', { ascending: false })
      .then(({ data }: any) => setCharges(data || []));
  }, [id]);

  const addCharge = async () => {
    if (!newCharge.description || !newCharge.amount) return;
    const orgId = (tenant as any)?.org_id;
    if (!orgId) return;
    const { data } = await (supabase as any)
      .from('recurring_charges')
      .insert({ org_id: orgId, tenant_id: id, description: newCharge.description, amount: parseFloat(newCharge.amount), frequency: newCharge.frequency })
      .select().single();
    if (data) { setCharges((p: any[]) => [data, ...p]); setNewCharge({ description: '', amount: '', frequency: 'monthly' }); setShowAddCharge(false); }
  };

  const removeCharge = async (chargeId: string) => {
    await (supabase as any).from('recurring_charges').delete().eq('id', chargeId);
    setCharges((p: any[]) => p.filter((c: any) => c.id !== chargeId));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/tenants-v2')} className="mb-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> Tenants
            </Button>
            <h1 className="text-2xl font-bold text-foreground">{tenant.first_name} {tenant.last_name}</h1>
            <div className="flex items-center gap-2">
              <Badge className={STATUS_BG[tenant.status]}>{getLabel(TENANT_STATUSES, tenant.status)}</Badge>
              <Badge className="bg-blue-100 text-blue-700">{getLabel(TENANT_TYPES, tenant.tenant_type)}</Badge>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        </div>

        {/* Contact Card */}
        <Card>
          <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <Row label="Email" value={tenant.email ? <a href={`mailto:${tenant.email}`} className="text-primary underline">{tenant.email}</a> : '—'} />
              <Row label="Phone" value={tenant.phone ? <a href={`tel:${tenant.phone}`} className="text-primary underline">{tenant.phone}</a> : '—'} />
              <Row label="Date of Birth" value={tenant.date_of_birth ? `${fmtDate(tenant.date_of_birth)}${age != null ? ` (${age})` : ''}` : '—'} />
              <Row label="Emergency Contact" value={tenant.emergency_contact_name ? `${tenant.emergency_contact_name} — ${tenant.emergency_contact_phone || ''}` : '—'} />
            </div>
          </CardContent>
        </Card>

        {/* Current Tenancy */}
        {activeAgreement && (
          <Card>
            <CardHeader><CardTitle>Current Tenancy</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <Row label="Property" value={<Link to={`/properties-v2/${activeAgreement.property_id}`} className="text-primary underline">{activeAgreement.property_address || '—'}</Link>} />
                <Row label="Room" value={<Link to={`/rooms-v2/${activeAgreement.room_id}`} className="text-primary underline">{activeAgreement.room_name || '—'}</Link>} />
                <Row label="Type" value={getLabel(TENANCY_TYPES, activeAgreement.tenancy_type)} />
                <Row label="Rent PCM" value={fmtRent(activeAgreement.rent_amount_pcm)} />
                <Row label="Start Date" value={fmtDate(activeAgreement.start_date)} />
                <Row label="End Date" value={fmtDate(activeAgreement.initial_end_date)} />
                {activeAgreement.is_periodic && <Row label="Periodic" value={<Badge variant="secondary">Periodic</Badge>} />}
              </div>

              {/* Deposit compliance */}
              {compliance && (
                <div className="border-t pt-4 space-y-1">
                  <h4 className="text-sm font-semibold mb-2">Deposit & Compliance</h4>
                  <ComplianceRow label="Deposit Amount" value={fmtRent(compliance.deposit_amount)} ok={true} />
                  {compliance.deposit_amount && compliance.deposit_amount > 0 && (
                    <>
                      <ComplianceRow label="Deposit Scheme" value={compliance.deposit_scheme || 'Not set'} ok={!!compliance.deposit_scheme && compliance.deposit_scheme !== 'none'} />
                      <ComplianceRow label="Date Protected" value={fmtDate(compliance.deposit_protected_date)} ok={!!compliance.deposit_protected_date} />
                      <ComplianceRow label="Prescribed Info Served" value={fmtDate(compliance.prescribed_info_served_date)} ok={!!compliance.prescribed_info_served_date} />
                    </>
                  )}
                  <ComplianceRow label="How to Rent Served" value={fmtDate(compliance.how_to_rent_served_date)} ok={!!compliance.how_to_rent_served_date} />
                  <div className="flex items-center justify-between text-sm py-2 border-t mt-2">
                    <span className="font-semibold">Section 21 Ready</span>
                    <span className={`font-bold text-lg ${compliance.section_21_ready ? 'text-emerald-600' : 'text-destructive'}`}>
                      {compliance.section_21_ready ? 'YES' : 'NO'}
                    </span>
                  </div>
                </div>
              )}

              {hasComplianceIssues && (
                <Alert variant="destructive">
                  <FileWarning className="h-4 w-4" />
                  <AlertDescription>
                    This tenancy has compliance issues that must be resolved before a valid Section 21 notice can be served.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setShowCreateAgreement(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Tenancy Agreement
          </Button>
          {activeAgreement && activeAgreement.status === 'active' && (
            <>
              <Button variant="outline" onClick={() => setShowNotice(true)}>
                <Bell className="h-4 w-4 mr-2" /> Serve Notice
              </Button>
              <Button variant="outline" onClick={() => setShowEnd(true)}>
                <DoorOpen className="h-4 w-4 mr-2" /> End Tenancy
              </Button>
            </>
          )}
        </div>

        {/* Tenancy History */}
        <Card>
          <CardHeader><CardTitle>Tenancy History</CardTitle></CardHeader>
          <CardContent>
            {!agreements || agreements.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No tenancy agreements yet.</p>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead className="text-right">Rent PCM</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreements.map(a => (
                      <TableRow key={a.id} className={a.status === 'active' ? 'border-l-4 border-l-emerald-500' : ''}>
                        <TableCell className="text-sm">{a.property_address || '—'}</TableCell>
                        <TableCell className="text-sm">{a.room_name || '—'}</TableCell>
                        <TableCell><Badge variant="secondary">{getLabel(TENANCY_TYPES, a.tenancy_type)}</Badge></TableCell>
                        <TableCell className="text-sm">{fmtDate(a.start_date)}</TableCell>
                        <TableCell className="text-sm">{fmtDate(a.actual_end_date || a.initial_end_date)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtRent(a.rent_amount_pcm)}</TableCell>
                        <TableCell><Badge className={AGREEMENT_STATUS_BG[a.status]}>{a.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {tenant.notes && (
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{tenant.notes}</p></CardContent>
          </Card>
        )}

        {/* Recurring Charges */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Recurring Charges
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAddCharge(!showAddCharge)}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showAddCharge && (
              <div className="flex gap-2 items-end p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" placeholder="e.g. Parking, Cleaning, Internet"
                    value={newCharge.description} onChange={e => setNewCharge(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="w-24">
                  <label className="text-xs text-muted-foreground mb-1 block">Amount (£)</label>
                  <input className="w-full border rounded px-2 py-1 text-sm" placeholder="0.00" type="number"
                    value={newCharge.amount} onChange={e => setNewCharge(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="w-28">
                  <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
                  <select className="w-full border rounded px-2 py-1 text-sm bg-background"
                    value={newCharge.frequency} onChange={e => setNewCharge(p => ({ ...p, frequency: e.target.value }))}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
                <Button size="sm" onClick={addCharge}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddCharge(false)}>Cancel</Button>
              </div>
            )}
            {charges.length === 0 && !showAddCharge ? (
              <p className="text-sm text-muted-foreground">No recurring charges set up.</p>
            ) : charges.length > 0 ? (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Description</TableHead><TableHead>Amount</TableHead>
                  <TableHead>Frequency</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {charges.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.description}</TableCell>
                      <TableCell>£{Number(c.amount).toFixed(2)}</TableCell>
                      <TableCell className="capitalize">{c.frequency}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => removeCharge(c.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AddTenantModal open={showEdit} onOpenChange={setShowEdit} />
      <CreateTenancyAgreementModal
        open={showCreateAgreement}
        onOpenChange={setShowCreateAgreement}
        preselectedTenantId={id}
        onSuccess={() => {}}
      />
      {activeAgreement && (
        <>
          <ServeNoticeModal
            open={showNotice}
            onOpenChange={setShowNotice}
            tenancyId={activeAgreement.id}
            tenantId={tenant.id}
            compliance={compliance}
          />
          <EndTenancyModal
            open={showEnd}
            onOpenChange={setShowEnd}
            tenancyId={activeAgreement.id}
            tenantId={tenant.id}
          />
        </>
      )}
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
