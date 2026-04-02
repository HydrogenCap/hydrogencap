import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { fetchUserOrgId, useUserOrg } from '@/hooks/useUserOrg';

export interface DocumentShareLink {
  id: string;
  org_id: string;
  document_id: string | null;
  compliance_document_id: string | null;
  created_by: string;
  token: string;
  expires_at: string;
  max_views: number | null;
  view_count: number;
  password_hash: string | null;
  is_active: boolean;
  last_viewed_at: string | null;
  created_at: string;
}

export function useDocumentShareLinks(documentId?: string, complianceDocumentId?: string) {
  const { user } = useAuth();
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['document-share-links', orgId, documentId, complianceDocumentId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('document_share_links')
        .select('*')
        .eq('org_id', orgId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (documentId) {
        query = query.eq('document_id', documentId);
      } else if (complianceDocumentId) {
        query = query.eq('compliance_document_id', complianceDocumentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DocumentShareLink[];
    },
    enabled: !!user && !!orgId && (!!documentId || !!complianceDocumentId),
  });
}

export function useAllDocumentShareLinks() {
  const { user } = useAuth();
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['document-share-links', orgId, 'all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('document_share_links')
        .select('*')
        .eq('org_id', orgId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DocumentShareLink[];
    },
    enabled: !!user && !!orgId,
  });
}

export function useCreateDocumentShareLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      documentId,
      complianceDocumentId,
      expiresInDays = 7,
      maxViews,
    }: {
      documentId?: string;
      complianceDocumentId?: string;
      expiresInDays?: number;
      maxViews?: number;
    }) => {
      const orgId = await fetchUserOrgId();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const { data, error } = await (supabase as any)
        .from('document_share_links')
        .insert({
          org_id: orgId,
          document_id: documentId || null,
          compliance_document_id: complianceDocumentId || null,
          created_by: user?.id,
          expires_at: expiresAt.toISOString(),
          max_views: maxViews || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DocumentShareLink;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['document-share-links'] });
      toast.success('Share link created');
      return data;
    },
    onError: () => {
      toast.error('Failed to create share link');
    },
  });
}

export function useDeactivateShareLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await (supabase as any)
        .from('document_share_links')
        .update({ is_active: false })
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-share-links'] });
      toast.success('Share link deactivated');
    },
    onError: () => {
      toast.error('Failed to deactivate link');
    },
  });
}

export function generateShareUrl(token: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/shared/${token}`;
}
