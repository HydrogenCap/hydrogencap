import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ComplianceMatrixRow, PortfolioComplianceScore, ComplianceDocType } from '@/lib/complianceV2Types';

// ============================================================
// Compliance Matrix (view)
// ============================================================

export function useComplianceMatrix() {
  return useQuery({
    queryKey: ['compliance-matrix-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_matrix_v2')
        .select('*')
        .order('urgency_score', { ascending: true });
      if (error) throw error;
      return data as unknown as ComplianceMatrixRow[];
    },
  });
}

// ============================================================
// Portfolio Compliance Score (view)
// ============================================================

export function usePortfolioComplianceScoreV2() {
  return useQuery({
    queryKey: ['portfolio-compliance-score-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_compliance_score_v2')
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as PortfolioComplianceScore;
    },
  });
}

// ============================================================
// Compliance Documents CRUD
// ============================================================

export function useComplianceDocumentsV2(propertyId?: string, documentType?: string) {
  return useQuery({
    queryKey: ['compliance-documents-v2', propertyId, documentType],
    queryFn: async () => {
      let query = supabase.from('compliance_documents_v2').select('*');
      if (propertyId) query = query.eq('property_id', propertyId);
      if (documentType) query = query.eq('document_type', documentType);
      query = query.order('issue_date', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId || !documentType,
  });
}

interface CreateComplianceDocInput {
  org_id: string;
  property_id: string;
  document_type: ComplianceDocType;
  issue_date: string;
  expiry_date?: string | null;
  issuer_name?: string | null;
  certificate_number?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  cost?: number | null;
  notes?: string | null;
}

export function useCreateComplianceDocV2() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateComplianceDocInput) => {
      // Calculate status
      let status: string = 'valid';
      if (input.expiry_date) {
        const expiry = new Date(input.expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) status = 'expired';
        else if (diff <= 30) status = 'critical';
        else if (diff <= 90) status = 'expiring_soon';
      }

      // Mark any existing current doc as superseded
      const { data: existing } = await supabase
        .from('compliance_documents_v2')
        .select('id')
        .eq('property_id', input.property_id)
        .eq('document_type', input.document_type)
        .eq('is_current', true)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('compliance_documents_v2')
          .update({ is_current: false })
          .eq('id', existing.id);
      }

      const { data, error } = await supabase
        .from('compliance_documents_v2')
        .insert({
          ...input,
          is_current: true,
          status,
          supersedes_id: existing?.id || null,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-matrix-v2'] });
      qc.invalidateQueries({ queryKey: ['portfolio-compliance-score-v2'] });
      qc.invalidateQueries({ queryKey: ['compliance-documents-v2'] });
    },
  });
}

// ============================================================
// Requirements — toggle required/not required
// ============================================================

export function useToggleRequirementV2() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requirementId,
      isRequired,
      overrideReason,
    }: {
      requirementId: string;
      isRequired: boolean;
      overrideReason?: string;
    }) => {
      const { error } = await supabase
        .from('compliance_requirements_v2')
        .update({
          is_required: isRequired,
          override_reason: isRequired ? null : (overrideReason || null),
        })
        .eq('id', requirementId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-matrix-v2'] });
      qc.invalidateQueries({ queryKey: ['portfolio-compliance-score-v2'] });
    },
  });
}

// ============================================================
// Refresh statuses (call on page load)
// ============================================================

export function useRefreshComplianceStatuses() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('refresh_compliance_statuses_v2');
      if (error) throw error;
    },
  });
}

// ============================================================
// Property-level compliance data
// ============================================================

export function usePropertyComplianceV2(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['compliance-matrix-v2', 'property', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_matrix_v2')
        .select('*')
        .eq('property_id', propertyId!)
        .order('urgency_score', { ascending: true });
      if (error) throw error;
      return data as unknown as ComplianceMatrixRow[];
    },
    enabled: !!propertyId,
  });
}
