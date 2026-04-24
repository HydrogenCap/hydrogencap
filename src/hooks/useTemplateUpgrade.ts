import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId, useUserOrg } from './useUserOrg';
import { resolveMergeData } from '@/lib/template-merge';
import type { Json } from '@/integrations/supabase/types';

// ── Types ────────────────────────────────────────────────────

export interface TemplateVersion {
  id: string;
  org_id: string;
  template_id: string;
  version_number: number;
  content: string;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface GeneratedDocumentRow {
  id: string;
  org_id: string;
  template_id: string;
  property_id: string | null;
  tenancy_id: string | null;
  tenant_id: string | null;
  entity_id: string | null;
  title: string | null;
  content: string | null;
  merge_data: Record<string, string> | null;
  generated_data: Record<string, unknown> | null;
  status: string;
  document_url: string | null;
  signed_at: string | null;
  storage_path: string | null;
  created_at: string;
  created_by: string | null;
}

// ── Template versions ────────────────────────────────────────

export function useTemplateVersions(templateId: string | null) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['template_versions', orgId, templateId],
    queryFn: async () => {
      if (!orgId || !templateId) return [];
      const { data, error } = await supabaseAny
        .from('template_versions')
        .select('*')
        .eq('org_id', orgId)
        .eq('template_id', templateId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return data as TemplateVersion[];
    },
    enabled: !!orgId && !!templateId,
  });
}

export function useLatestTemplateVersion(templateId: string | null) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['template_version_latest', orgId, templateId],
    queryFn: async () => {
      if (!orgId || !templateId) return null;
      const { data, error } = await supabaseAny
        .from('template_versions')
        .select('*')
        .eq('org_id', orgId)
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TemplateVersion | null;
    },
    enabled: !!orgId && !!templateId,
  });
}

export function useSaveTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      template_id: string;
      content: string;
      change_summary?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data: { user } } = await supabase.auth.getUser();

      // Get next version number
      const { data: latest } = await supabaseAny
        .from('template_versions')
        .select('version_number')
        .eq('org_id', orgId)
        .eq('template_id', payload.template_id)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (latest?.version_number ?? 0) + 1;

      const { data, error } = await supabaseAny
        .from('template_versions')
        .insert([{
          org_id: orgId,
          template_id: payload.template_id,
          version_number: nextVersion,
          content: payload.content,
          change_summary: payload.change_summary || null,
          created_by: user?.id ?? null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as TemplateVersion;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['template_versions'] });
      qc.invalidateQueries({ queryKey: ['template_version_latest', undefined, variables.template_id] });
    },
  });
}

export function useRestoreTemplateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      template_id: string;
      content: string;
      restored_from_version: number;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data: { user } } = await supabase.auth.getUser();

      const { data: latest } = await supabaseAny
        .from('template_versions')
        .select('version_number')
        .eq('org_id', orgId)
        .eq('template_id', payload.template_id)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (latest?.version_number ?? 0) + 1;

      const { data, error } = await supabaseAny
        .from('template_versions')
        .insert([{
          org_id: orgId,
          template_id: payload.template_id,
          version_number: nextVersion,
          content: payload.content,
          change_summary: `Restored from version ${payload.restored_from_version}`,
          created_by: user?.id ?? null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as TemplateVersion;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template_versions'] });
      qc.invalidateQueries({ queryKey: ['template_version_latest'] });
    },
  });
}

// ── Document generation ──────────────────────────────────────

export function useGeneratedDocumentsV2() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['generated_documents_v2', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabaseAny
        .from('generated_documents')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as GeneratedDocumentRow[];
    },
    enabled: !!orgId,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: {
      template_id: string;
      property_id?: string | null;
      tenancy_id?: string | null;
      tenant_id?: string | null;
      entity_id?: string | null;
      title: string;
      content: string;
      merge_data?: Record<string, string>;
      status?: string;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabaseAny
        .from('generated_documents')
        .insert([{
          org_id: orgId,
          template_id: doc.template_id,
          property_id: doc.property_id ?? null,
          tenancy_id: doc.tenancy_id ?? null,
          tenant_id: doc.tenant_id ?? null,
          entity_id: doc.entity_id ?? null,
          title: doc.title,
          content: doc.content,
          merge_data: (doc.merge_data ?? null) as Json | null,
          status: doc.status || 'draft',
          created_by: user?.id ?? null,
        }])
        .select()
        .single();
      if (error) throw error;
      return data as GeneratedDocumentRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generated_documents_v2'] });
      qc.invalidateQueries({ queryKey: ['generated_documents'] });
    },
  });
}

export function useUpdateDocumentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; status: string; document_url?: string; signed_at?: string }) => {
      const update: Record<string, unknown> = { status: payload.status };
      if (payload.document_url !== undefined) update.document_url = payload.document_url;
      if (payload.signed_at !== undefined) update.signed_at = payload.signed_at;

      const { data, error } = await supabaseAny
        .from('generated_documents')
        .update(update)
        .eq('id', payload.id)
        .select()
        .single();
      if (error) throw error;
      return data as GeneratedDocumentRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generated_documents_v2'] });
      qc.invalidateQueries({ queryKey: ['generated_documents'] });
    },
  });
}

// ── Merge data resolution hook ───────────────────────────────

export function useResolveMergeData(ctx: {
  propertyId?: string;
  tenantId?: string;
  tenancyId?: string;
  entityId?: string;
}) {
  return useQuery({
    queryKey: ['merge_data', ctx.propertyId, ctx.tenantId, ctx.tenancyId, ctx.entityId],
    queryFn: () => resolveMergeData({
      propertyId: ctx.propertyId,
      tenantId: ctx.tenantId,
      tenancyId: ctx.tenancyId,
      entityId: ctx.entityId,
    }),
    enabled: !!(ctx.propertyId || ctx.tenantId || ctx.tenancyId || ctx.entityId),
  });
}
