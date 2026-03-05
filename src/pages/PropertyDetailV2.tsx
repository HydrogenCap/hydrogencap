import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Flame, Landmark, QrCode, Copy } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePropertyV2, useUpdatePropertyV2, PROPERTY_TYPES, LIFECYCLE_STAGES, LISTING_GRADES } from '@/hooks/usePropertiesV2';
import { PropertyFormModal } from '@/components/properties-v2/PropertyFormModal';
import { PropertyRoomsSection } from '@/components/properties-v2/PropertyRoomsSection';
import { PropertyLoansSection } from '@/components/lending/PropertyLoansSection';
import { PropertyComplianceSection } from '@/components/compliance-v2/PropertyComplianceSection';
import { PropertyFinancialSection } from '@/components/financials/PropertyFinancialSection';
import { PropertyPnLCard } from '@/components/financials/PropertyPnLCard';
import { InlineAuditHistory } from '@/components/audit/InlineAuditHistory';
import { usePropertyComplianceV2 } from '@/hooks/useComplianceV2';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import { usePropertyPhotoV2 } from '@/hooks/usePropertyPhotosV2';

const ENTITY_TYPE_BG: Record<string, string> = {
  spv: 'bg-blue-100 text-blue-700', personal: 'bg-emerald-100 text-emerald-700',
  joint_venture: 'bg-purple-100 text-purple-700', trust: 'bg-amber-100 text-amber-700',
};

const PROPERTY_TYPE_BG: Record<string, string> = {
  hmo_licensed: 'bg-indigo-100 text-indigo-700', hmo_mandatory: 'bg-indigo-100 text-indigo-700',
  single_let: 'bg-teal-100 text-teal-700', multi_unit_freehold: 'bg-cyan-100 text-cyan-700',
  commercial: 'bg-slate-100 text-slate-700', mixed_use: 'bg-slate-100 text-slate-700',
};

const LIFECYCLE_BG: Record<string, string> = {
  pipeline: 'bg-blue-100 text-blue-700', acquisition: 'bg-sky-100 text-sky-700',
  refurbishment: 'bg-orange-100 text-orange-700', letting: 'bg-purple-100 text-purple-700',
  stabilised: 'bg-emerald-100 text-emerald-700', disposal: 'bg-red-100 text-red-700',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
}

function fmtGBP(v: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
}

function getLabel(arr: readonly { value: string; label: string }[], v: string) {
  return arr.find(x => x.value === v)?.label || v;
}


export default function PropertyDetailV2() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: property, isLoading } = usePropertyV2(id);
  const updateProperty = useUpdatePropertyV2();
  const [showEdit, setShowEdit] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const coverPhoto = usePropertyPhotoV2(id);

  const { data: entities = [] } = useQuery({
    queryKey: ['legal_entities_list'],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabase
        .from('legal_entities')
        .select('id, entity_name')
        .eq('org_id', orgId)
        .order('entity_name');
      if (error) throw error;
      return data as { id: string; entity_name: string }[];
    },
  });

  if (isLoading) {
    return <AppLayout><div className="space-y-6"><Skeleton className="h-10 w-80" /><Skeleton className="h-64 w-full" /></div></AppLayout>;
  }
  if (!property) {
    return <AppLayout><div className="text-center py-16 text-muted-foreground">Property not found.</div></AppLayout>;
  }

  const capitalGrowth = property.current_valuation && property.purchase_price
    ? ((property.current_valuation - property.purchase_price) / property.purchase_price * 100).toFixed(1)
    : null;

  const handleSaveNotes = async () => {
    try {
      await updateProperty.mutateAsync({ id: property.id, notes: notesValue || null });
      setEditingNotes(false);
      toast({ title: 'Notes saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cover Photo */}
        {coverPhoto && (
          <div className="h-48 md:h-64 w-full rounded-lg overflow-hidden">
            <img src={coverPhoto} alt={property.address_line_1} className="w-full h-full object-cover" />
          </div>
        )}
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/properties-v2')} className="mb-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Properties
            </Button>
            <h1 className="text-2xl font-bold text-foreground">
              {property.address_line_1}{property.address_line_2 ? `, ${property.address_line_2}` : ''}
            </h1>
            <p className="text-muted-foreground">{property.city}, {property.postcode}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge className={ENTITY_TYPE_BG[property.entity_type]}>{property.entity_name}</Badge>
              <Badge className={PROPERTY_TYPE_BG[property.property_type]}>{getLabel(PROPERTY_TYPES, property.property_type)}</Badge>
              <Badge className={LIFECYCLE_BG[property.lifecycle_stage]}>{getLabel(LIFECYCLE_STAGES, property.lifecycle_stage)}</Badge>
              {property.listing_grade !== 'none' && (
                <Badge className="bg-amber-100 text-amber-800">
                  <Landmark className="h-3 w-3 mr-1" />{getLabel(LISTING_GRADES, property.listing_grade)} Listed
                </Badge>
              )}
              {property.has_gas_supply === false && (
                <Badge variant="secondary" className="text-muted-foreground">
                  <Flame className="h-3 w-3 mr-1" /> No Gas
                </Badge>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        </div>

        {/* Key Details */}
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

        {/* Rooms */}
        <PropertyRoomsSection propertyId={property.id} />

        {/* Live P&L */}
        <PropertyPnLCard propertyId={property.id} />

        {/* Manual Financial Snapshots */}
        <PropertyFinancialSection propertyId={property.id} currentValuation={property.current_valuation} />

        {/* Loans */}
        <PropertyLoansSection
          propertyId={property.id}
          entityId={property.entity_id}
          entities={entities}
          propertyValuation={property.current_valuation}
        />

        {/* Compliance */}
        <PropertyComplianceSectionWrapper propertyId={property.id} orgId={property.org_id} />

        {/* Notes */}
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
        {/* Maintenance QR Code */}
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

        {/* Change History */}
        <Card>
          <CardContent className="pt-4">
            <InlineAuditHistory tableName="properties_v2" recordId={id} title="Property Change History" />
          </CardContent>
        </Card>
      </div>

      <PropertyFormModal open={showEdit} onOpenChange={setShowEdit} editingProperty={property} />
    </AppLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function PropertyComplianceSectionWrapper({ propertyId, orgId }: { propertyId: string; orgId: string }) {
  const { data: matrixRows, isLoading } = usePropertyComplianceV2(propertyId);
  if (isLoading) return <Skeleton className="h-48" />;
  if (!matrixRows || matrixRows.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Compliance</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-center py-6">No compliance requirements generated yet.</p></CardContent>
      </Card>
    );
  }
  return <PropertyComplianceSection matrixRows={matrixRows} propertyId={propertyId} orgId={orgId} />;
}
