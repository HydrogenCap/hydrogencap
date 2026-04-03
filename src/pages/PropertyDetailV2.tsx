import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Edit, Copy, QrCode } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PageSkeleton } from '@/components/common';
import { Textarea } from '@/components/ui/textarea';
import { usePropertyV2, useUpdatePropertyV2 } from '@/hooks/usePropertiesV2';
import { EpcRoadmapCard } from '@/components/property/EpcRoadmapCard';
import { ComparableSalesTable } from '@/components/valuations';
import { PropertyFormModal } from '@/components/properties-v2/PropertyFormModal';
import { PropertyRoomsSection } from '@/components/properties-v2/PropertyRoomsSection';
import { PropertyLoansSection } from '@/components/lending/PropertyLoansSection';
import { PropertyComplianceSection } from '@/components/compliance-v2/PropertyComplianceSection';
import { PropertyFinancialSection } from '@/components/financials/PropertyFinancialSection';
import { PropertyPnLCard } from '@/components/financials/PropertyPnLCard';
import { InlineAuditHistory } from '@/components/audit/InlineAuditHistory';
import { PropertyStatusBar } from '@/components/property-detail/PropertyStatusBar';
import { PropertyHeader } from '@/components/property-detail/PropertyHeader';
import { PropertyTimeline } from '@/components/property-detail/PropertyTimeline';
import { LeaseholdHealthCard } from '@/components/property-detail/LeaseholdHealthCard';
import { HMOCompliancePanel } from '@/components/property-detail/HMOCompliancePanel';
import { usePropertyComplianceV2 } from '@/hooks/useComplianceV2';
import { useInsurancePolicies } from '@/hooks/useInsurance';
import { useLoanFacilitiesByProperty } from '@/hooks/useLoanFacilities';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import { usePropertyPhotoV2 } from '@/hooks/usePropertyPhotosV2';
import { SEVERITY } from '@/lib/design-tokens';
import { CommunicationTimeline } from '@/components/communications/CommunicationTimeline';
import { ValuationHistoryChart } from '@/components/valuations/ValuationHistoryChart';
import { ComparableEvidenceLog } from '@/components/valuations/ComparableEvidenceLog';
import { RevaluationTrigger } from '@/components/valuations/RevaluationTrigger';
import { ValuationRecordForm } from '@/components/valuations/ValuationRecordForm';

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
}

function fmtGBP(v: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
}

export default function PropertyDetailV2() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: property, isLoading } = usePropertyV2(id);
  const updateProperty = useUpdatePropertyV2();
  const [showEdit, setShowEdit] = useState(false);
  const [showRecordValuation, setShowRecordValuation] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const coverPhoto = usePropertyPhotoV2(id);

  // Data for status bar
  const { data: complianceRows } = usePropertyComplianceV2(id);
  const { data: insurancePolicies } = useInsurancePolicies({ propertyId: id });
  const { data: loans } = useLoanFacilitiesByProperty(id);

  const { data: entities = [] } = useQuery({
    queryKey: ['legal_entities_list'],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await (supabase as any)
        .from('legal_entities')
        .select('id, entity_name')
        .eq('org_id', orgId)
        .order('entity_name');
      if (error) throw error;
      return data as { id: string; entity_name: string }[];
    },
  });

  // Compute rent status from rent schedule for this property
  const { data: rentStatusData } = useQuery({
    queryKey: ['property_rent_status', id],
    enabled: !!id,
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Get rent schedule entries for this property's tenancies via agreements
      const { data, error } = await (supabase as any)
        .from('rent_schedule')
        .select(`
          status,
          agreement:tenancy_agreements!agreement_id(
            property:properties_v2!inner(id)
          )
        `)
        .gte('due_date', monthStart)
        .lte('due_date', monthEnd);

      if (error) return null;
      if (!data || data.length === 0) return 'void' as const;

      // Filter to this property
      const forProperty = data.filter((r: any) => r.agreement?.property?.id === id);
      if (forProperty.length === 0) return 'void' as const;

      const statuses = forProperty.map((r: any) => r.status);
      if (statuses.every((s: string) => s === 'paid')) return 'paid' as const;
      if (statuses.some((s: string) => s === 'overdue' || s === 'bad_debt')) return 'overdue' as const;
      if (statuses.some((s: string) => s === 'partial')) return 'partial' as const;
      return 'paid' as const;
    },
  });

  // Compute derived stats for header
  const monthlyRent = property?.whole_house_rent_pcm ?? null;
  const currentLtv = useMemo(() => {
    if (!loans || loans.length === 0 || !property?.current_valuation) return null;
    const totalDebt = loans
      .filter((l: any) => l.status === 'active')
      .reduce((sum: number, l: any) => sum + (l.current_balance || 0), 0);
    if (totalDebt === 0 || !property.current_valuation) return null;
    return (totalDebt / property.current_valuation) * 100;
  }, [loans, property?.current_valuation]);

  const grossYield = useMemo(() => {
    if (!monthlyRent || !property?.current_valuation) return null;
    return ((monthlyRent * 12) / property.current_valuation) * 100;
  }, [monthlyRent, property]);

  // Compliance badge counts
  const complianceCounts = useMemo(() => {
    if (!complianceRows) return { expired: 0, expiring: 0 };
    const required = complianceRows.filter(r => r.is_required);
    const expired = required.filter(r => r.calculated_status === 'expired' || r.calculated_status === 'missing').length;
    const expiring = required.filter(r => r.calculated_status === 'expiring_soon' || r.calculated_status === 'critical').length;
    return { expired, expiring };
  }, [complianceRows]);

  if (isLoading) {
    return <AppLayout><PageSkeleton tabs={5} /></AppLayout>;
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
    } catch (err) {
      console.error('Failed to save property notes:', err);
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save notes', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Status Bar */}
        <PropertyStatusBar
          complianceRows={complianceRows}
          insurancePolicies={insurancePolicies}
          loans={loans}
          epcRating={property.epc_rating}
          rentStatus={rentStatusData}
        />

        {/* Enhanced Header */}
        <PropertyHeader
          property={property}
          coverPhoto={coverPhoto}
          monthlyRent={monthlyRent}
          currentLtv={currentLtv}
          grossYield={grossYield}
          onEdit={() => setShowEdit(true)}
        />

        {/* Tabbed Content */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="compliance" className="gap-1.5">
              Compliance
              {complianceCounts.expired > 0 && (
                <span className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY.critical.badge}`}>
                  {complianceCounts.expired}
                </span>
              )}
              {complianceCounts.expired === 0 && complianceCounts.expiring > 0 && (
                <span className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY.warning.badge}`}>
                  {complianceCounts.expiring}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="valuation">Valuation</TabsTrigger>
            <TabsTrigger value="lending">Lending</TabsTrigger>
            <TabsTrigger value="comms">Comms</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
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

            {/* Leasehold Health */}
            <LeaseholdHealthCard propertyId={property.id} />

            {/* Rooms */}
            <PropertyRoomsSection propertyId={property.id} />

            {/* HMO Compliance (only shows for HMO properties) */}
            <HMOCompliancePanel propertyId={property.id} propertyType={property.property_type} />

            {/* EPC Improvement Roadmap */}
            <EpcRoadmapCard epcRating={property.epc_rating} />

            {/* Market Comparables */}
            <ComparableSalesTable propertyId={property.id} />

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
          </TabsContent>

          {/* Financials Tab */}
          <TabsContent value="financials" className="space-y-6">
            {/* Live P&L */}
            <PropertyPnLCard propertyId={property.id} />

            {/* Manual Financial Snapshots */}
            <PropertyFinancialSection propertyId={property.id} currentValuation={property.current_valuation} />
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <PropertyComplianceSectionWrapper propertyId={property.id} orgId={property.org_id} />
          </TabsContent>

          {/* Valuation Tab */}
          <TabsContent value="valuation" className="space-y-6">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowRecordValuation(true)}>
                Record Valuation
              </Button>
            </div>
            <ValuationHistoryChart
              propertyId={property.id}
              purchasePrice={property.purchase_price}
              purchaseDate={property.purchase_date}
            />
            <ComparableEvidenceLog propertyId={property.id} />
            <RevaluationTrigger propertyId={property.id} />
          </TabsContent>

          {/* Lending Tab */}
          <TabsContent value="lending" className="space-y-6">
            <PropertyLoansSection
              propertyId={property.id}
              entityId={property.entity_id}
              entities={entities}
              propertyValuation={property.current_valuation}
            />
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="comms" className="space-y-6">
            <CommunicationTimeline propertyId={property.id} title="Property Communications" />
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-6">
            <PropertyTimeline propertyId={property.id} />

            {/* Change History */}
            <Card>
              <CardContent className="pt-4">
                <InlineAuditHistory tableName="properties_v2" recordId={id} title="Property Change History" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <PropertyFormModal open={showEdit} onOpenChange={setShowEdit} editingProperty={property} />
      <ValuationRecordForm propertyId={property.id} open={showRecordValuation} onOpenChange={setShowRecordValuation} />
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
