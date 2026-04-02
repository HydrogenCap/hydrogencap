import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TenantPortalAccess {
  id: string;
  org_id: string;
  tenant_id: string;
  tenancy_id: string;
  user_id: string;
  granted_at: string;
  revoked_at: string | null;
  can_view_rent: boolean;
  can_view_documents: boolean;
  can_submit_maintenance: boolean;
}

export function useTenantPortalSession() {
  const { user, loading: authLoading } = useAuth();

  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ['tenant-portal-access', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from('tenant_portal_access')
        .select('*')
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .maybeSingle();

      if (error) throw error;
      return data as TenantPortalAccess | null;
    },
    enabled: !!user,
  });

  return {
    user,
    access,
    isLoading: authLoading || accessLoading,
    isTenantUser: !!access,
    canViewRent: access?.can_view_rent ?? false,
    canViewDocuments: access?.can_view_documents ?? false,
    canSubmitMaintenance: access?.can_submit_maintenance ?? false,
    tenancyId: access?.tenancy_id ?? null,
    tenantId: access?.tenant_id ?? null,
    orgId: access?.org_id ?? null,
  };
}
