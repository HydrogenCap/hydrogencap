import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useUserOrg } from './useUserOrg';
import type { VaultDocRef } from '@/lib/pdf/lenderPack/checklist';

/**
 * Fetch document-vault records (categories not already represented as
 * compliance_documents) for a set of properties so the lender-pack
 * checklist can show vault status and reuse links instead of
 * re-uploading.
 */
const LENDER_VAULT_CATEGORIES = [
  'tenancy',
  'legal-pack',
  'company-formation',
  'insurance',
  'bank-statements',
  'statements',
];

export function useLenderPackVaultDocs(propertyIds: string[]) {
  const { data: orgId } = useUserOrg();
  return useQuery<VaultDocRef[]>({
    queryKey: ['lender-pack-vault-docs', orgId, [...propertyIds].sort()],
    enabled: !!orgId && propertyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('documents')
        .select('property_id, category, file_url, original_file_name, expiry_date, is_current_version')
        .eq('org_id', orgId!)
        .in('property_id', propertyIds)
        .in('category', LENDER_VAULT_CATEGORIES)
        .is('deleted_at', null);
      if (error) throw error;
      return ((data ?? []) as Array<VaultDocRef & { is_current_version?: boolean | null }>)
        .filter(d => d.is_current_version !== false)
        .map(({ is_current_version: _ignored, ...rest }) => rest);
    },
    staleTime: 60 * 1000,
  });
}
