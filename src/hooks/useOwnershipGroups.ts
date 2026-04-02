import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import { showMutationError } from '@/lib/errorToast';

export interface OwnershipGroup {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  party_id: string;
  role: 'MEMBER' | 'KEY_ENTITY';
  created_at: string;
  party?: {
    id: string;
    display_name: string;
    party_type: string;
    company_number: string | null;
  };
}

export interface OwnershipGroupWithMembers extends OwnershipGroup {
  members: GroupMember[];
}

// getUserOrgId replaced by shared fetchUserOrgId

export function useOwnershipGroups() {
  return useQuery({
    queryKey: ['ownership_groups'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ownership_groups')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as OwnershipGroup[];
    },
  });
}

export function useOwnershipGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: ['ownership_groups', groupId],
    queryFn: async () => {
      if (!groupId) return null;
      
      const { data: group, error: groupError } = await (supabase as any)
        .from('ownership_groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      const { data: members, error: membersError } = await (supabase as any)
        .from('group_members')
        .select(`
          *,
          party:parties(id, display_name, party_type, company_number)
        `)
        .eq('group_id', groupId);

      if (membersError) throw membersError;

      return {
        ...group,
        members: members || [],
      } as OwnershipGroupWithMembers;
    },
    enabled: !!groupId,
  });
}

export function useCreateOwnershipGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const orgId = await getUserOrgId();

      const { data, error } = await (supabase as any)
        .from('ownership_groups')
        .insert({ ...input, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data as OwnershipGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership_groups'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to create ownership group');
    },
  });
}

export function useUpdateOwnershipGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...group }: Partial<OwnershipGroup> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('ownership_groups')
        .update(group)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as OwnershipGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership_groups'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to update ownership group');
    },
  });
}

export function useDeleteOwnershipGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('ownership_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership_groups'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to delete ownership group');
    },
  });
}

// Group member mutations
export function useAddGroupMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: {
      group_id: string;
      party_id: string;
      role?: 'MEMBER' | 'KEY_ENTITY';
    }) => {
      const { data, error } = await (supabase as any)
        .from('group_members')
        .insert({
          group_id: input.group_id,
          party_id: input.party_id,
          role: input.role || 'MEMBER',
        })
        .select(`
          *,
          party:parties(id, display_name, party_type, company_number)
        `)
        .single();

      if (error) throw error;
      return data as GroupMember;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ownership_groups', data.group_id] });
      queryClient.invalidateQueries({ queryKey: ['ownership_groups'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to add group member');
    },
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, groupId }: { id: string; groupId: string }) => {
      const { error } = await (supabase as any)
        .from('group_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { groupId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ownership_groups', data.groupId] });
      queryClient.invalidateQueries({ queryKey: ['ownership_groups'] });
    },
    onError: (error) => {
      showMutationError(error, 'Failed to remove group member');
    },
  });
}
