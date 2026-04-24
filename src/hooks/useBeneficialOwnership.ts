import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';

// Types for beneficial ownership
export interface BeneficialOwner {
  id: string;
  property_id: string;
  owner_type: 'COMPANY' | 'PERSON';
  company_id: string | null;
  party_id: string | null;
  beneficial_percent: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  company?: {
    id: string;
    legal_name: string;
    company_type: string;
  } | null;
  party?: {
    id: string;
    display_name: string;
    party_type: string;
  } | null;
}

export interface BeneficialOwnerInsert {
  property_id: string;
  owner_type: 'COMPANY' | 'PERSON';
  company_id?: string | null;
  party_id?: string | null;
  beneficial_percent: number;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

export interface BeneficialOwnerUpdate {
  id: string;
  property_id: string;
  owner_type?: 'COMPANY' | 'PERSON';
  company_id?: string | null;
  party_id?: string | null;
  beneficial_percent?: number;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

// Fetch beneficial owners for a property
export function useBeneficialOwners(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['beneficial_owners', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabaseAny
        .from('property_beneficial_owners')
        .select(`
          *,
          company:companies(id, legal_name, company_type),
          party:parties(id, display_name, party_type)
        `)
        .eq('property_id', propertyId)
        .order('beneficial_percent', { ascending: false });

      if (error) throw error;
      return data as BeneficialOwner[];
    },
    enabled: !!propertyId,
  });
}

// Fetch active beneficial owners (no end_date)
export function useActiveBeneficialOwners(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['beneficial_owners_active', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabaseAny
        .from('property_beneficial_owners')
        .select(`
          *,
          company:companies(id, legal_name, company_type),
          party:parties(id, display_name, party_type)
        `)
        .eq('property_id', propertyId)
        .is('end_date', null)
        .order('beneficial_percent', { ascending: false });

      if (error) throw error;
      return data as BeneficialOwner[];
    },
    enabled: !!propertyId,
  });
}

// Add beneficial owner
export function useAddBeneficialOwner() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (owner: BeneficialOwnerInsert) => {
      const { data, error } = await supabaseAny
        .from('property_beneficial_owners')
        .insert(owner)
        .select(`
          *,
          company:companies(id, legal_name, company_type),
          party:parties(id, display_name, party_type)
        `)
        .single();

      if (error) throw error;
      return data as BeneficialOwner;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['beneficial_owners', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['beneficial_owners_active', data.property_id] });
    },
  });
}

// Update beneficial owner
export function useUpdateBeneficialOwner() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, property_id, ...updates }: BeneficialOwnerUpdate) => {
      const { data, error } = await supabaseAny
        .from('property_beneficial_owners')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          company:companies(id, legal_name, company_type),
          party:parties(id, display_name, party_type)
        `)
        .single();

      if (error) throw error;
      return { ...data, property_id } as BeneficialOwner & { property_id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['beneficial_owners', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['beneficial_owners_active', data.property_id] });
    },
  });
}

// Delete beneficial owner
export function useDeleteBeneficialOwner() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabaseAny
        .from('property_beneficial_owners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { propertyId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['beneficial_owners', data.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['beneficial_owners_active', data.propertyId] });
    },
  });
}

// Validation helpers
export function calculateBeneficialSum(owners: BeneficialOwner[]): number {
  return owners
    .filter(o => !o.end_date)
    .reduce((sum, o) => sum + Number(o.beneficial_percent), 0);
}

export function validateBeneficialSum(sum: number, tolerance: number = 0.5): boolean {
  return Math.abs(sum - 100) <= tolerance;
}

// Get owner display name
export function getOwnerDisplayName(owner: BeneficialOwner): string {
  if (owner.owner_type === 'COMPANY' && owner.company) {
    return owner.company.legal_name;
  }
  if (owner.owner_type === 'PERSON' && owner.party) {
    return owner.party.display_name;
  }
  return 'Unknown';
}
