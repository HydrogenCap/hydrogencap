import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkLoanUpdateParams {
  propertyIds: string[];
  interestRate?: number;
  fixedRateExpires?: string;
  lender?: string;
}

interface BulkPropertyUpdateParams {
  propertyIds: string[];
  lifecycleType?: 'development' | 'core_rental';
  legalOwnerCompanyId?: string | null;
}

export function useBulkLoanUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      propertyIds, 
      interestRate, 
      fixedRateExpires, 
      lender 
    }: BulkLoanUpdateParams) => {
      // Build update object with only provided fields
      const updates: Record<string, any> = {};
      if (interestRate !== undefined) updates.interest_rate_percent = interestRate;
      if (fixedRateExpires !== undefined) updates.fixed_rate_expires = fixedRateExpires || null;
      if (lender !== undefined) updates.lender = lender || null;

      if (Object.keys(updates).length === 0) {
        throw new Error('No updates provided');
      }

      // Update all loans for selected properties
      const { error, count } = await supabase
        .from('loans')
        .update(updates)
        .in('property_id', propertyIds);

      if (error) throw error;

      return { updatedCount: count || propertyIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(`Updated loans for ${data.updatedCount} properties`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update loans');
    },
  });
}

export function useBulkPropertyUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      propertyIds, 
      lifecycleType, 
      legalOwnerCompanyId 
    }: BulkPropertyUpdateParams) => {
      const updates: Record<string, any> = {};
      
      if (lifecycleType) {
        updates.lifecycle_type = lifecycleType;
        // Set operational date when transitioning to core_rental
        if (lifecycleType === 'core_rental') {
          updates.operational_date = new Date().toISOString().split('T')[0];
        }
      }
      
      if (legalOwnerCompanyId !== undefined) {
        updates.legal_owner_company_id = legalOwnerCompanyId;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No updates provided');
      }

      const { error, count } = await supabase
        .from('properties')
        .update(updates)
        .in('id', propertyIds);

      if (error) throw error;

      return { updatedCount: count || propertyIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(`Updated ${data.updatedCount} properties`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update properties');
    },
  });
}
