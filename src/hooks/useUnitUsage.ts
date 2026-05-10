import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';

/**
 * Counts total "units" (rooms) across all properties.
 * Each room = 1 unit. Whole-property lets auto-create a single "Whole Property" room.
 * This count is compared against the subscription tier's property/room limit.
 */
export function useUnitUsage() {
  const { propertyLimit } = useSubscription();

  const { data: totalUnits = 0, isLoading } = useQuery({
    queryKey: ['unit-usage-count'],
    queryFn: async () => {
      const { count, error } = await supabaseAny
        .from('rooms_v2')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count ?? 0;
    },
  });

  return {
    totalUnits,
    limit: propertyLimit,
    remaining: Math.max(0, propertyLimit - totalUnits),
    atLimit: totalUnits >= propertyLimit,
    isLoading,
  };
}
