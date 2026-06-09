/**
 * Bulk entity health — computes R/A/G + issues for every legal entity in the org.
 *
 * Reuses existing list-level hooks so the cost is the same as the Entities page
 * load (entities, verifications, properties_v2, loans, shareholders).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useLegalEntities, type EntityShareholder } from '@/hooks/useLegalEntities';
import { useEntityVerificationStatus } from '@/hooks/useCompaniesHouseV2';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { useAllLoanFacilities } from '@/hooks/useLoanFacilities';
import { computeEntityHealth, type EntityHealth } from '@/lib/entityHealth';

function useAllShareholders() {
  const { data: org } = useOrganization();
  return useQuery({
    queryKey: ['entity_shareholders_all', org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data: entityIds } = await supabaseAny
        .from('legal_entities')
        .select('id')
        .eq('org_id', org!.id);
      const ids = (entityIds || []).map((e: { id: string }) => e.id);
      if (ids.length === 0) return [] as EntityShareholder[];
      const { data, error } = await supabaseAny
        .from('entity_shareholders')
        .select('id, entity_id, shareholder_name, share_class, shares_held, percentage, effective_date, effective_to, shareholder_entity_id, shareholder_type, created_at, updated_at')
        .in('entity_id', ids)
        .is('effective_to', null);
      if (error) throw error;
      return (data || []) as EntityShareholder[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface EntityHealthRecord extends EntityHealth {
  entityId: string;
  entityName: string;
  entityType: string;
}

export function useEntityHealthMap() {
  const { data: entities, isLoading: l1 } = useLegalEntities();
  const { data: verifications, isLoading: l2 } = useEntityVerificationStatus();
  const { data: properties, isLoading: l3 } = usePropertiesV2();
  const { data: loans, isLoading: l4 } = useAllLoanFacilities();
  const { data: shareholders, isLoading: l5 } = useAllShareholders();

  const isLoading = l1 || l2 || l3 || l4 || l5;

  const map = useMemo(() => {
    const result = new Map<string, EntityHealthRecord>();
    if (!entities) return result;

    const verByEntity = new Map<string, ReturnType<typeof Object> extends never ? never : NonNullable<typeof verifications>[number]>();
    (verifications || []).forEach(v => verByEntity.set(v.entity_id, v));

    const propsByEntity = new Map<string, NonNullable<typeof properties>>();
    (properties || []).forEach(p => {
      const arr = propsByEntity.get(p.entity_id) || [];
      arr.push(p);
      propsByEntity.set(p.entity_id, arr);
    });

    const loansByProp = new Map<string, { hasActiveLoan: boolean }>();
    (loans || []).forEach(l => {
      if (['active', 'drawdown', 'pending_drawdown'].includes(l.status)) {
        loansByProp.set(l.property_id, { hasActiveLoan: true });
      }
    });

    const shByEntity = new Map<string, EntityShareholder[]>();
    (shareholders || []).forEach(s => {
      const arr = shByEntity.get(s.entity_id) || [];
      arr.push(s);
      shByEntity.set(s.entity_id, arr);
    });

    for (const e of entities) {
      const health = computeEntityHealth({
        entity: e,
        verification: verByEntity.get(e.id) ?? null,
        shareholders: shByEntity.get(e.id) || [],
        entityProperties: propsByEntity.get(e.id) || [],
        loansByProperty: loansByProp,
      });
      result.set(e.id, {
        ...health,
        entityId: e.id,
        entityName: e.entity_name,
        entityType: e.entity_type,
      });
    }

    return result;
  }, [entities, verifications, properties, loans, shareholders]);

  return { map, isLoading };
}
