import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useEntityCommitments(entityId: string | undefined) {
  return useQuery({
    queryKey: ['entity-investor-commitments', entityId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('investor_commitment_detail')
        .select('*')
        .eq('entity_id', entityId!);
      if (error) throw error;
      return data;
    },
    enabled: !!entityId,
  });
}

export function useEntityDistributions(entityId: string | undefined) {
  return useQuery({
    queryKey: ['entity-investor-distributions', entityId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('investor_distributions')
        .select('*')
        .eq('entity_id', entityId!)
        .order('distribution_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!entityId,
  });
}
