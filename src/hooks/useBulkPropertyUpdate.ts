import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

interface BulkLoanUpdateParams {
  propertyIds: string[];
  interestRate?: number;
  fixedRateExpires?: string;
  lender?: string;
}

interface BulkPropertyUpdateParams {
  propertyIds: string[];
  lifecycleStage?: string;
  entityId?: string | null;
}

type BulkLoanUpdates = Pick<
  Database['public']['Tables']['loans']['Update'],
  'interest_rate_percent' | 'fixed_rate_expires' | 'lender'
>;

type BulkPropertyUpdates = Pick<
  Database['public']['Tables']['properties_v2']['Update'],
  'lifecycle_stage' | 'operational_date' | 'entity_id'
>;

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
      const updates: BulkLoanUpdates = {};
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
      queryClient.invalidateQueries({ queryKey: ['properties_v2'] });
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
      lifecycleStage, 
      entityId 
    }: BulkPropertyUpdateParams) => {
      const updates: BulkPropertyUpdates = {};
      
      if (lifecycleStage) {
        updates.lifecycle_stage = lifecycleStage;
        // Set operational date when transitioning to operational
        if (lifecycleStage === 'operational') {
          updates.operational_date = new Date().toISOString().split('T')[0];
        }
      }
      
      if (entityId !== undefined) {
        updates.entity_id = entityId;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No updates provided');
      }

      const { error, count } = await supabase
        .from('properties_v2')
        .update(updates)
        .in('id', propertyIds);

      if (error) throw error;

      return { updatedCount: count || propertyIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties_v2'] });
      toast.success(`Updated ${data.updatedCount} properties`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update properties');
    },
  });
}
