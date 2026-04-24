import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';

export interface LocalAuthority {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

// Fetch all local authorities for the org
export function useLocalAuthorities() {
  return useQuery({
    queryKey: ['local_authorities'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('local_authorities')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as LocalAuthority[];
    },
  });
}

// Create a new local authority
export function useCreateLocalAuthority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const orgId = await getUserOrgId();
      const { data, error } = await supabaseAny
        .from('local_authorities')
        .insert({ name, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data as LocalAuthority;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local_authorities'] });
    },
  });
}

// Find or create a local authority by name (case-insensitive)
export function useFindOrCreateLocalAuthority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string): Promise<LocalAuthority> => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Name is required');

      // First try to find existing (case-insensitive)
      const { data: existing, error: findError } = await supabaseAny
        .from('local_authorities')
        .select('*')
        .ilike('name', trimmedName)
        .maybeSingle();

      if (findError) throw findError;
      if (existing) return existing as LocalAuthority;

      // Create new if not found
      const orgId = await getUserOrgId();
      const { data, error } = await supabaseAny
        .from('local_authorities')
        .insert({ name: trimmedName, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data as LocalAuthority;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local_authorities'] });
    },
  });
}
