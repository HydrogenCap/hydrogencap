import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type Property = Database['public']['Tables']['properties']['Row'];
type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
type PropertyUpdate = Database['public']['Tables']['properties']['Update'];
type Loan = Database['public']['Tables']['loans']['Row'];
type Income = Database['public']['Tables']['income']['Row'];
type Costs = Database['public']['Tables']['costs']['Row'];

export interface PropertyWithFinancials extends Property {
  loans: Loan[];
  income: Income[];
  costs: Costs[];
}

async function getUserOrgId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  
  if (error || !data) return null;
  return data.org_id;
}

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          loans(*),
          income(*),
          costs(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PropertyWithFinancials[];
    },
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          loans(*),
          income(*),
          costs(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as PropertyWithFinancials | null;
    },
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (property: Omit<PropertyInsert, 'org_id'>) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('properties')
        .insert({ ...property, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...property }: PropertyUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('properties')
        .update(property)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', data.id] });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

// Loan hooks
export function useCreateLoan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (loan: Database['public']['Tables']['loans']['Insert']) => {
      const { data, error } = await supabase
        .from('loans')
        .insert(loan)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
    },
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...loan }: Database['public']['Tables']['loans']['Update'] & { id: string }) => {
      const { data, error } = await supabase
        .from('loans')
        .update(loan)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
    },
  });
}

// Income hooks
export function useUpsertIncome() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (income: Database['public']['Tables']['income']['Insert']) => {
      const { data, error } = await supabase
        .from('income')
        .upsert(income, { onConflict: 'property_id,year' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
    },
  });
}

// Costs hooks
export function useUpsertCosts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (costs: Database['public']['Tables']['costs']['Insert']) => {
      const { data, error } = await supabase
        .from('costs')
        .upsert(costs, { onConflict: 'property_id,year' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
    },
  });
}
