import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';

export type PartyType = 'INDIVIDUAL' | 'COMPANY' | 'TRUST';

export interface Party {
  id: string;
  org_id: string;
  party_type: PartyType;
  display_name: string;
  legal_name: string | null;
  company_number: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartyInsert {
  party_type: PartyType;
  display_name: string;
  legal_name?: string | null;
  company_number?: string | null;
  email?: string | null;
}

// getUserOrgId replaced by shared fetchUserOrgId

export function useParties() {
  return useQuery({
    queryKey: ['parties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parties')
        .select('*')
        .order('display_name');

      if (error) throw error;
      return data as Party[];
    },
  });
}

export function useParty(partyId: string | undefined) {
  return useQuery({
    queryKey: ['parties', partyId],
    queryFn: async () => {
      if (!partyId) return null;
      const { data, error } = await supabase
        .from('parties')
        .select('*')
        .eq('id', partyId)
        .single();

      if (error) throw error;
      return data as Party;
    },
    enabled: !!partyId,
  });
}

export function useCreateParty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (party: PartyInsert) => {
      const orgId = await getUserOrgId();

      const { data, error } = await supabase
        .from('parties')
        .insert({ ...party, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data as Party;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
    },
  });
}

export function useUpdateParty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...party }: Partial<Party> & { id: string }) => {
      const { data, error } = await supabase
        .from('parties')
        .update(party)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Party;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
    },
  });
}

export function useDeleteParty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
    },
  });
}
