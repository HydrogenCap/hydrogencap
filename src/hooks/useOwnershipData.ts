import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import type { EntityData, ShareClassData, ShareholderData } from '@/lib/ownershipEngine';

export interface OwnershipDataBundle {
  entities: EntityData[];
  shareClasses: ShareClassData[];
  shareholders: ShareholderData[];
}

/**
 * Fetches all ownership data for the current org in a single batch.
 * This data is passed to pure ownershipEngine functions.
 */
export function useOwnershipData() {
  const { data: org } = useOrganization();

  return useQuery<OwnershipDataBundle>({
    queryKey: ['ownership_data_v2', org?.id],
    queryFn: async () => {
      if (!org?.id) throw new Error('No org');

      // First get entity IDs for org
      const { data: entityIds, error: eidError } = await supabase
        .from('legal_entities')
        .select('id')
        .eq('org_id', org.id);
      if (eidError) throw eidError;
      const ids = (entityIds || []).map(e => e.id);

      // Fetch all three in parallel
      const [entitiesRes, classesRes, shareholdersRes] = await Promise.all([
        supabase
          .from('legal_entities')
          .select('id, entity_name, is_group_parent')
          .eq('org_id', org.id),
        ids.length > 0
          ? supabase
              .from('share_classes_v2')
              .select('id, entity_id, class_name, issued_shares')
              .in('entity_id', ids)
          : Promise.resolve({ data: [], error: null }),
        ids.length > 0
          ? supabase
              .from('entity_shareholders')
              .select('id, entity_id, shareholder_name, shareholder_entity_id, shareholder_type, share_class_id, shares_held, percentage, effective_date, effective_to')
              .in('entity_id', ids)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (entitiesRes.error) throw entitiesRes.error;
      if (classesRes.error) throw classesRes.error;
      if (shareholdersRes.error) throw shareholdersRes.error;

      return {
        entities: (entitiesRes.data || []) as EntityData[],
        shareClasses: (classesRes.data || []) as ShareClassData[],
        shareholders: (shareholdersRes.data || []) as ShareholderData[],
      };
    },
    enabled: !!org?.id,
    staleTime: 1000 * 60 * 5,
  });
}
