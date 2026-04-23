import { useState, useMemo } from 'react';
import { format, addMonths } from 'date-fns';
import { FileSignature, Download, AlertTriangle, ChevronRight, Clock, ArrowLeft, Pencil, FileDown, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { usePropertyRooms } from '@/hooks/useRoomsV2';
import { useTenancyAgreements } from '@/hooks/useTenancyAgreements';
import { useGeneratedDocuments, useCreateGeneratedDocument } from '@/hooks/useGeneratedDocuments';
import { useComplianceMatrix } from '@/hooks/useComplianceV2';
import { DOCUMENT_TEMPLATES, TEMPLATE_CATEGORIES, SECTION_8_GROUNDS } from '@/lib/documentTemplates';
import {
  generateSection21PDF, generateSection8PDF, generateSection13PDF,
  generateGuarantorPDF, generateInventoryPDF, generateHowToRentCoverPDF,
  generateReferenceRequestPDF,
} from '@/lib/templatePdfGenerator';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import { DocumentGenerator } from '@/components/templates/DocumentGenerator';
import { TemplateVersionHistory } from '@/components/templates/TemplateVersionHistory';
import { useGeneratedDocumentsV2, useUpdateDocumentStatus } from '@/hooks/useTemplateUpgrade';

type WizardStep = 'browse' | 'select_context' | 'template_fields' | 'preview';

interface TemplateFields {
  noticeDate?: string;
  earliestEndDate?: string;
  currentRent?: number;
  newRent?: number;
  increaseDate?: string;
  grounds?: string[];
  groundDetails?: string;
  earliestCourtDate?: string;
  guarantorName?: string;
  guarantorAddress?: string;
  guaranteedAmount?: number;
  date?: string;
  servedDate?: string;
  prospectName?: string;
  previousAddress?: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  final: { label: 'Final', variant: 'default' },
  sent_for_signing: { label: 'Sent for Signing', variant: 'outline' },
  signed: { label: 'Signed', variant: 'default' },
};

export default function DocumentTemplates() {
  const [step, setStep] = useState<WizardStep>('browse');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedTenancyId, setSelectedTenancyId] = useState<string>('');
  const [templateFields, setTemplateFields] = useState<TemplateFields>({});
  const [topTab, setTopTab] = useState<string>('wizard');
  const [editorTemplateId, setEditorTemplateId] = useState<string | null>(null);
  const [versionTemplateId, setVersionTemplateId] = useState<string | null>(null);

  const { toast } = useToast();
  const { data: properties } = usePropertiesV2();
  const { data: rooms } = usePropertyRooms(selectedPropertyId || undefined);
  const { data: tenancies } = useTenancyAgreements({ propertyId: selectedPropertyId || undefined });
  const { data: recentDocs } = useGeneratedDocuments();
  const { data: complianceMatrix } = useComplianceMatrix();
  const createDoc = useCreateGeneratedDocument();
  const { data: generatedDocsV2 } = useGeneratedDocumentsV2();
  const updateDocStatus = useUpdateDocumentStatus();

  const selectedTemplate = DOCUMENT_TEMPLATES.find(t => t.id === selectedTemplateId);
  const selectedProperty = properties?.find(p => p.id === selectedPropertyId);
  const selectedTenancy = tenancies?.find(t => t.id === selectedTenancyId);

  const activeTenancies = useMemo(
    () => (tenancies || []).filter(t => t.status === 'active' || t.status === 'pending'),
    [tenancies]
  );

  // Pre-flight checks for Section 21
  const complianceChecks = useMemo(() => {
    if (!selectedPropertyId || selectedTemplateId !== 'section_21_notice') return null;
    const items = (complianceMatrix || []).filter(c => c.property_id === selectedPropertyId);
    const gasOk = items.some(c => c.document_type === 'gas_safety_certificate' && c.calculated_status === 'valid');
    const epcOk = items.some(c => c.document_type === 'epc' && c.calculated_status === 'valid');
    const howToRent = selectedTenancy?.how_to_rent_served_date != null;
    const depositOk = selectedTenancy?.deposit_protected_date != null;
    return { gasOk, epcOk, howToRent, depositOk };
  }, [selectedPropertyId, selectedTemplateId, complianceMatrix, selectedTenancy]);

  const landlordName = selectedProperty?.entity_name || '';

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    setSelectedPropertyId('');
    setSelectedTenancyId('');
    setTemplateFields({});
    setStep('select_context');
  };

  const handleContextNext = () => {
    // Pre-fill fields based on template
    const fields: TemplateFields = {};
    const today = format(new Date(), 'yyyy-MM-dd');

    if (selectedTemplateId === 'section_21_notice') {
      fields.noticeDate = today;
      fields.earliestEndDate = format(addMonths(new Date(), 2), 'yyyy-MM-dd');
    } else if (selectedTemplateId === 'section_13_rent_increase') {
      fields.noticeDate = today;
      fields.currentRent = selectedTenancy?.rent_amount_pcm || 0;
      fields.newRent = selectedTenancy?.rent_amount_pcm || 0;
      fields.increaseDate = format(addMonths(new Date(), 1), 'yyyy-MM-dd');
    } else if (selectedTemplateId === 'section_8_notice') {
      fields.noticeDate = today;
      fields.grounds = [];
      fields.groundDetails = '';
      fields.earliestCourtDate = format(addMonths(new Date(), 1), 'yyyy-MM-dd');
    } else if (selectedTemplateId === 'guarantor_agreement') {
      fields.guarantorName = '';
      fields.guarantorAddress = '';
      fields.guaranteedAmount = (selectedTenancy?.rent_amount_pcm || 0) * 12;
    } else if (selectedTemplateId === 'inventory_template') {
      fields.date = today;
    } else if (selectedTemplateId === 'how_to_rent_cover') {
      fields.servedDate = today;
    } else if (selectedTemplateId === 'tenant_reference_request') {
      fields.date = today;
      fields.prospectName = '';
      fields.previousAddress = '';
    }

    setTemplateFields(fields);
    setStep('template_fields');
  };

  const handleGenerate = () => {
    if (!selectedTemplate) return;
    const propertyAddress = selectedProperty
      ? `${selectedProperty.address_line_1}, ${selectedProperty.city}, ${selectedProperty.postcode}`
      : '';
    const tenantName = selectedTenancy?.tenant_name || templateFields.prospectName || '';

    let doc;
    try {
      switch (selectedTemplateId) {
        case 'section_21_notice':
          doc = generateSection21PDF({
            tenantName,
            propertyAddress,
            landlordName,
            noticeDate: templateFields.noticeDate,
            earliestEndDate: templateFields.earliestEndDate,
            gasCertValid: complianceChecks?.gasOk ?? false,
            epcValid: complianceChecks?.epcOk ?? false,
            howToRentServed: complianceChecks?.howToRent ?? false,
            depositProtected: complianceChecks?.depositOk ?? false,
            tenancyStartDate: selectedTenancy?.start_date || '',
          });
          break;
        case 'section_8_notice':
          doc = generateSection8PDF({
            tenantName,
            propertyAddress,
            landlordName,
            noticeDate: templateFields.noticeDate,
            grounds: templateFields.grounds || [],
            groundDetails: templateFields.groundDetails || '',
            earliestCourtDate: templateFields.earliestCourtDate,
          });
          break;
        case 'section_13_rent_increase':
          doc = generateSection13PDF({
            tenantName,
            propertyAddress,
            landlordName,
            currentRent: Number(templateFields.currentRent),
            newRent: Number(templateFields.newRent),
            increaseDate: templateFields.increaseDate,
            noticeDate: templateFields.noticeDate,
          });
          break;
        case 'guarantor_agreement':
          doc = generateGuarantorPDF({
            tenantName,
            propertyAddress,
            landlordName,
            guarantorName: templateFields.guarantorName,
            guarantorAddress: templateFields.guarantorAddress,
            guaranteedAmount: Number(templateFields.guaranteedAmount),
            tenancyStartDate: selectedTenancy?.start_date || '',
          });
          break;
        case 'inventory_template':
          doc = generateInventoryPDF({
            propertyAddress,
            rooms: (rooms || []).filter(r => r.is_lettable).map(r => ({ name: r.room_name })),
            date: templateFields.date,
          });
          break;
        case 'how_to_rent_cover':
          doc = generateHowToRentCoverPDF({
            tenantName,
            propertyAddress,
            landlordName,
            servedDate: templateFields.servedDate,
          });
          break;
        case 'tenant_reference_request':
          doc = generateReferenceRequestPDF({
            propertyAddress,
            landlordName,
            prospectName: templateFields.prospectName,
            previousAddress: templateFields.previousAddress,
            date: templateFields.date,
          });
          break;
      }

      if (doc) {
        doc.save(`${selectedTemplate.name.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

        // Save record
        createDoc.mutate({
          template_id: selectedTemplateId!,
          property_id: selectedPropertyId || null,
          tenancy_id: selectedTenancyId || null,
          tenant_id: selectedTenancy?.tenant_id || null,
          generated_data: templateFields as Record<string, unknown>,
        });

        toast({ title: 'Document generated', description: 'PDF has been downloaded.' });
      }
    } catch (err) {
      console.error('Failed to generate document:', err);
      toast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Something went wrong', variant: 'destructive' });
    }
  };

  const updateField = <K extends keyof TemplateFields>(key: K, value: TemplateFields[K]) => {
    setTemplateFields(prev => ({ ...prev, [key]: value }));
  };

  const renderTemplateBrowser = () => (
    <Tabs defaultValue="all">
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        {TEMPLATE_CATEGORIES.map(c => (
          <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
        ))}
      </TabsList>
      {['all', ...TEMPLATE_CATEGORIES.map(c => c.value)].map(cat => (
        <TabsContent key={cat} value={cat}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DOCUMENT_TEMPLATES
              .filter(t => cat === 'all' || t.category === cat)
              .map(t => (
                <Card
                  key={t.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleSelectTemplate(t.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
                      <Badge variant="outline" className="text-xs capitalize">{t.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{t.description}</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Generate <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );

  const renderContextSelection = () => (
    <div className="space-y-6 max-w-lg">
      <Button variant="ghost" size="sm" onClick={() => setStep('browse')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to templates
      </Button>

      <h3 className="text-lg font-semibold">{selectedTemplate?.name}</h3>

      {selectedTemplate?.legalWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{selectedTemplate.legalWarning}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <Label>Property</Label>
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
            <SelectContent>
              {(properties || []).map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.address_line_1}, {p.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplate?.requiredData.includes('tenancy') && selectedPropertyId && (
          <div>
            <Label>Tenancy</Label>
            <Select value={selectedTenancyId} onValueChange={setSelectedTenancyId}>
              <SelectTrigger><SelectValue placeholder="Select a tenancy" /></SelectTrigger>
              <SelectContent>
                {activeTenancies.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.tenant_name} — {t.room_name} (£{t.rent_amount_pcm}/m)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          onClick={handleContextNext}
          disabled={!selectedPropertyId || (selectedTemplate?.requiredData.includes('tenancy') && !selectedTenancyId)}
        >
          Next
        </Button>
      </div>
    </div>
  );

  const renderTemplateFields = () => {
    const tid = selectedTemplateId;
    return (
      <div className="space-y-6 max-w-lg">
        <Button variant="ghost" size="sm" onClick={() => setStep('select_context')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h3 className="text-lg font-semibold">{selectedTemplate?.name} — Details</h3>

        {tid === 'section_21_notice' && (
          <div className="space-y-4">
            <div>
              <Label>Notice Date</Label>
              <Input type="date" value={templateFields.noticeDate || ''} onChange={e => updateField('noticeDate', e.target.value)} />
            </div>
            <div>
              <Label>Earliest End Date</Label>
              <Input type="date" value={templateFields.earliestEndDate || ''} onChange={e => updateField('earliestEndDate', e.target.value)} />
            </div>
            {complianceChecks && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Pre-flight Checks</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className={complianceChecks.gasOk ? 'text-green-600' : 'text-destructive'}>
                    {complianceChecks.gasOk ? '☑' : '☒'} Valid Gas Safety Certificate
                  </div>
                  <div className={complianceChecks.epcOk ? 'text-green-600' : 'text-destructive'}>
                    {complianceChecks.epcOk ? '☑' : '☒'} Valid EPC
                  </div>
                  <div className={complianceChecks.howToRent ? 'text-green-600' : 'text-destructive'}>
                    {complianceChecks.howToRent ? '☑' : '☒'} How to Rent guide served
                  </div>
                  <div className={complianceChecks.depositOk ? 'text-green-600' : 'text-destructive'}>
                    {complianceChecks.depositOk ? '☑' : '☒'} Deposit registered
                  </div>
                  {!Object.values(complianceChecks).every(Boolean) && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>This Section 21 notice may not be valid.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tid === 'section_8_notice' && (
          <div className="space-y-4">
            <div>
              <Label>Notice Date</Label>
              <Input type="date" value={templateFields.noticeDate || ''} onChange={e => updateField('noticeDate', e.target.value)} />
            </div>
            <div>
              <Label>Earliest Court Date</Label>
              <Input type="date" value={templateFields.earliestCourtDate || ''} onChange={e => updateField('earliestCourtDate', e.target.value)} />
            </div>
            <div>
              <Label>Grounds</Label>
              <div className="space-y-2 mt-1">
                {SECTION_8_GROUNDS.map(g => (
                  <div key={g.value} className="flex items-start gap-2">
                    <Checkbox
                      checked={(templateFields.grounds || []).includes(g.value)}
                      onCheckedChange={(checked) => {
                        const curr = templateFields.grounds || [];
                        updateField('grounds', checked ? [...curr, g.value] : curr.filter((v: string) => v !== g.value));
                      }}
                    />
                    <span className="text-sm">{g.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Particulars</Label>
              <Textarea
                value={templateFields.groundDetails || ''}
                onChange={e => updateField('groundDetails', e.target.value)}
                placeholder="Enter particulars of the grounds relied upon..."
              />
            </div>
          </div>
        )}

        {tid === 'section_13_rent_increase' && (
          <div className="space-y-4">
            <div>
              <Label>Notice Date</Label>
              <Input type="date" value={templateFields.noticeDate || ''} onChange={e => updateField('noticeDate', e.target.value)} />
            </div>
            <div>
              <Label>Current Rent (£/month)</Label>
              <Input type="number" value={templateFields.currentRent || ''} onChange={e => updateField('currentRent', e.target.value as any)} />
            </div>
            <div>
              <Label>New Rent (£/month)</Label>
              <Input type="number" value={templateFields.newRent || ''} onChange={e => updateField('newRent', e.target.value as any)} />
            </div>
            {templateFields.currentRent > 0 && templateFields.newRent > 0 && (
              <p className="text-sm text-muted-foreground">
                Increase: {((templateFields.newRent - templateFields.currentRent) / templateFields.currentRent * 100).toFixed(1)}%
              </p>
            )}
            <div>
              <Label>Effective From</Label>
              <Input type="date" value={templateFields.increaseDate || ''} onChange={e => updateField('increaseDate', e.target.value)} />
            </div>
          </div>
        )}

        {tid === 'guarantor_agreement' && (
          <div className="space-y-4">
            <div>
              <Label>Guarantor Name</Label>
              <Input value={templateFields.guarantorName || ''} onChange={e => updateField('guarantorName', e.target.value)} />
            </div>
            <div>
              <Label>Guarantor Address</Label>
              <Input value={templateFields.guarantorAddress || ''} onChange={e => updateField('guarantorAddress', e.target.value)} />
            </div>
            <div>
              <Label>Guaranteed Amount (£)</Label>
              <Input type="number" value={templateFields.guaranteedAmount || ''} onChange={e => updateField('guaranteedAmount', e.target.value as any)} />
            </div>
          </div>
        )}

        {tid === 'inventory_template' && (
          <div className="space-y-4">
            <div>
              <Label>Inspection Date</Label>
              <Input type="date" value={templateFields.date || ''} onChange={e => updateField('date', e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">
              {(rooms || []).filter(r => r.is_lettable).length} lettable room(s) will be included.
            </p>
          </div>
        )}

        {tid === 'how_to_rent_cover' && (
          <div className="space-y-4">
            <div>
              <Label>Date Served</Label>
              <Input type="date" value={templateFields.servedDate || ''} onChange={e => updateField('servedDate', e.target.value)} />
            </div>
          </div>
        )}

        {tid === 'tenant_reference_request' && (
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={templateFields.date || ''} onChange={e => updateField('date', e.target.value)} />
            </div>
            <div>
              <Label>Prospective Tenant Name</Label>
              <Input value={templateFields.prospectName || ''} onChange={e => updateField('prospectName', e.target.value)} />
            </div>
            <div>
              <Label>Previous Address</Label>
              <Input value={templateFields.previousAddress || ''} onChange={e => updateField('previousAddress', e.target.value)} />
            </div>
          </div>
        )}

        <Button onClick={handleGenerate}>
          <Download className="h-4 w-4 mr-2" /> Generate & Download PDF
        </Button>
      </div>
    );
  };

  const renderRecentDocuments = () => {
    if (!recentDocs?.length) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Recent Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentDocs.slice(0, 10).map(d => {
              const tmpl = DOCUMENT_TEMPLATES.find(t => t.id === d.template_id);
              return (
                <div key={d.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                  <span>{tmpl?.name || d.template_id}</span>
                  <span className="text-muted-foreground">{format(new Date(d.created_at), 'dd MMM yyyy')}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderGeneratedDocuments = () => {
    const docs = generatedDocsV2 || [];
    return (
      <div className="space-y-4">
        {docs.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-sm text-muted-foreground py-8">
                <FileDown className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No generated documents yet.</p>
                <p className="mt-1">Use the Document Generator to create your first document.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {docs.map(d => {
              const tmpl = DOCUMENT_TEMPLATES.find(t => t.id === d.template_id);
              const badge = STATUS_BADGE[d.status] || STATUS_BADGE.draft;
              return (
                <Card key={d.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{d.title || tmpl?.name || d.template_id}</span>
                          <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(d.created_at), 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {d.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateDocStatus.mutate({ id: d.id, status: 'final' })}
                          >
                            Finalise
                          </Button>
                        )}
                        {d.status === 'final' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateDocStatus.mutate({ id: d.id, status: 'sent_for_signing' })}
                          >
                            Mark Sent
                          </Button>
                        )}
                        {d.status === 'sent_for_signing' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateDocStatus.mutate({ id: d.id, status: 'signed', signed_at: new Date().toISOString() })}
                          >
                            Mark Signed
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTemplateEditorTab = () => {
    if (editorTemplateId) {
      const tmpl = DOCUMENT_TEMPLATES.find(t => t.id === editorTemplateId);
      return (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setEditorTemplateId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to templates
          </Button>
          <TemplateEditor
            templateId={editorTemplateId}
            templateName={tmpl?.name || editorTemplateId}
          />
        </div>
      );
    }
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DOCUMENT_TEMPLATES.map(t => (
          <Card
            key={t.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setEditorTemplateId(t.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
                <Badge variant="outline" className="text-xs capitalize">{t.category}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{t.description}</p>
              <Button variant="outline" size="sm" className="w-full">
                <Pencil className="h-4 w-4 mr-1" /> Edit Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderVersionHistoryTab = () => {
    if (versionTemplateId) {
      const tmpl = DOCUMENT_TEMPLATES.find(t => t.id === versionTemplateId);
      return (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setVersionTemplateId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to templates
          </Button>
          <TemplateVersionHistory
            templateId={versionTemplateId}
            templateName={tmpl?.name || versionTemplateId}
          />
        </div>
      );
    }
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DOCUMENT_TEMPLATES.map(t => (
          <Card
            key={t.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setVersionTemplateId(t.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full">
                <History className="h-4 w-4 mr-1" /> View History
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <FileSignature className="h-6 w-6" /> Document Templates
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Generate pre-filled property documents from your data
                  </p>
                </div>
              </div>
            </div>

            <Tabs value={topTab} onValueChange={setTopTab}>
              <TabsList>
                <TabsTrigger value="wizard">Quick Generate</TabsTrigger>
                <TabsTrigger value="editor">Template Editor</TabsTrigger>
                <TabsTrigger value="generate">Document Generator</TabsTrigger>
                <TabsTrigger value="generated">Generated Documents</TabsTrigger>
                <TabsTrigger value="versions">Version History</TabsTrigger>
              </TabsList>

              <TabsContent value="wizard">
                <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                  <div>
                    {step === 'browse' && renderTemplateBrowser()}
                    {step === 'select_context' && renderContextSelection()}
                    {step === 'template_fields' && renderTemplateFields()}
                  </div>
                  <div className="space-y-4">
                    {renderRecentDocuments()}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="editor">
                {renderTemplateEditorTab()}
              </TabsContent>

              <TabsContent value="generate">
                <DocumentGenerator />
              </TabsContent>

              <TabsContent value="generated">
                {renderGeneratedDocuments()}
              </TabsContent>

              <TabsContent value="versions">
                {renderVersionHistoryTab()}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
