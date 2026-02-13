import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { ActivityLoggers } from './useActivityLog';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';

type Property = Database['public']['Tables']['properties']['Row'];
type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
type PropertyUpdate = Database['public']['Tables']['properties']['Update'];
type Loan = Database['public']['Tables']['loans']['Row'];
type Income = Database['public']['Tables']['income']['Row'];
type Costs = Database['public']['Tables']['costs']['Row'];
type Tenancy = Database['public']['Tables']['tenancies']['Row'];

export interface PropertyWithFinancials extends Property {
  loans: Loan[];
  income: Income[];
  costs: Costs[];
  tenancies: Tenancy[];
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
          costs(*),
          tenancies(*)
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
          costs(*),
          tenancies(*)
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      // Log activity
      ActivityLoggers.propertyCreated(data.id, data.address_line);
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, previousValue, ...property }: PropertyUpdate & { id: string; previousValue?: number | null }) => {
      const { data, error } = await supabase
        .from('properties')
        .update(property)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Check if valuation changed
      if (property.current_value_gbp !== undefined && property.current_value_gbp !== previousValue) {
        ActivityLoggers.valuationChanged(
          data.id, 
          previousValue ?? null, 
          Number(property.current_value_gbp)
        );
      }
      
      return data;
    },
    // Optimistic update for instant UI feedback
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['property', newData.id] });
      const previousProperty = queryClient.getQueryData<PropertyWithFinancials>(['property', newData.id]);
      
      if (previousProperty) {
        queryClient.setQueryData(['property', newData.id], {
          ...previousProperty,
          ...newData,
        });
      }
      
      return { previousProperty };
    },
    onError: (_err, newData, context) => {
      if (context?.previousProperty) {
        queryClient.setQueryData(['property', newData.id], context.previousProperty);
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
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
      queryClient.invalidateQueries({ queryKey: ['unit-usage-count'] });
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
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      previousRate, 
      ...loan 
    }: Database['public']['Tables']['loans']['Update'] & { 
      id: string; 
      previousRate?: number | null 
    }) => {
      const { data, error } = await supabase
        .from('loans')
        .update(loan)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Check if rate changed
      if (loan.interest_rate_percent !== undefined && loan.interest_rate_percent !== previousRate) {
        ActivityLoggers.rateChanged(
          data.property_id,
          previousRate ?? null,
          Number(loan.interest_rate_percent),
          data.fixed_rate_expires || undefined
        );
      } else if (loan.current_mortgage_balance_gbp !== undefined) {
        ActivityLoggers.mortgageUpdated(
          data.property_id,
          data.lender,
          Number(loan.current_mortgage_balance_gbp)
        );
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
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
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      // Log activity
      ActivityLoggers.incomeUpdated(
        data.property_id, 
        data.year, 
        Number(data.annual_rent_gbp)
      );
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
      queryClient.invalidateQueries({ queryKey: ['property', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      // Calculate total from manual fields
      const total = [
        data.management_gbp_manual,
        data.bills_gbp_manual,
        data.insurance_gbp_manual,
        data.repairs_gbp_manual,
        data.compliance_gbp_manual,
        data.other_gbp_manual,
      ].reduce((sum, val) => sum + (val ? Number(val) : 0), 0);
      
      ActivityLoggers.costsUpdated(data.property_id, data.year, total);
    },
  });
}
