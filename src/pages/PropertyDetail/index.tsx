import { FileDown, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PageSkeleton } from '@/components/common';
import { PropertyStatusBar } from '@/components/property-detail/PropertyStatusBar';
import { PropertyHeader } from '@/components/property-detail/PropertyHeader';
import { PropertyFormModal } from '@/components/properties-v2/PropertyFormModal';
import { ValuationRecordForm } from '@/components/valuations/ValuationRecordForm';
import { CommunicationTimeline } from '@/components/communications/CommunicationTimeline';
import { SEVERITY } from '@/lib/design-tokens';
import { SEO } from '@/components/SEO';
import { usePropertyDetailState } from './hooks/usePropertyDetailState';
import { OverviewTab } from './components/OverviewTab';
import { FinancialsTab } from './components/FinancialsTab';
import { ComplianceTab } from './components/ComplianceTab';
import { ValuationTab } from './components/ValuationTab';
import { LendingTab } from './components/LendingTab';
import { TimelineTab } from './components/TimelineTab';

export default function PropertyDetail() {
  const state = usePropertyDetailState();
  const {
    property, isLoading,
    showEdit, setShowEdit,
    showRecordValuation, setShowRecordValuation,
    downloadingPdf, coverPhoto,
    complianceRows, insurancePolicies, loans, entities, rentStatusData,
    monthlyRent, currentLtv, grossYield, complianceCounts,
    handleDownloadPassportPdf,
  } = state;

  if (isLoading) return <AppLayout><PageSkeleton tabs={5} /></AppLayout>;
  if (!property) return <AppLayout><div className="text-center py-16 text-muted-foreground">Property not found.</div></AppLayout>;

  return (
    <AppLayout>
      <SEO title={`${(property as { address_line_1?: string; address?: string }).address_line_1 || (property as { address_line_1?: string; address?: string }).address || 'Property'} — TenureIQ`} description="Property passport, performance, compliance, and lending in one view." />
      <div className="space-y-6">
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

        <PropertyStatusBar
          complianceRows={complianceRows}
          insurancePolicies={insurancePolicies}
          loans={loans}
          epcRating={property.epc_rating}
          rentStatus={rentStatusData}
        />

        <PropertyHeader
          property={property}
          coverPhoto={coverPhoto}
          monthlyRent={monthlyRent}
          currentLtv={currentLtv}
          grossYield={grossYield}
          onEdit={() => setShowEdit(true)}
        />

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

          <TabsContent value="overview"><OverviewTab state={state} /></TabsContent>
          <TabsContent value="financials">
            <FinancialsTab propertyId={property.id} currentValuation={property.current_valuation} />
          </TabsContent>
          <TabsContent value="compliance">
            <ComplianceTab propertyId={property.id} orgId={property.org_id} />
          </TabsContent>
          <TabsContent value="valuation">
            <ValuationTab
              propertyId={property.id}
              purchasePrice={property.purchase_price}
              purchaseDate={property.purchase_date}
              onRecord={() => setShowRecordValuation(true)}
            />
          </TabsContent>
          <TabsContent value="lending">
            <LendingTab
              propertyId={property.id}
              entityId={property.entity_id}
              entities={entities}
              propertyValuation={property.current_valuation}
            />
          </TabsContent>
          <TabsContent value="comms">
            <CommunicationTimeline propertyId={property.id} title="Property Communications" />
          </TabsContent>
          <TabsContent value="timeline"><TimelineTab propertyId={property.id} /></TabsContent>
        </Tabs>
      </div>

      <PropertyFormModal open={showEdit} onOpenChange={setShowEdit} editingProperty={property} />
      <ValuationRecordForm propertyId={property.id} open={showRecordValuation} onOpenChange={setShowRecordValuation} />
    </AppLayout>
  );
}
