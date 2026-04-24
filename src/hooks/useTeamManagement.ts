import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fetchUserOrgId, useUserOrg } from '@/hooks/useUserOrg';

// ─── Types ───────────────────────────────────────────────────────

export type AppRole = 'owner' | 'admin' | 'member' | 'accountant' | 'viewer';

export interface TeamMember {
  membershipId: string;
  userId: string;
  role: AppRole;
  joinedAt: string;
  email: string;
  fullName: string | null;
}

export interface TeamInvite {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
  token: string;
  invitedByName: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

interface AcceptTeamInviteResult {
  error?: string;
  message?: string;
}

// ─── Current user role ───────────────────────────────────────────

export function useCurrentUserRole() {
  const { user } = useAuth();
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['current-user-role', user?.id, orgId],
    queryFn: async () => {
      if (!user || !orgId) return null;
      const { data, error } = await supabaseAny
        .from('memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as AppRole) || null;
    },
    enabled: !!user && !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── List team members ──────────────────────────────────────────

export function useTeamMembers() {
  const { user } = useAuth();
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['team-members', orgId],
    queryFn: async () => {
      const { data: memberships, error: mError } = await supabaseAny
        .from('memberships')
        .select('id, user_id, role, created_at')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: true });

      if (mError) throw mError;
      if (!memberships || memberships.length === 0) return [];

      const userIds = memberships.map(m => m.user_id);
      const { data: profiles, error: pError } = await supabaseAny
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      if (pError) throw pError;

      type ProfileRow = { user_id: string; email?: string | null; full_name?: string | null };
      const profileMap = new Map(
        ((profiles || []) as ProfileRow[]).map((p) => [p.user_id, p])
      );

      return memberships.map(m => {
        const profile = profileMap.get(m.user_id);
        return {
          membershipId: m.id,
          userId: m.user_id,
          role: m.role as AppRole,
          joinedAt: m.created_at,
          email: profile?.email || 'Unknown',
          fullName: profile?.full_name || null,
        } as TeamMember;
      });
    },
    enabled: !!user && !!orgId,
  });
}

// ─── List invites ───────────────────────────────────────────────

export function useTeamInvites() {
  const { user } = useAuth();
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['team-invites', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('team_invites')
        .select('*')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const inviterIds = [...new Set((data || []).map(i => i.invited_by))];
      const { data: profiles } = await supabaseAny
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', inviterIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p.full_name])
      );

      return (data || []).map(i => ({
        id: i.id,
        email: i.email,
        name: i.name,
        role: i.role as AppRole,
        token: i.token,
        invitedByName: profileMap.get(i.invited_by) || null,
        createdAt: i.created_at,
        expiresAt: i.expires_at,
        acceptedAt: i.accepted_at,
        revokedAt: i.revoked_at,
      } as TeamInvite));
    },
    enabled: !!user && !!orgId,
  });
}

// ─── Send invite ────────────────────────────────────────────────

export function useSendTeamInvite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ email, name, role }: { email: string; name?: string; role: AppRole }) => {
      const orgId = await fetchUserOrgId();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Delete any existing non-accepted invite for this email+org
      await supabaseAny
        .from('team_invites')
        .delete()
        .eq('org_id', orgId!)
        .eq('email', email.toLowerCase().trim())
        .is('accepted_at', null);

      const { data: invite, error } = await supabaseAny
        .from('team_invites')
        .insert({
          org_id: orgId!,
          email: email.toLowerCase().trim(),
          name: name?.trim() || null,
          role,
          invited_by: userData.user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This email has already been invited and accepted');
        }
        throw error;
      }

      // Send email via edge function
      const { error: fnError } = await supabase.functions.invoke('send-team-invite', {
        body: { inviteId: invite.id },
      });

      if (fnError) {
        console.error('Email send failed:', fnError);
        // Don't throw — invite is created, they can copy the link manually
      }

      return invite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invites'] });
      toast({ title: 'Invite sent' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to send invite',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Resend invite ──────────────────────────────────────────────

export function useResendTeamInvite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data, error } = await supabaseAny
        .from('team_invites')
        .update({
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          revoked_at: null,
        })
        .eq('id', inviteId)
        .select()
        .single();

      if (error) throw error;

      await supabase.functions.invoke('send-team-invite', {
        body: { inviteId },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invites'] });
      toast({ title: 'Invite resent' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to resend invite',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Revoke invite ──────────────────────────────────────────────

export function useRevokeTeamInvite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabaseAny
        .from('team_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invites'] });
      toast({ title: 'Invite revoked' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to revoke invite',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Change member role ─────────────────────────────────────────

export function useChangeTeamRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ membershipId, newRole }: { membershipId: string; newRole: AppRole }) => {
      // RLS enforces that only admin/owner can update membership roles.
      // Non-admin callers will receive a permission error from the DB.
      const { error } = await supabaseAny
        .from('memberships')
        .update({ role: newRole })
        .eq('id', membershipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Role updated' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Remove team member ─────────────────────────────────────────

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabaseAny
        .from('memberships')
        .delete()
        .eq('id', membershipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({ title: 'Team member removed' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove member',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Accept invite (called by invitee) ──────────────────────────

export function useAcceptTeamInvite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_team_invite', {
        p_token: token,
      });

      if (error) throw error;

      const result = (data || {}) as AcceptTeamInviteResult;
      if (result?.error) throw new Error(result.error);

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['team-invites'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['user-org'] });
      toast({ title: data.message || 'Invite accepted — welcome to the team!' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to accept invite',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
