import { Edit, Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { EpcRoadmapCard } from '@/components/property/EpcRoadmapCard';
import { ComparableSalesTable } from '@/components/valuations';
import { PropertyRoomsSection } from '@/components/properties-v2/PropertyRoomsSection';
import { LeaseholdHealthCard } from '@/components/property-detail/LeaseholdHealthCard';
import { HMOCompliancePanel } from '@/components/property-detail/HMOCompliancePanel';
import { DetailRow } from './DetailRow';
import { fmtDate, fmtGBP } from '../utils/format';
import type { usePropertyDetailState } from '../hooks/usePropertyDetailState';

type State = ReturnType<typeof usePropertyDetailState>;

interface Props {
  state: State;
}

export function OverviewTab({ state }: Props) {
  const {
    property, capitalGrowth, editingNotes, setEditingNotes,
    notesValue, setNotesValue, handleSaveNotes, updateProperty, toast,
  } = state;
  if (!property) return null;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Key Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="space-y-2">
              <DetailRow label="Council" value={property.council_name || '—'} />
              <DetailRow label="Council Area" value={property.council_area || '—'} />
              <DetailRow label="Year Built" value={property.year_built?.toString() || '—'} />
              <DetailRow label="Total Floors" value={property.total_floors?.toString() || '—'} />
              <DetailRow label="Lettable Rooms" value={property.total_lettable_rooms?.toString() || '0'} />
            </div>
            <div className="space-y-2">
              <DetailRow label="Purchase Date" value={fmtDate(property.purchase_date)} />
              <DetailRow label="Purchase Price" value={fmtGBP(property.purchase_price)} />
              <DetailRow label="Current Valuation" value={fmtGBP(property.current_valuation)} />
              <DetailRow label="Valuation Date" value={fmtDate(property.valuation_date)} />
              {capitalGrowth !== null && (
                <DetailRow label="Capital Growth" value={
                  <span className={Number(capitalGrowth) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {Number(capitalGrowth) >= 0 ? '+' : ''}{capitalGrowth}%
                  </span>
                } />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <LeaseholdHealthCard propertyId={property.id} />
      <PropertyRoomsSection propertyId={property.id} />
      <HMOCompliancePanel propertyId={property.id} propertyType={property.property_type} />
      <EpcRoadmapCard epcRating={property.epc_rating} />
      <ComparableSalesTable propertyId={property.id} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Notes</CardTitle>
          {!editingNotes && (
            <Button variant="ghost" size="sm" onClick={() => { setNotesValue(property.notes || ''); setEditingNotes(true); }}>
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
                <Button size="sm" onClick={handleSaveNotes} disabled={updateProperty.isPending}>Save</Button>
              </div>
            </div>
          ) : (
            <p className={property.notes ? 'text-foreground' : 'text-muted-foreground'}>{property.notes || 'No notes'}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Maintenance QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.origin + '/tenant-portal/maintenance')}`}
            alt="Maintenance QR code"
            className="rounded border"
            width={180}
            height={180}
          />
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Tenants scan this to report a maintenance issue directly from their phone.</p>
            <p className="text-xs font-mono bg-muted px-2 py-1 rounded">{window.location.origin}/tenant-portal/maintenance</p>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(window.location.origin + '/tenant-portal/maintenance'); toast({ title: 'Link copied!' }); }}>
              <Copy className="h-3 w-3 mr-1" /> Copy link
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
