import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Edit, Copy, QrCode, FileDown, Loader2 } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { generatePassportPDF, slugifyAddress, type PassportPropertyData } from '@/lib/pdf/passport';
import { fetchUserOrgId as getUserOrgIdForPdf } from '@/hooks/useUserOrg';
import { supabase } from '@/integrations/supabase/client';
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
import { supabaseAny } from '@/integrations/supabase/client';
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const coverPhoto = usePropertyPhotoV2(id);

  // Data for status bar
  const { data: complianceRows } = usePropertyComplianceV2(id);
  const { data: insurancePolicies } = useInsurancePolicies({ propertyId: id });
  const { data: loans } = useLoanFacilitiesByProperty(id);

  const { data: entities = [] } = useQuery({
    queryKey: ['legal_entities_list'],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
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
      const { data, error } = await supabaseAny
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
      type RentRow = { status: string; agreement?: { property?: { id?: string } } };
      const rows = data as RentRow[];
      const forProperty = rows.filter((r) => r.agreement?.property?.id === id);
      if (forProperty.length === 0) return 'void' as const;

      const statuses = forProperty.map((r) => r.status);
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
    type LoanRow = { status: string; current_balance?: number | null };
    const totalDebt = (loans as LoanRow[])
      .filter((l) => l.status === 'active')
      .reduce((sum, l) => sum + (l.current_balance || 0), 0);
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

  const handleDownloadPassportPdf = async () => {
    if (!property) return;
    setDownloadingPdf(true);
    try {
      const [tenanciesRes, docsRes] = await Promise.all([
        supabaseAny
          .from('tenancy_agreements')
          .select('start_date, end_date, total_rent_pcm, tenants:tenancy_tenants(tenant:tenants_v2(first_name, last_name))')
          .eq('property_id', property.id)
          .eq('status', 'active')
          .limit(20),
        supabaseAny
          .from('documents')
          .select('original_file_name, display_name, doc_type, document_date, created_at')
          .eq('property_id', property.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(25),
      ]);

      type TenancyRow = {
        start_date: string | null;
        end_date: string | null;
        total_rent_pcm: number | null;
        tenants?: { tenant?: { first_name?: string | null; last_name?: string | null } | null }[] | null;
      };
      type DocRow = {
        original_file_name: string | null;
        display_name: string | null;
        doc_type: string | null;
        document_date: string | null;
        created_at: string | null;
      };

      const tenancyItems = ((tenanciesRes.data as TenancyRow[] | null) ?? []).map((t) => {
        const names = (t.tenants ?? [])
          .map((tt) => [tt.tenant?.first_name, tt.tenant?.last_name].filter(Boolean).join(' ').trim())
          .filter(Boolean);
        return {
          tenant_name: names.length ? names.join(', ') : 'Unnamed tenant',
          start_date: t.start_date,
          end_date: t.end_date,
          rent_pcm: t.total_rent_pcm,
        };
      });

      const documentItems = ((docsRes.data as DocRow[] | null) ?? []).map((d) => ({
        name: d.display_name || d.original_file_name || 'Document',
        doc_type: d.doc_type,
        date: d.document_date || d.created_at,
      }));

      const grossRentAnnual = monthlyRent ? monthlyRent * 12 : null;
      const totalDebt = (loans ?? [])
        .filter((l) => (l as { status?: string }).status === 'active')
        .reduce((sum, l) => sum + ((l as { current_balance?: number | null }).current_balance || 0), 0) || null;
      const equity = property.current_valuation && totalDebt != null
        ? property.current_valuation - totalDebt
        : property.current_valuation ?? null;

      const complianceItems = (complianceRows ?? [])
        .filter((r) => r.is_required)
        .map((r) => {
          let status: 'valid' | 'expiring_soon' | 'expired' | 'missing' = 'valid';
          if (r.calculated_status === 'expired') status = 'expired';
          else if (r.calculated_status === 'missing') status = 'missing';
          else if (r.calculated_status === 'expiring_soon' || r.calculated_status === 'critical') status = 'expiring_soon';
          const rec = r as { requirement_type?: string; compliance_type?: string };
          return {
            type: String(rec.requirement_type ?? rec.compliance_type ?? 'Requirement'),
            status,
            expiry_date: r.expiry_date ?? null,
          };
        });

      const pdfData: PassportPropertyData = {
        address_line_1: property.address_line_1,
        address_line_2: property.address_line_2,
        city: property.city,
        postcode: property.postcode,
        property_type: property.property_type,
        bedrooms: (property as { bedrooms?: number | null }).bedrooms ?? null,
        monthly_rent: monthlyRent,
        current_valuation: property.current_valuation,
        owner_entity_name: (property as { entity_name?: string | null }).entity_name ?? null,
        cover_photo_data_url: null,
        compliance: complianceItems,
        tenancies: tenancyItems,
        financials: {
          gross_rent_annual: grossRentAnnual,
          total_costs_annual: null,
          noi_annual: null,
          mortgage_balance: totalDebt,
          equity,
        },
        documents: documentItems,
      };

      const doc = generatePassportPDF(pdfData);
      const slug = slugifyAddress(property.address_line_1 || 'property');
      const fileName = `passport-${slug}.pdf`;
      doc.save(fileName);

      try {
        const blob = doc.output('blob');
        const orgId = await getUserOrgIdForPdf();
        if (orgId) {
          const path = `${orgId}/passport-exports/${property.id}/${Date.now()}-${fileName}`;
          const { error: upErr } = await supabase.storage
            .from('documents')
            .upload(path, blob, { contentType: 'application/pdf', upsert: false });
          if (!upErr) {
            const { data: { user } } = await supabase.auth.getUser();
            await supabaseAny.from('documents').insert({
              org_id: orgId,
              property_id: property.id,
              file_url: path,
              original_file_name: fileName,
              display_name: `Property Passport — ${property.address_line_1}`,
              doc_type: 'property_passport_export',
              category: 'reports',
              file_type: 'pdf',
              mime_type: 'application/pdf',
              file_size_bytes: blob.size,
              review_status: 'accepted',
              uploaded_by: user?.id ?? null,
            });
          }
        }
      } catch (vaultErr) {
        console.warn('Passport PDF saved locally but vault upload failed:', vaultErr);
      }

      sonnerToast.success('Passport PDF downloaded');
    } catch (err) {
      console.error('Failed to generate passport PDF:', err);
      sonnerToast.error(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top action row */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPassportPdf}
            disabled={downloadingPdf}
            aria-busy={downloadingPdf || undefined}
          >
            {downloadingPdf ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-1" />
                Download Passport PDF
              </>
            )}
          </Button>
        </div>

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
