import { useState, useMemo } from 'react';
import { format, addMonths } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { usePropertyRooms } from '@/hooks/useRoomsV2';
import { useTenancyAgreements } from '@/hooks/useTenancyAgreements';
import { useGeneratedDocuments, useCreateGeneratedDocument } from '@/hooks/useGeneratedDocuments';
import { useComplianceMatrix } from '@/hooks/useComplianceV2';
import { useGeneratedDocumentsV2, useUpdateDocumentStatus } from '@/hooks/useTemplateUpgrade';
import { DOCUMENT_TEMPLATES } from '@/lib/documentTemplates';
import {
  generateSection21PDF, generateSection8PDF, generateSection13PDF,
  generateGuarantorPDF, generateInventoryPDF, generateHowToRentCoverPDF,
  generateReferenceRequestPDF,
} from '@/lib/templatePdfGenerator';
import type { TemplateFields, WizardStep } from '../utils/types';

export function useDocumentTemplatesState() {
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

  return {
    // state
    step, setStep,
    selectedTemplateId,
    selectedPropertyId, setSelectedPropertyId,
    selectedTenancyId, setSelectedTenancyId,
    templateFields,
    topTab, setTopTab,
    editorTemplateId, setEditorTemplateId,
    versionTemplateId, setVersionTemplateId,
    // data
    properties, rooms, recentDocs, generatedDocsV2,
    selectedTemplate, selectedProperty, selectedTenancy,
    activeTenancies, complianceChecks,
    updateDocStatus,
    // handlers
    handleSelectTemplate,
    handleContextNext,
    handleGenerate,
    updateField,
  };
}
