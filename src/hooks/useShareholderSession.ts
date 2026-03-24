import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ShareholderAccess {
  id: string;
  org_id: string;
  user_id: string;
  access_level: string;
  can_view_financials: boolean;
  can_view_compliance: boolean;
  can_view_documents: boolean;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  invite_id: string | null;
  revoked_at: string | null;
}

export function useShareholderSession() {
  const { user } = useAuth();

  const { data: access, isLoading, error } = useQuery({
    queryKey: ['shareholder-access', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('shareholder_access')
        .select('*')
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .maybeSingle();

      if (error) throw error;
      return data as ShareholderAccess | null;
    },
    enabled: !!user?.id,
  });

  return {
    access,
    isLoading,
    error,
    isShareholderUser: !!access,
    canViewFinancials: access?.can_view_financials ?? false,
    canViewCompliance: access?.can_view_compliance ?? false,
    canViewDocuments: access?.can_view_documents ?? false,
    orgId: access?.org_id,
  };
}

export function useAcceptShareholderInvite() {
  return async (token: string) => {
    const { data, error } = await supabase.rpc('accept_shareholder_invite', {
      p_token: token,
    });

    if (error) throw error;

    const result = (data || {}) as { error?: string };
    if (result.error) throw new Error(result.error);

    return result;
  };
}
