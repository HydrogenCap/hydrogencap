import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useUserOrg } from '@/hooks/useUserOrg';
import type { AppRole } from '@/hooks/useUserRole';
import { toast } from "sonner";

export interface OrgMember {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  email?: string;
  full_name?: string;
}

export function useOrgMembers() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['org-members', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('memberships')
        .select('id, user_id, role, created_at')
        .eq('org_id', orgId!);
      if (error) throw error;

      // Fetch profiles for display
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabaseAny
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      type ProfileRow = { user_id: string; email?: string; full_name?: string };
      const profileMap = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.user_id, p]));

      return data.map(m => ({
        ...m,
        email: profileMap.get(m.user_id)?.email,
        full_name: profileMap.get(m.user_id)?.full_name,
      })) as OrgMember[];
    },
    enabled: !!orgId,
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ membershipId, role }: { membershipId: string; role: AppRole }) => {
      const { error } = await supabaseAny
        .from('memberships')
        .update({ role })
        .eq('id', membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members'] });
      toast.success('Role updated');
    },
    onError: (e) => {
      toast.error('Failed to update role', { description: e.message });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabaseAny
        .from('memberships')
        .delete()
        .eq('id', membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-members'] });
      toast.success('Member removed');
    },
    onError: (e) => {
      toast.error('Failed to remove member', { description: e.message });
    },
  });
}
