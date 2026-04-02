import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId, useUserOrg } from './useUserOrg';

export interface Lender {
  id: string;
  org_id: string;
  lender_name: string;
  lender_type: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  broker_name: string | null;
  broker_email: string | null;
  broker_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const LENDER_TYPES = [
  { value: 'high_street', label: 'High Street' },
  { value: 'specialist_btl', label: 'Specialist BTL' },
  { value: 'bridging', label: 'Bridging' },
  { value: 'development', label: 'Development' },
  { value: 'private', label: 'Private' },
  { value: 'mezzanine', label: 'Mezzanine' },
] as const;

export function useLenders() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['lenders', orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('lenders')
        .select('*')
        .eq('org_id', orgId!)
        .order('lender_name');
      if (error) throw error;
      return data as Lender[];
    },
    enabled: !!orgId,
    staleTime: 15 * 60 * 1000,
  });
}

export function useCreateLender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lender: Omit<Lender, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await (supabase as any)
        .from('lenders')
        .insert({ ...lender, org_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data as Lender;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lenders'] }),
  });
}

export function useUpdateLender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lender> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('lenders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Lender;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lenders'] }),
  });
}
