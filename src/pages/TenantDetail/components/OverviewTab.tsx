import { Link } from 'react-router-dom';
import { FileWarning, Plus, Bell, DoorOpen } from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TENANCY_TYPES } from '@/hooks/useTenancyAgreements';
import { DepositProtectionCard } from '@/components/tenants-v2/DepositProtectionCard';
import { RightToRentCard } from '@/components/tenants-v2/RightToRentCard';
import { TenancyChecklist } from '@/components/lettings/TenancyChecklist';
import { Row } from './Row';
import { fmtDate, fmtRent, getLabel } from '../utils/format';
import { AGREEMENT_STATUS_BG } from '../utils/badges';
import type { TenantDetailState } from '../hooks/useTenantDetailState';

export function OverviewTab({ state }: { state: TenantDetailState }) {
  const { tenant, agreements, activeAgreement, compliance,
    setShowCreateAgreement, setShowNotice, setShowEnd } = state;
  if (!tenant) return null;

  const age = tenant.date_of_birth ? differenceInYears(new Date(), new Date(tenant.date_of_birth)) : null;
  const hasComplianceIssues = compliance && !compliance.section_21_ready;

  return (
    <div className="space-y-6">
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

      {activeAgreement && <DepositProtectionCard agreement={activeAgreement} />}
      {activeAgreement && <RightToRentCard tenancyId={activeAgreement.id} />}
      {activeAgreement && <TenancyChecklist tenancyId={activeAgreement.id} orgId={activeAgreement.org_id} />}

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

      {tenant.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{tenant.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
