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
  return async (token: string, userId: string) => {
    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from('shareholder_invites')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .single();

    if (inviteError || !invite) {
      throw new Error('Invalid or expired invitation');
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      throw new Error('This invitation has expired');
    }

    // Create shareholder access
    const { error: accessError } = await supabase
      .from('shareholder_access')
      .insert({
        org_id: invite.org_id,
        user_id: userId,
        invite_id: invite.id,
        access_level: 'read_only',
        can_view_financials: true,
        can_view_compliance: true,
        can_view_documents: true,
      });

    if (accessError) throw accessError;

    // Mark invite as accepted
    const { error: updateError } = await supabase
      .from('shareholder_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    if (updateError) throw updateError;

    return invite;
  };
}
