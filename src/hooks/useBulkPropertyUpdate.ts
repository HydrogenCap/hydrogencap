import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { throwV1Frozen } from '@/lib/v1Frozen';

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

type BulkPropertyUpdates = Pick<
  Database['public']['Tables']['properties_v2']['Update'],
  'lifecycle_stage' | 'operational_date' | 'entity_id'
>;

/**
 * @deprecated V1 `loans` table is frozen (Prompt #45). Bulk loan updates must
 * go through V2 `loan_facilities` (no current call sites). Kept as a stub that
 * throws to preserve the export shape during the transition.
 */
export function useBulkLoanUpdate() {
  return useMutation({
    mutationFn: async (_params: BulkLoanUpdateParams) => {
      throwV1Frozen('loans', 'useBulkLoanUpdate');
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

      const { error, count } = await supabaseAny
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
