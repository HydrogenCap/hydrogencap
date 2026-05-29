import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { extractStoragePath } from '@/lib/storagePaths';
import { logError } from '@/lib/errorLogger';
import { toast } from "sonner";

// Map document types to compliance types
export const DOC_TYPE_TO_COMPLIANCE_TYPE: Record<string, string> = {
  "gas_safety_certificate": "Gas Safety Certificate (CP12)",
  "electrical_certificate": "Electrical Safety Certificate (EICR)",
  "epc_certificate": "EPC",
  "fire_alarm_certificate": "Fire Alarm Certificate",
  "emergency_lighting_certificate": "Emergency Lighting Certificate",
  "fire_suppression_certificate": "Fire Suppression System Certificate",
  "pat_testing": "PAT Testing",
  "fire_risk_assessment": "Fire Risk Assessment (FRA)",
  "hmo_licence": "HMO Licence",
  "building_insurance": "Buildings Insurance Schedule",
  "asbestos_survey": "Asbestos Survey",
  "legionella_assessment": "Legionella Risk Assessment",
  "planning_building_control": "Building Control Certificate",
  "fire_door_certification": "Fire Door Certification",
  "fire_panel_commissioning": "Fire Panel Commissioning Certificate",
  "mcs_certificate": "MCS Certificate",
  "floor_plans": "Floor Plans / Fire Plans",
};

/**
 * Map app/AI document type slugs (e.g. `building_insurance`, `epc_certificate`)
 * to the canonical values allowed by the `compliance_documents_v2_document_type_check`
 * DB constraint. Anything not in this map is passed through (and the DB will reject
 * it with a clear error if invalid).
 */
const DOC_TYPE_TO_V2_DOC_TYPE: Record<string, string> = {
  building_insurance: 'buildings_insurance',
  buildings_insurance: 'buildings_insurance',
  epc_certificate: 'epc',
  epc: 'epc',
  electrical_certificate: 'eicr',
  eicr: 'eicr',
  fire_alarm_certificate: 'fire_alarm_cert',
  fire_alarm_cert: 'fire_alarm_cert',
  emergency_lighting_certificate: 'emergency_lighting_cert',
  emergency_lighting_cert: 'emergency_lighting_cert',
  legionella_assessment: 'legionella_risk_assessment',
  legionella_risk_assessment: 'legionella_risk_assessment',
  smoke_co_alarm_certificate: 'smoke_co_alarm_cert',
  smoke_co_alarm_cert: 'smoke_co_alarm_cert',
  gas_safety_certificate: 'gas_safety_certificate',
  fire_risk_assessment: 'fire_risk_assessment',
  hmo_licence: 'hmo_licence',
  selective_licence: 'selective_licence',
  asbestos_survey: 'asbestos_survey',
  pat_testing: 'pat_testing',
  furniture_fire_safety: 'furniture_fire_safety',
  energy_performance_certificate: 'energy_performance_certificate',
  planning_permission: 'planning_permission',
  building_regs_completion: 'building_regs_completion',
  landlord_liability_insurance: 'landlord_liability_insurance',
  rent_guarantee_insurance: 'rent_guarantee_insurance',
};

function toV2DocumentType(docType: string): string {
  return DOC_TYPE_TO_V2_DOC_TYPE[docType] || 'other';
}

// Standard validity periods in years for UK compliance certificates
const STANDARD_VALIDITY_YEARS: Record<string, number> = {
  "gas_safety_certificate": 1,
  "electrical_certificate": 5,
  "epc_certificate": 10,
  "fire_alarm_certificate": 1,
  "emergency_lighting_certificate": 1,
  "fire_suppression_certificate": 1,
  "pat_testing": 1,
  "fire_risk_assessment": 1,
  "hmo_licence": 5,
  "legionella_assessment": 2,
};

function calculateExpiryDate(
  docType: string,
  issueDate: string | null,
  providedExpiry: string | null
): string | null {
  if (providedExpiry) return providedExpiry;
  if (!issueDate) return null;
  const validityYears = STANDARD_VALIDITY_YEARS[docType];
  if (!validityYears) return null;
  const issue = new Date(issueDate);
  issue.setFullYear(issue.getFullYear() + validityYears);
  return issue.toISOString().split('T')[0];
}

export const COMPLIANCE_DOC_TYPE_LABELS: Record<string, string> = {
  gas_safety_certificate: 'Gas Safety Certificate (CP12)',
  electrical_certificate: 'EICR (Electrical Safety)',
  epc_certificate: 'EPC',
  fire_alarm_certificate: 'Fire Alarm Certificate',
  emergency_lighting_certificate: 'Emergency Lighting Certificate',
  fire_suppression_certificate: 'Fire Suppression System Certificate',
  pat_testing: 'PAT Testing',
  fire_risk_assessment: 'Fire Risk Assessment',
  hmo_licence: 'HMO Licence',
  building_insurance: 'Building Insurance',
  asbestos_survey: 'Asbestos Survey',
  legionella_assessment: 'Legionella Risk Assessment',
  planning_building_control: 'Planning/Building Control',
  fire_door_certification: 'Fire Door Certification',
  fire_panel_commissioning: 'Fire Panel Commissioning Certificate',
  mcs_certificate: 'MCS Certificate',
  floor_plans: 'Floor Plans / Fire Plans',
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
  wasEdited: boolean;
  originalAiSuggestions?: {
    docType: string | null;
    propertyId: string | null;
    issueDate: string | null;
    expiryDate: string | null;
  };
}

type ComplianceDocumentUpdate = Pick<
  Database['public']['Tables']['compliance_documents_v2']['Update'],
  'issuer_name' | 'certificate_number'
>;

interface CompliancePropertySummary {
  id: string;
  address_line_1?: string | null;
  city?: string | null;
  address_line?: string | null;
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
  'Buildings Insurance Schedule': 'Insurance',
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
 * Hook to accept a compliance document (V2):
 * 1. Marks existing current compliance_documents_v2 as superseded
 * 2. Copies file to compliance storage
 * 3. Creates new compliance_documents_v2 record
 * 4. Updates original documents record
 * 5. Enriches with AI-extracted certifier/reference data
 * 6. Auto-populates insurance if applicable
 */
export function useAcceptComplianceDocument() {
  const queryClient = useQueryClient();
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
        wasEdited,
        originalAiSuggestions,
      } = params;

      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const complianceType = DOC_TYPE_TO_COMPLIANCE_TYPE[docType] || docType;
      const calculatedExpiryDate = calculateExpiryDate(docType, issueDate, expiryDate);

      // Calculate status for V2
      let status = 'valid';
      if (calculatedExpiryDate) {
        const expiry = new Date(calculatedExpiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) status = 'expired';
        else if (diff <= 30) status = 'critical';
        else if (diff <= 90) status = 'expiring_soon';
      }

      // Map AI/app slug -> DB-allowed document_type for compliance_documents_v2
      const v2DocType = toV2DocumentType(docType);

      // 1. Mark any existing current doc as superseded
      const { data: existing } = await supabaseAny
        .from('compliance_documents_v2')
        .select('id')
        .eq('property_id', propertyId)
        .eq('document_type', v2DocType)
        .eq('is_current', true)
        .maybeSingle();

      if (existing) {
        await supabaseAny
          .from('compliance_documents_v2')
          .update({ is_current: false })
          .eq('id', existing.id);
      }

      // 2. Generate structured filename
      const structuredFilename = generateComplianceFilename({
        complianceType,
        propertyAddress,
        originalFilename,
      });

      // 3. Copy file to compliance storage
      let newFileUrl: string | null = null;
      const sourcePath = extractStoragePath('documents', fileUrl);

      if (sourcePath) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(sourcePath);

        if (!downloadError && fileData) {
          const compliancePath = `${orgId}/${propertyId}/${docType}/${Date.now()}-${structuredFilename}`;
          const { error: uploadError } = await supabase.storage
            .from('compliance-documents')
            .upload(compliancePath, fileData);

          if (uploadError) {
            throw uploadError;
          }

          newFileUrl = compliancePath;
        }
      }

      // 4. Create compliance_documents_v2 record
      const { data: newDoc, error: insertError } = await supabaseAny
        .from('compliance_documents_v2')
        .insert({
          org_id: orgId,
          property_id: propertyId,
          document_type: v2DocType,
          issue_date: issueDate || new Date().toISOString().split('T')[0],
          expiry_date: calculatedExpiryDate,
          file_url: newFileUrl,
          file_name: structuredFilename,
          certificate_number: null,
          issuer_name: null,
          is_current: true,
          status,
          ai_extracted: true,
          ai_confidence_score: null,
          supersedes_id: existing?.id || null,
          uploaded_by: user.id,
          notes: wasEdited
            ? `AI suggestions edited by user. Original: ${JSON.stringify(originalAiSuggestions)}`
            : notes || 'Processed via Compliance Inbox',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 5. Update the original documents record
      await supabaseAny
        .from('documents')
        .update({
          review_status: 'accepted',
          doc_type: docType,
          property_id: propertyId,
          final_file_name: structuredFilename,
          renamed_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      // 6. Enrich with AI-extracted certifier & reference data
      const { data: docMeta } = await supabaseAny
        .from('documents')
        .select('extracted_certifier_name, extracted_certifier_company, extracted_reference_number')
        .eq('id', documentId)
        .single();

      if (docMeta && newDoc) {
        const updates: ComplianceDocumentUpdate = {};
        if (docMeta.extracted_certifier_company || docMeta.extracted_certifier_name) {
          updates.issuer_name = docMeta.extracted_certifier_company || docMeta.extracted_certifier_name;
        }
        if (docMeta.extracted_reference_number) {
          updates.certificate_number = docMeta.extracted_reference_number;
        }
        if (Object.keys(updates).length > 0) {
          await supabaseAny
            .from('compliance_documents_v2')
            .update(updates)
            .eq('id', newDoc.id);
        }
      }

      // 6b. V1 `compliance_items` mirror — REMOVED in §0b Ship A
      // (kill double-writers). Reads of V1 still happen in legacy
      // surfaces and will be redirected via a compat layer in Ship C.
      // See docs/release/compliance-cutover-2026-05-08.md.

      // 7. Auto-populate insurance_policies if applicable
      if (docType === 'building_insurance' || docType === 'public_liability_insurance') {
        const { data: docData } = await supabaseAny
          .from('documents')
          .select('extracted_certifier_company, extracted_reference_number, expiry_date, extracted_issue_date')
          .eq('id', documentId)
          .single();

        if (docData) {
          const insurerName = docData.extracted_certifier_company || 'Unknown Insurer';
          const policyNumber = docData.extracted_reference_number || null;
          const renewalDate = calculatedExpiryDate || docData.expiry_date || null;
          const startDate = issueDate || docData.extracted_issue_date || null;

          if (renewalDate) {
            const { data: existingPolicy } = await supabaseAny
              .from('insurance_policies')
              .select('id')
              .eq('property_id', propertyId)
              .limit(1);

            if (existingPolicy && existingPolicy.length > 0) {
              await supabaseAny
                .from('insurance_policies')
                .update({
                  insurer_name: insurerName,
                  policy_number: policyNumber,
                  renewal_date: renewalDate,
                  start_date: startDate,
                  status: 'active',
                  notes: 'Auto-updated from uploaded insurance document',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingPolicy[0].id);
            } else {
              await supabaseAny
                .from('insurance_policies')
                .insert({
                  org_id: orgId,
                  property_id: propertyId,
                  insurer_name: insurerName,
                  policy_number: policyNumber,
                  renewal_date: renewalDate,
                  start_date: startDate,
                  premium_gbp: 0,
                  status: 'active',
                  notes: 'Auto-created from uploaded insurance document',
                });
            }
          }
        }
      }

      return {
        success: true,
        complianceDocId: newDoc.id,
        propertyId,
        complianceType,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-documents-v2'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-matrix-v2'] });
      queryClient.invalidateQueries({ queryKey: ['compliance_matrix_v2_stats'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
      // V1 mirror — see step 6b above
      queryClient.invalidateQueries({ queryKey: ['compliance', data.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['compliance', 'all'] });

      toast.success('Document accepted', { description: `${data.complianceType} record updated successfully` });
    },
    onError: (error) => {
      toast.error('Failed to process document', { description: error instanceof Error ? error.message : 'Unknown error' });
    },
  });
}

/**
 * Hook to reject a document from the compliance inbox
 */
export function useRejectComplianceDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabaseAny
        .from('documents')
        .update({ review_status: 'rejected' })
        .eq('id', documentId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'inbox'] });
      toast.success('Document rejected', { description: 'Document moved to rejected' });
    },
  });
}

/**
 * Hook to accept all high-confidence documents
 */
export function useAcceptAllHighConfidence() {
  const acceptDocument = useAcceptComplianceDocument();
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
      property?: CompliancePropertySummary | null;
    }>) => {
      const propertyIds = Array.from(new Set(documents.map(d => d.ai_suggested_property_id).filter(Boolean))) as string[];
      const { data: properties, error: propertyError } = propertyIds.length > 0
        ? await supabaseAny
          .from('properties_v2')
          .select('id, address_line_1, city, address_line')
          .in('id', propertyIds)
        : { data: [], error: null };

      if (propertyError) throw propertyError;

      const propertyById = new Map<string, CompliancePropertySummary>(
        ((properties || []) as CompliancePropertySummary[]).map(p => [p.id, p])
      );

      const acceptReadyDocs = documents
        .filter(d => d.ai_suggested_doc_type && d.ai_suggested_property_id)
        .map(d => ({ ...d, property: d.property || propertyById.get(d.ai_suggested_property_id!) || null }))
        .filter(d => d.property);

      if (acceptReadyDocs.length === 0) {
        throw new Error('No documents with both a compliance type and property match to accept');
      }

      let accepted = 0;
      const failures: Array<{ id: string; filename: string; error: string }> = [];
      for (const doc of acceptReadyDocs) {
        const prop = doc.property;
        const propertyAddress = prop?.address_line_1
          ? `${prop.address_line_1}, ${prop.city || ''}`
          : prop?.address_line || 'Unknown';

        try {
          await acceptDocument.mutateAsync({
            documentId: doc.id,
            docType: doc.ai_suggested_doc_type!,
            propertyId: doc.ai_suggested_property_id!,
            propertyAddress,
            issueDate: doc.extracted_issue_date,
            expiryDate: doc.expiry_date,
            originalFilename: doc.original_file_name,
            fileUrl: doc.file_url,
            epcRating: doc.extracted_epc_rating,
            wasEdited: false,
          });
          accepted++;
        } catch (err) {
          failures.push({
            id: doc.id,
            filename: doc.original_file_name,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
          logError({
            source: 'useAcceptAllHighConfidence',
            message: `Bulk-accept failed for ${doc.original_file_name}`,
            context: { documentId: doc.id, docType: doc.ai_suggested_doc_type, propertyId: doc.ai_suggested_property_id },
            error: err,
          });
        }
      }

      return { accepted, failures, total: acceptReadyDocs.length };
    },
    onSuccess: (data) => {
      if (data.failures.length === 0) {
        toast.success(`Accepted ${data.accepted} document${data.accepted === 1 ? '' : 's'}`, { description: 'High-confidence AI suggestions applied to compliance records' });
      } else if (data.accepted === 0) {
        toast.error(`All ${data.total} failed`, { description: data.failures[0]?.error || 'See per-row errors' });
      } else {
        toast.error(`Accepted ${data.accepted} of ${data.total}`, { description: `${data.failures.length} failed — ${data.failures[0].filename}: ${data.failures[0].error}` });
      }
    },
    onError: (error) => {
      toast.error('Failed to accept documents', { description: error instanceof Error ? error.message : 'Unknown error' });
    },
  });
}
