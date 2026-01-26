import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_REMINDER_DAYS } from '@/lib/complianceTypes';

// Map document types to compliance types
export const DOC_TYPE_TO_COMPLIANCE_TYPE: Record<string, string> = {
  "gas_safety_certificate": "Gas Safety Certificate (CP12)",
  "electrical_certificate": "Electrical Safety Certificate (EICR)",
  "epc_certificate": "EPC",
  "fire_alarm_certificate": "Fire Alarm Certificate",
  "emergency_lighting_certificate": "Emergency Lighting Certificate",
  "pat_testing": "PAT Testing",
  "fire_risk_assessment": "Fire Risk Assessment (FRA)",
  "hmo_licence": "HMO Licence",
  "building_insurance": "Insurance Schedule",
  "public_liability_insurance": "Insurance Schedule",
  "asbestos_survey": "Asbestos Survey",
  "legionella_assessment": "Legionella Risk Assessment",
  "planning_building_control": "Building Control Certificate",
};

// Compliance doc type labels for display
export const COMPLIANCE_DOC_TYPE_LABELS: Record<string, string> = {
  gas_safety_certificate: 'Gas Safety Certificate (CP12)',
  electrical_certificate: 'EICR (Electrical Safety)',
  epc_certificate: 'EPC',
  fire_alarm_certificate: 'Fire Alarm Certificate',
  emergency_lighting_certificate: 'Emergency Lighting Certificate',
  pat_testing: 'PAT Testing',
  fire_risk_assessment: 'Fire Risk Assessment',
  hmo_licence: 'HMO Licence',
  building_insurance: 'Building Insurance',
  public_liability_insurance: 'Public Liability Insurance',
  asbestos_survey: 'Asbestos Survey',
  legionella_assessment: 'Legionella Risk Assessment',
  planning_building_control: 'Planning/Building Control',
  other: 'Other',
};

interface AcceptComplianceDocumentParams {
  documentId: string;
  docType: string;
  propertyId: string;
  propertyAddress: string;
  issueDate: string | null;
  expiryDate: string | null;
  originalFilename: string;
  fileUrl: string;
  notes?: string;
  epcRating?: string | null;
  // For audit trail
  wasEdited: boolean;
  originalAiSuggestions?: {
    docType: string | null;
    propertyId: string | null;
    issueDate: string | null;
    expiryDate: string | null;
  };
}

async function getUserOrgId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  
  if (error || !data) return null;
  return data.org_id;
}

// Compliance type to short code for filenames
const COMPLIANCE_TYPE_CODES: Record<string, string> = {
  'Gas Safety Certificate (CP12)': 'GasSafety',
  'Electrical Safety Certificate (EICR)': 'EICR',
  'Fire Alarm Certificate': 'FireAlarm',
  'Emergency Lighting Certificate': 'EmergencyLighting',
  'Fire Risk Assessment (FRA)': 'FRA',
  'PAT Testing': 'PAT',
  'Legionella Risk Assessment': 'Legionella',
  'EPC': 'EPC',
  'HMO Licence': 'HMOLicence',
  'Asbestos Survey': 'Asbestos',
  'Building Control Certificate': 'BuildingControl',
  'Insurance Schedule': 'Insurance',
};

function generateComplianceFilename(params: {
  complianceType: string;
  propertyAddress: string;
  originalFilename: string;
}): string {
  const { complianceType, propertyAddress, originalFilename } = params;

  const typeCode = COMPLIANCE_TYPE_CODES[complianceType] || 
    complianceType.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);

  const addressPart = propertyAddress
    .split(',')[0]
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .substring(0, 30);

  const dateStr = new Date().toISOString().split('T')[0];

  const extMatch = originalFilename.match(/\.[^.]+$/);
  const extension = extMatch ? extMatch[0].toLowerCase() : '.pdf';

  return `${typeCode}_${addressPart}_${dateStr}${extension}`;
}

/**
 * Hook to accept a compliance document:
 * 1. Creates or updates the compliance_items record
 * 2. Uploads document to compliance storage
 * 3. Links document to compliance item
 * 4. Archives any previous documents of same type
 * 5. Updates the original document record
 * 6. Syncs EPC rating if applicable
 */
export function useAcceptComplianceDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: AcceptComplianceDocumentParams) => {
      const {
        documentId,
        docType,
        propertyId,
        propertyAddress,
        issueDate,
        expiryDate,
        originalFilename,
        fileUrl,
        notes,
        epcRating,
        wasEdited,
        originalAiSuggestions,
      } = params;

      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Map doc type to compliance type
      const complianceType = DOC_TYPE_TO_COMPLIANCE_TYPE[docType] || docType;

      // 1. Find or create compliance_items record for this property + type
      const { data: existingItems } = await supabase
        .from('compliance_items')
        .select('id')
        .eq('property_id', propertyId)
        .eq('compliance_type', complianceType)
        .limit(1);

      let complianceItemId: string;

      if (existingItems && existingItems.length > 0) {
        // Update existing compliance item
        complianceItemId = existingItems[0].id;
        await supabase
          .from('compliance_items')
          .update({
            issue_date: issueDate,
            expiry_date: expiryDate,
            notes: notes ? `${notes}\n\nUpdated via Compliance Inbox` : 'Updated via Compliance Inbox',
          })
          .eq('id', complianceItemId);
      } else {
        // Create new compliance item
        const { data: newItem, error: createError } = await supabase
          .from('compliance_items')
          .insert({
            property_id: propertyId,
            org_id: orgId,
            compliance_type: complianceType,
            issue_date: issueDate,
            expiry_date: expiryDate,
            responsible_party: 'Owner',
            reminder_days: DEFAULT_REMINDER_DAYS,
            notes: notes || 'Created via Compliance Inbox',
          })
          .select()
          .single();

        if (createError) throw createError;
        complianceItemId = newItem.id;
      }

      // 2. Archive previous documents for this compliance item
      await supabase
        .from('compliance_documents')
        .update({ 
          is_current: false, 
          archived_at: new Date().toISOString() 
        })
        .eq('compliance_item_id', complianceItemId)
        .eq('is_current', true);

      // 3. Get next version number
      const { data: existingDocs } = await supabase
        .from('compliance_documents')
        .select('version_number')
        .eq('compliance_item_id', complianceItemId)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = existingDocs && existingDocs.length > 0 
        ? existingDocs[0].version_number + 1 
        : 1;

      // 4. Generate structured filename
      const structuredFilename = generateComplianceFilename({
        complianceType,
        propertyAddress,
        originalFilename,
      });

      // 5. Copy file to compliance bucket with structured name
      // First download from documents bucket
      const sourcePath = fileUrl.split('/documents/')[1];
      if (sourcePath) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(sourcePath);

        if (!downloadError && fileData) {
          // Upload to compliance bucket
          const compliancePath = `${propertyId}/${complianceItemId}/${Date.now()}_${structuredFilename}`;
          await supabase.storage
            .from('compliance')
            .upload(compliancePath, fileData);

          // Get new URL
          const { data: urlData } = supabase.storage
            .from('compliance')
            .getPublicUrl(compliancePath);

          // 6. Create compliance_documents record
          await supabase
            .from('compliance_documents')
            .insert({
              compliance_item_id: complianceItemId,
              file_url: urlData.publicUrl,
              original_file_name: structuredFilename,
              file_type: originalFilename.split('.').pop() || 'pdf',
              uploaded_by: user.id,
              is_current: true,
              version_number: nextVersion,
              notes: wasEdited 
                ? `AI suggestions edited by user. Original: ${JSON.stringify(originalAiSuggestions)}`
                : 'Auto-processed via Compliance Inbox',
            });
        }
      }

      // 7. Update the original document record
      await supabase
        .from('documents')
        .update({
          review_status: 'accepted',
          doc_type: docType,
          property_id: propertyId,
          final_file_name: structuredFilename,
          renamed_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      // 8. Sync EPC rating to properties table if this is an EPC
      if (docType === 'epc_certificate' && epcRating) {
        await supabase
          .from('properties')
          .update({ epc_rating: epcRating })
          .eq('id', propertyId);
      }

      return { 
        success: true, 
        complianceItemId,
        propertyId,
        complianceType,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['compliance', data.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['compliance', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      
      toast({
        title: 'Document accepted',
        description: `${data.complianceType} record updated successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to process document',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to reject a document from the compliance inbox
 */
export function useRejectComplianceDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from('documents')
        .update({ review_status: 'rejected' })
        .eq('id', documentId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'inbox'] });
      toast({
        title: 'Document rejected',
        description: 'Document moved to rejected',
      });
    },
  });
}

/**
 * Hook to accept all high-confidence documents
 */
export function useAcceptAllHighConfidence() {
  const acceptDocument = useAcceptComplianceDocument();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (documents: Array<{
      id: string;
      ai_suggested_doc_type: string | null;
      ai_doc_type_confidence: number | null;
      ai_suggested_property_id: string | null;
      ai_property_confidence: number | null;
      expiry_date: string | null;
      extracted_issue_date: string | null;
      original_file_name: string;
      file_url: string;
      extracted_epc_rating: string | null;
      property?: { id: string; address_line: string } | null;
    }>) => {
      const highConfidenceDocs = documents.filter(d => 
        d.ai_suggested_doc_type && 
        (d.ai_doc_type_confidence || 0) >= 0.7 &&
        d.ai_suggested_property_id &&
        (d.ai_property_confidence || 0) >= 0.7 &&
        d.property
      );

      if (highConfidenceDocs.length === 0) {
        throw new Error('No high-confidence documents to accept');
      }

      let accepted = 0;
      for (const doc of highConfidenceDocs) {
        await acceptDocument.mutateAsync({
          documentId: doc.id,
          docType: doc.ai_suggested_doc_type!,
          propertyId: doc.ai_suggested_property_id!,
          propertyAddress: doc.property!.address_line,
          issueDate: doc.extracted_issue_date,
          expiryDate: doc.expiry_date,
          originalFilename: doc.original_file_name,
          fileUrl: doc.file_url,
          epcRating: doc.extracted_epc_rating,
          wasEdited: false,
        });
        accepted++;
      }

      return { accepted };
    },
    onSuccess: (data) => {
      toast({
        title: `Accepted ${data.accepted} documents`,
        description: 'High-confidence AI suggestions applied to compliance records',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to accept documents',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}