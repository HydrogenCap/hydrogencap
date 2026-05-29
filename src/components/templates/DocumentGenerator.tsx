import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { FileDown, Eye, EyeOff, Send, Check, Loader2, ArrowLeft } from 'lucide-react';
// jspdf is loaded dynamically inside handleGeneratePdf to keep ~448kB of PDF
// machinery out of the initial page chunk.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { useTenancyAgreements } from '@/hooks/useTenancyAgreements';
import {
  useLatestTemplateVersion,
  useResolveMergeData,
  useCreateDocument,
  useUpdateDocumentStatus,
} from '@/hooks/useTemplateUpgrade';
import { mergeTemplate, extractMergeFields } from '@/lib/template-merge';
import { DOCUMENT_TEMPLATES } from '@/lib/documentTemplates';
import { toast } from "sonner";

type DocStatus = 'draft' | 'final' | 'sent_for_signing' | 'signed';

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  final: { label: 'Final', color: 'bg-blue-100 text-blue-700' },
  sent_for_signing: { label: 'Sent for Signing', color: 'bg-amber-100 text-amber-700' },
  signed: { label: 'Signed', color: 'bg-green-100 text-green-700' },
};

const STATUS_FLOW: DocStatus[] = ['draft', 'final', 'sent_for_signing', 'signed'];

interface DocumentGeneratorProps {
  onBack?: () => void;
}

export function DocumentGenerator({ onBack }: DocumentGeneratorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedTenancyId, setSelectedTenancyId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState<DocStatus>('draft');
  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  const { data: properties } = usePropertiesV2();
  const { data: tenancies } = useTenancyAgreements({ propertyId: selectedPropertyId || undefined });
  const { data: latestVersion } = useLatestTemplateVersion(selectedTemplateId || null);

  const selectedTemplate = DOCUMENT_TEMPLATES.find(t => t.id === selectedTemplateId);
  const selectedTenancy = tenancies?.find(t => t.id === selectedTenancyId);
  const activeTenancies = useMemo(
    () => (tenancies || []).filter(t => t.status === 'active' || t.status === 'pending'),
    [tenancies]
  );

  const { data: mergeData, isLoading: mergeLoading } = useResolveMergeData({
    propertyId: selectedPropertyId || undefined,
    tenantId: selectedTenancy?.tenant_id || undefined,
    tenancyId: selectedTenancyId || undefined,
  });

  const createDoc = useCreateDocument();
  const updateStatus = useUpdateDocumentStatus();

  const templateContent = latestVersion?.content || '';
  const mergedContent = useMemo(() => {
    if (!templateContent || !mergeData) return templateContent;
    return mergeTemplate(templateContent, mergeData);
  }, [templateContent, mergeData]);

  const displayContent = editedContent ?? mergedContent;

  const unresolvedFields = useMemo(() => {
    if (!displayContent) return [];
    return extractMergeFields(displayContent);
  }, [displayContent]);

  const handlePropertyChange = (id: string) => {
    setSelectedPropertyId(id);
    setSelectedTenancyId('');
    setEditedContent(null);
    setSavedDocId(null);
    setDocStatus('draft');
  };

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    setSelectedPropertyId('');
    setSelectedTenancyId('');
    setEditedContent(null);
    setSavedDocId(null);
    setDocStatus('draft');
  };

  const handleSaveDocument = async () => {
    const content = editedContent ?? mergedContent;
    if (!content || !selectedTemplateId) return;

    try {
      const result = await createDoc.mutateAsync({
        template_id: selectedTemplateId,
        property_id: selectedPropertyId || null,
        tenancy_id: selectedTenancyId || null,
        tenant_id: selectedTenancy?.tenant_id || null,
        title: `${selectedTemplate?.name || selectedTemplateId} — ${format(new Date(), 'dd MMM yyyy')}`,
        content,
        merge_data: mergeData || undefined,
        status: docStatus,
      });
      setSavedDocId(result.id);
      toast.success('Document saved', { description: `Status: ${STATUS_CONFIG[docStatus].label}` });
    } catch (err) {
      toast.error('Save failed', { description: err instanceof Error ? err.message : 'Something went wrong' });
    }
  };

  const handleStatusUpdate = async (newStatus: DocStatus) => {
    if (!savedDocId) return;
    try {
      await updateStatus.mutateAsync({
        id: savedDocId,
        status: newStatus,
        ...(newStatus === 'signed' ? { signed_at: new Date().toISOString() } : {}),
      });
      setDocStatus(newStatus);
      toast.success('Status updated', { description: STATUS_CONFIG[newStatus].label });
    } catch (err) {
      toast.error('Update failed', { description: err instanceof Error ? err.message : 'Something went wrong' });
    }
  };

  const handleGeneratePdf = useCallback(async () => {
    const content = editedContent ?? mergedContent;
    if (!content) return;

    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const title = selectedTemplate?.name || 'Document';

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const lines = doc.splitTextToSize(content, 170);
    let y = 35;
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 20, y);
      y += 5;
    }

    const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);
    toast.success('PDF generated', { description: filename });
  }, [editedContent, mergedContent, selectedTemplate]);

  const canGenerate = !!selectedTemplateId && !!latestVersion && !!selectedPropertyId;

  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template selection */}
          <div>
            <Label>Template</Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
              <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_TEMPLATES.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplateId && !latestVersion && (
              <p className="text-xs text-amber-600 mt-1">
                No saved version found. Create one in the Template Editor first.
              </p>
            )}
          </div>

          {/* Property selection */}
          <div>
            <Label>Property</Label>
            <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
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

          {/* Tenancy selection */}
          {selectedTemplate?.requiredData.includes('tenancy') && selectedPropertyId && (
            <div>
              <Label>Tenancy</Label>
              <Select value={selectedTenancyId} onValueChange={val => { setSelectedTenancyId(val); setEditedContent(null); }}>
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

          {mergeLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Resolving merge fields...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview & edit area */}
      {canGenerate && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Document Content</CardTitle>
              <div className="flex items-center gap-2">
                {unresolvedFields.length > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-600">
                    {unresolvedFields.length} unresolved field(s)
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {showPreview ? 'Edit' : 'Preview'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {showPreview ? (
              <div className="whitespace-pre-wrap text-sm font-mono leading-relaxed border rounded-md p-4 bg-muted/30 min-h-[200px]">
                {displayContent || <span className="text-muted-foreground italic">No content</span>}
              </div>
            ) : (
              <textarea
                className="w-full min-h-[200px] border rounded-md p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring bg-background resize-y"
                value={displayContent}
                onChange={e => setEditedContent(e.target.value)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {canGenerate && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* Status tracking */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <div className="flex gap-1">
                  {STATUS_FLOW.map((s, i) => {
                    const current = STATUS_FLOW.indexOf(docStatus);
                    const isActive = i <= current;
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <Badge
                        key={s}
                        variant="outline"
                        className={`text-xs cursor-pointer ${isActive ? cfg.color : 'opacity-40'}`}
                        onClick={() => savedDocId && handleStatusUpdate(s)}
                      >
                        {i < current && <Check className="h-3 w-3 mr-0.5" />}
                        {cfg.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDocument}
                  disabled={createDoc.isPending}
                >
                  <Send className="h-4 w-4 mr-1" />
                  {savedDocId ? 'Save Again' : 'Save Document'}
                </Button>
                <Button size="sm" onClick={handleGeneratePdf}>
                  <FileDown className="h-4 w-4 mr-1" /> Generate PDF
                </Button>
              </div>
            </div>

            <Separator className="my-4" />

            <p className="text-xs text-muted-foreground">
              Save the document to track its status. Use the status badges to advance through the workflow:
              Draft → Final → Sent for Signing → Signed.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
