import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';

export interface ManagementCompany {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

// Fetch all management companies for the org
export function useManagementCompanies() {
  return useQuery({
    queryKey: ['management_companies'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('management_companies')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as ManagementCompany[];
    },
  });
}

// Create a new management company
export function useCreateManagementCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const orgId = await getUserOrgId();
      const { data, error } = await supabaseAny
        .from('management_companies')
        .insert({ name, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data as ManagementCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management_companies'] });
    },
  });
}

// Find or create a management company by name (case-insensitive)
export function useFindOrCreateManagementCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string): Promise<ManagementCompany> => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Name is required');

      // First try to find existing (case-insensitive)
      const { data: existing, error: findError } = await supabaseAny
        .from('management_companies')
        .select('*')
        .ilike('name', trimmedName)
        .maybeSingle();

      if (findError) throw findError;
      if (existing) return existing as ManagementCompany;

      // Create new if not found
      const orgId = await getUserOrgId();
      const { data, error } = await supabaseAny
        .from('management_companies')
        .insert({ name: trimmedName, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data as ManagementCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management_companies'] });
    },
  });
}

// Seed default management company (Tenure IQ) if none exist
export function useSeedDefaultManagementCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const orgId = await getUserOrgId();
      
      // Check if any companies exist
      const { data: existing, error: checkError } = await supabaseAny
        .from('management_companies')
        .select('id')
        .limit(1);

      if (checkError) throw checkError;
      if (existing && existing.length > 0) return null; // Already seeded

      // Insert default
      const { data, error } = await supabaseAny
        .from('management_companies')
        .insert({ name: 'Tenure IQ', org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data as ManagementCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management_companies'] });
    },
  });
}
