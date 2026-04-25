import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';

interface DismissedDuplicate {
  id: string;
  org_id: string;
  property_id_1: string;
  property_id_2: string;
  dismissed_by: string;
  dismissed_at: string;
  reason: string | null;
}

export function useDismissedDuplicates() {
  return useQuery({
    queryKey: ['dismissed_duplicates'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('dismissed_duplicates')
        .select('*');

      if (error) throw error;
      return data as DismissedDuplicate[];
    },
  });
}

export function useDismissDuplicate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      propertyId1, 
      propertyId2, 
      reason 
    }: { 
      propertyId1: string; 
      propertyId2: string; 
      reason?: string;
    }) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');
      if (!user?.id) throw new Error('User not authenticated');

      // Sort IDs to ensure consistent ordering (avoids duplicate dismissals)
      const [sortedId1, sortedId2] = [propertyId1, propertyId2].sort();

      const { data, error } = await supabaseAny
        .from('dismissed_duplicates')
        .insert({
          org_id: orgId,
          property_id_1: sortedId1,
          property_id_2: sortedId2,
          dismissed_by: user.id,
          reason: reason || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dismissed_duplicates'] });
    },
  });
}

export function useUndismissDuplicate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ propertyId1, propertyId2 }: { propertyId1: string; propertyId2: string }) => {
      // Sort IDs to ensure consistent ordering
      const [sortedId1, sortedId2] = [propertyId1, propertyId2].sort();

      const { error } = await supabaseAny
        .from('dismissed_duplicates')
        .delete()
        .eq('property_id_1', sortedId1)
        .eq('property_id_2', sortedId2);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dismissed_duplicates'] });
    },
  });
}

// Helper to check if a pair of properties has been dismissed
export function isDuplicateDismissed(
  dismissedList: DismissedDuplicate[] | undefined,
  propertyId1: string,
  propertyId2: string
): boolean {
  if (!dismissedList) return false;
  
  const [sortedId1, sortedId2] = [propertyId1, propertyId2].sort();
  
  return dismissedList.some(
    d => d.property_id_1 === sortedId1 && d.property_id_2 === sortedId2
  );
}
