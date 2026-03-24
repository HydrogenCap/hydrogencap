import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';

export interface GeneratedDocument {
  id: string;
  org_id: string;
  template_id: string;
  property_id: string | null;
  tenancy_id: string | null;
  tenant_id: string | null;
  generated_data: Record<string, unknown> | null;
  storage_path: string | null;
  created_at: string;
  created_by: string | null;
}

export function useGeneratedDocuments() {
  return useQuery({
    queryKey: ['generated_documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as GeneratedDocument[];
    },
  });
}

export function useCreateGeneratedDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: {
      template_id: string;
      property_id?: string | null;
      tenancy_id?: string | null;
      tenant_id?: string | null;
      generated_data?: Record<string, unknown>;
    }) => {
      const orgId = await fetchUserOrgId();
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('generated_documents')
        .insert([{
          org_id: orgId,
          template_id: doc.template_id,
          property_id: doc.property_id ?? null,
          tenancy_id: doc.tenancy_id ?? null,
          tenant_id: doc.tenant_id ?? null,
          generated_data: (doc.generated_data ?? null) as unknown as Json,
          created_by: user?.id ?? null,
        }])
        .select()
        .single();
      if (error) throw error;
      return data as GeneratedDocument;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['generated_documents'] });
    },
  });
}
