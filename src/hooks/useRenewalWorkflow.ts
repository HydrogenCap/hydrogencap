import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';

export type RenewalStep = 'book' | 'confirm' | 'upload' | 'verify';

export interface RenewalWorkflowState {
  step: RenewalStep;
  complianceItemId: string;
  propertyId: string;
  complianceType: string;
  currentExpiryDate: string | null;
  contractorId: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  contractorNotes: string | null;
  appointmentConfirmed: boolean;
  appointmentDate: string | null;
  appointmentTime: string | null;
  tenantNotified: boolean;
  tenantAccessInstructions: string | null;
  newCertFile: File | null;
  newExpiryDate: string | null;
  newIssueDate: string | null;
  certificateReference: string | null;
  aiExtracted: boolean;
}

export const INITIAL_RENEWAL_STATE: Omit<RenewalWorkflowState, 'complianceItemId' | 'propertyId' | 'complianceType' | 'currentExpiryDate'> = {
  step: 'book',
  contractorId: null,
  preferredDate: null,
  preferredTime: null,
  contractorNotes: null,
  appointmentConfirmed: false,
  appointmentDate: null,
  appointmentTime: null,
  tenantNotified: false,
  tenantAccessInstructions: null,
  newCertFile: null,
  newExpiryDate: null,
  newIssueDate: null,
  certificateReference: null,
  aiExtracted: false,
};

// Trade mapping: compliance type -> contractor trade filter
export const COMPLIANCE_TRADE_MAP: Record<string, string> = {
  GAS_SAFETY: 'Gas Safety Certificate (CP12)',
  EICR: 'Electrical Safety Certificate (EICR)',
  EPC: 'EPC',
  HMO_LICENCE: 'HMO Licence',
  FIRE_ALARM: 'Fire Alarm Certificate',
  EMERGENCY_LIGHTING: 'Emergency Lighting Certificate',
  LEGIONELLA: 'Legionella Risk Assessment',
  PAT_TESTING: 'PAT Testing',
};

export function useStartRenewal(complianceItemId: string | undefined) {
  return useQuery({
    queryKey: ['renewal-workflow', complianceItemId],
    queryFn: async () => {
      if (!complianceItemId) return null;

      const { data, error } = await supabaseAny
        .from('compliance_items')
        .select(`
          id, property_id, compliance_type, expiry_date, renewal_status,
          renewal_contractor_id, renewal_booked_date, renewal_notes
        `)
        .eq('id', complianceItemId)
        .single();

      if (error) throw error;
      return data as {
        id: string;
        property_id: string;
        compliance_type: string;
        expiry_date: string | null;
        renewal_status: string | null;
        renewal_contractor_id: string | null;
        renewal_booked_date: string | null;
        renewal_notes: string | null;
      };
    },
    enabled: !!complianceItemId,
  });
}

export function useBookContractor() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      complianceItemId,
      contractorId,
      preferredDate,
      notes,
    }: {
      complianceItemId: string;
      contractorId: string;
      preferredDate: string;
      notes?: string;
    }) => {
      const { data, error } = await supabaseAny
        .from('compliance_items')
        .update({
          renewal_status: 'booked',
          renewal_contractor_id: contractorId,
          renewal_booked_date: preferredDate,
          renewal_notes: notes || null,
        })
        .eq('id', complianceItemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance'] });
      qc.invalidateQueries({ queryKey: ['renewal-workflow'] });
    },
  });
}

export function useConfirmAppointment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      complianceItemId,
      appointmentDate,
      tenantNotified: _tenantNotified,
      tenantAccessInstructions,
    }: {
      complianceItemId: string;
      appointmentDate: string;
      tenantNotified?: boolean;
      tenantAccessInstructions?: string;
    }) => {
      const { data, error } = await supabaseAny
        .from('compliance_items')
        .update({
          renewal_status: 'confirmed',
          renewal_booked_date: appointmentDate,
          renewal_notes: tenantAccessInstructions || null,
        })
        .eq('id', complianceItemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance'] });
      qc.invalidateQueries({ queryKey: ['renewal-workflow'] });
    },
  });
}

export function useUploadRenewalCert() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      complianceItemId,
      propertyId,
      file,
      complianceType: _complianceType,
      propertyAddress: _propertyAddress,
      newIssueDate,
      newExpiryDate,
      certificateReference,
    }: {
      complianceItemId: string;
      propertyId: string;
      file: File;
      complianceType: string;
      propertyAddress: string;
      newIssueDate: string;
      newExpiryDate: string;
      certificateReference?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const orgId = await fetchUserOrgId();
      if (!orgId) throw new Error('No organization found');

      // Get current version number
      const { data: existingDocs } = await supabaseAny
        .from('compliance_documents')
        .select('version_number')
        .eq('compliance_item_id', complianceItemId)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = existingDocs?.length > 0
        ? existingDocs[0].version_number + 1
        : 1;

      // Upload file
      const fileExt = file.name.split('.').pop();
      const storagePath = `${orgId}/${propertyId}/${complianceItemId}/${Date.now()}_renewal.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('compliance')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Archive previous current documents
      await supabaseAny
        .from('compliance_documents')
        .update({ is_current: false, archived_at: new Date().toISOString() })
        .eq('compliance_item_id', complianceItemId)
        .eq('is_current', true);

      // Create document record
      const { data, error } = await supabaseAny
        .from('compliance_documents')
        .insert({
          compliance_item_id: complianceItemId,
          file_url: storagePath,
          original_file_name: file.name,
          file_type: file.type,
          uploaded_by: user.id,
          is_current: true,
          version_number: nextVersion,
          notes: certificateReference ? `Ref: ${certificateReference}` : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Update compliance item dates
      await supabaseAny
        .from('compliance_items')
        .update({
          issue_date: newIssueDate,
          expiry_date: newExpiryDate,
          renewal_status: 'awaiting_verification',
        })
        .eq('id', complianceItemId);

      return { data, propertyId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance'] });
      qc.invalidateQueries({ queryKey: ['renewal-workflow'] });
    },
  });
}

export function useCompleteRenewal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      complianceItemId,
      newIssueDate,
      newExpiryDate,
    }: {
      complianceItemId: string;
      newIssueDate: string;
      newExpiryDate: string;
    }) => {
      const { data, error } = await supabaseAny
        .from('compliance_items')
        .update({
          issue_date: newIssueDate,
          expiry_date: newExpiryDate,
          renewal_status: 'completed',
        })
        .eq('id', complianceItemId)
        .select()
        .single();

      if (error) throw error;

      // Auto-close any matching open compliance task
      try {
        const { data: openTask } = await supabaseAny
          .from('compliance_tasks')
          .select('id')
          .eq('property_id', data.property_id)
          .eq('document_type', data.compliance_type)
          .in('status', ['open', 'in_progress', 'waiting', 'pending', 'contractor_assigned', 'contractor_requested', 'awaiting_upload'])
          .maybeSingle();

        if (openTask) {
          const userId = (await supabase.auth.getUser()).data.user?.id;
          await supabase.from('compliance_tasks').update({
            status: 'completed',
            resolved_at: new Date().toISOString(),
            resolved_by: userId,
            resolution_notes: `Renewal completed for ${data.compliance_type}`,
          } as any).eq('id', openTask.id);
        }
      } catch (e) {
        console.warn('Failed to auto-close compliance task:', e);
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance'] });
      qc.invalidateQueries({ queryKey: ['compliance-matrix-v2'] });
      qc.invalidateQueries({ queryKey: ['portfolio-compliance-score-v2'] });
      qc.invalidateQueries({ queryKey: ['renewal-workflow'] });
      qc.invalidateQueries({ queryKey: ['compliance-tasks'] });
    },
  });
}

export function useRenewalHistory(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['renewal-history', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];

      const { data, error } = await supabaseAny
        .from('compliance_items')
        .select(`
          id, compliance_type, issue_date, expiry_date,
          renewal_status, renewal_contractor_id, renewal_booked_date, renewal_notes,
          updated_at
        `)
        .eq('property_id', propertyId)
        .not('renewal_status', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Array<{
        id: string;
        compliance_type: string;
        issue_date: string | null;
        expiry_date: string | null;
        renewal_status: string;
        renewal_contractor_id: string | null;
        renewal_booked_date: string | null;
        renewal_notes: string | null;
        updated_at: string;
      }>;
    },
    enabled: !!propertyId,
  });
}
