import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ShareholderInvite {
  id: string;
  org_id: string;
  email: string;
  name: string | null;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ShareholderAccess {
  id: string;
  org_id: string;
  user_id: string;
  invite_id: string | null;
  access_level: 'read_only' | 'limited';
  can_view_financials: boolean;
  can_view_compliance: boolean;
  can_view_documents: boolean;
  last_accessed_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useShareholderInvites() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['shareholder-invites'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('shareholder_invites')
        .select('*')
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ShareholderInvite[];
    },
    enabled: !!user,
  });
}

export function useShareholderAccessList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['shareholder-access'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('shareholder_access')
        .select('*')
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ShareholderAccess[];
    },
    enabled: !!user,
  });
}

export function useCreateShareholderInvite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ email, name }: { email: string; name?: string }) => {
      const normalizedEmail = email.toLowerCase().trim();

      // Get user's org_id
      const { data: membership } = await supabaseAny
        .from('memberships')
        .select('org_id')
        .eq('user_id', user?.id)
        .single();

      if (!membership) throw new Error('No organization found');

      await supabaseAny
        .from('shareholder_invites')
        .delete()
        .eq('org_id', membership.org_id)
        .eq('email', normalizedEmail)
        .is('accepted_at', null);

      const { data: invite, error } = await supabaseAny
        .from('shareholder_invites')
        .insert({
          org_id: membership.org_id,
          email: normalizedEmail,
          name: name || null,
          invited_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: fnError } = await supabase.functions.invoke('send-shareholder-invite', {
        body: { inviteId: invite.id },
      });

      if (fnError) {
        console.error('Shareholder invite email failed:', fnError);
        return {
          invite: invite as ShareholderInvite,
          emailSent: false,
        };
      }

      return {
        invite: invite as ShareholderInvite,
        emailSent: true,
      };
    },
    onSuccess: ({ emailSent }) => {
      queryClient.invalidateQueries({ queryKey: ['shareholder-invites'] });
      if (emailSent) {
        toast.success('Invitation sent successfully');
      } else {
        toast.success('Invite created. Email delivery failed, but you can still copy the invite link.');
      }
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('This email has already been invited');
      } else {
        toast.error('Failed to send invitation');
      }
    },
  });
}

export function useResendShareholderInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data: invite, error } = await supabaseAny
        .from('shareholder_invites')
        .update({
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          revoked_at: null,
        })
        .eq('id', inviteId)
        .select()
        .single();

      if (error) throw error;

      const { error: fnError } = await supabase.functions.invoke('send-shareholder-invite', {
        body: { inviteId },
      });

      if (fnError) {
        console.error('Shareholder invite resend failed:', fnError);
        return {
          invite: invite as ShareholderInvite,
          emailSent: false,
        };
      }

      return {
        invite: invite as ShareholderInvite,
        emailSent: true,
      };
    },
    onSuccess: ({ emailSent }) => {
      queryClient.invalidateQueries({ queryKey: ['shareholder-invites'] });
      if (emailSent) {
        toast.success('Invitation resent');
      } else {
        toast.success('Invite renewed. Email delivery failed, but you can still copy the invite link.');
      }
    },
    onError: () => {
      toast.error('Failed to resend invitation');
    },
  });
}

export function useRevokeShareholderInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabaseAny
        .from('shareholder_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareholder-invites'] });
      toast.success('Invitation revoked');
    },
    onError: () => {
      toast.error('Failed to revoke invitation');
    },
  });
}

export function useRevokeShareholderAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accessId: string) => {
      const { error } = await supabaseAny
        .from('shareholder_access')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', accessId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareholder-access'] });
      toast.success('Access revoked');
    },
    onError: () => {
      toast.error('Failed to revoke access');
    },
  });
}

export function useUpdateShareholderPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      accessId,
      permissions,
    }: {
      accessId: string;
      permissions: Partial<Pick<ShareholderAccess, 'can_view_financials' | 'can_view_compliance' | 'can_view_documents'>>;
    }) => {
      const { error } = await supabaseAny
        .from('shareholder_access')
        .update({
          ...permissions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', accessId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shareholder-access'] });
      toast.success('Permissions updated');
    },
    onError: () => {
      toast.error('Failed to update permissions');
    },
  });
}
