import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import type { Database } from '@/integrations/supabase/types';
import type { PropertyWithFinancials } from './useProperties';
import {
  computePropertyAttributable,
  calculatePortfolioAttributableMetrics,
} from '@/lib/beneficialGroups/attribution';
import type {
  BeneficialGroupWithMappings,
  MappingWithEntity,
  PropertyAttributableOwnership,
  PortfolioAttributableMetrics,
  PropertyLegalOwnerRow,
  EntityShareholdingRow,
  EffectiveOwnershipWithBenefit,
} from '@/lib/beneficialGroups/types';

type EntityBeneficialMappingInsert = Database['public']['Tables']['entity_beneficial_mapping']['Insert'];

// Re-export public types for backwards compatibility with existing imports.
export type {
  MappingWithEntity,
  BeneficialGroupWithMappings,
  EffectiveOwnershipWithBenefit,
  PropertyAttributableOwnership,
  PortfolioAttributableMetrics,
};
export { calculatePortfolioAttributableMetrics };

// ============================================
// BENEFICIAL GROUPS HOOKS
// ============================================

export function useBeneficialGroups() {
  return useQuery({
    queryKey: ['beneficial_groups'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('beneficial_groups')
        .select(`
          *,
          entity_beneficial_mapping(
            *,
            ownership_entities(id, name, entity_type)
          )
        `)
        .order('name');

      if (error) throw error;
      return data as BeneficialGroupWithMappings[];
    },
  });
}

export function useCreateBeneficialGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data: result, error } = await supabaseAny
        .from('beneficial_groups')
        .insert({ name: data.name, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficial_groups'] });
    },
  });
}

export function useDeleteBeneficialGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny
        .from('beneficial_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficial_groups'] });
    },
  });
}

// ============================================
// ENTITY MAPPING HOOKS
// ============================================

export function useEntityMappings(entityId: string | undefined) {
  return useQuery({
    queryKey: ['entity_mappings', entityId],
    queryFn: async () => {
      if (!entityId) return [];

      const { data, error } = await supabaseAny
        .from('entity_beneficial_mapping')
        .select(`
          *,
          beneficial_groups(id, name)
        `)
        .eq('entity_id', entityId);

      if (error) throw error;
      return data;
    },
    enabled: !!entityId,
  });
}

export function useAddEntityMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<EntityBeneficialMappingInsert, 'id' | 'created_at'>) => {
      const { data: result, error } = await supabaseAny
        .from('entity_beneficial_mapping')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficial_groups'] });
      queryClient.invalidateQueries({ queryKey: ['entity_mappings'] });
      queryClient.invalidateQueries({ queryKey: ['attributable_ownership'] });
    },
  });
}

export function useRemoveEntityMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny
        .from('entity_beneficial_mapping')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficial_groups'] });
      queryClient.invalidateQueries({ queryKey: ['entity_mappings'] });
      queryClient.invalidateQueries({ queryKey: ['attributable_ownership'] });
    },
  });
}

// ============================================
// PROPERTY BENEFICIAL OVERRIDE
// ============================================

export function useUpdatePropertyBeneficialOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, overridePercent, notes }: {
      propertyId: string;
      overridePercent: number | null;
      notes: string | null;
    }) => {
      const { error } = await supabaseAny
        .from('properties_v2')
        .update({
          beneficial_override_percent: overridePercent,
          beneficial_override_notes: notes,
        })
        .eq('id', propertyId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attributable_ownership', variables.propertyId] });
    },
  });
}

// ============================================
// ATTRIBUTABLE OWNERSHIP CALCULATION
// ============================================

export function usePropertyAttributableOwnership(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['attributable_ownership', propertyId],
    queryFn: async (): Promise<PropertyAttributableOwnership | null> => {
      if (!propertyId) return null;

      const { data: property, error: propError } = await supabaseAny
        .from('properties_v2')
        .select('id, beneficial_override_percent, beneficial_override_notes')
        .eq('id', propertyId)
        .single();
      if (propError) throw propError;

      const { data: legalOwners, error: legalError } = await supabaseAny
        .from('property_legal_ownership')
        .select(`*, ownership_entities(*)`)
        .eq('property_id', propertyId);
      if (legalError) throw legalError;

      const { data: allShareholdings, error: shError } = await supabaseAny
        .from('entity_shareholdings')
        .select(`*, shareholder_entity:ownership_entities!entity_shareholdings_shareholder_entity_id_fkey(*)`);
      if (shError) throw shError;

      const { data: groups, error: groupError } = await supabaseAny
        .from('beneficial_groups')
        .select(`*, entity_beneficial_mapping(entity_id)`);
      if (groupError) throw groupError;

      return computePropertyAttributable({
        propertyId,
        beneficialOverridePercent: property.beneficial_override_percent,
        legalOwners: (legalOwners || []) as PropertyLegalOwnerRow[],
        allShareholdings: (allShareholdings || []) as EntityShareholdingRow[],
        groups: (groups || []) as Array<{
          id: string;
          name: string;
          entity_beneficial_mapping: { entity_id: string }[] | null;
        }>,
      });
    },
    enabled: !!propertyId,
  });
}

// ============================================
// PORTFOLIO-LEVEL ATTRIBUTABLE METRICS
// ============================================

export function usePortfolioAttributableMetrics(properties: PropertyWithFinancials[] | undefined) {
  return useQuery({
    queryKey: ['portfolio_attributable_metrics', properties?.map(p => p.id).join(',')],
    queryFn: async () => {
      if (!properties || properties.length === 0) return null;
      return calculatePortfolioAttributableMetrics(properties);
    },
    enabled: !!properties && properties.length > 0,
  });
}

// ============================================
// SEED DEFAULT BENEFICIAL GROUP
// ============================================

// Note: Seeding is now done via SQL migration. This function is kept for reference
// but will not auto-seed to prevent duplicates.
export function useSeedDefaultBeneficialGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data: existing } = await supabaseAny
        .from('beneficial_groups')
        .select('id')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return existing;
      }

      const { data: group, error } = await supabaseAny
        .from('beneficial_groups')
        .insert({ name: 'Default Group', org_id: orgId })
        .select()
        .single();

      if (error) throw error;

      const { data: entities } = await supabaseAny
        .from('ownership_entities')
        .select('id, name')
        .in('name', ['David O\'Neill', 'Tenure IQ Ltd']);

      if (entities && entities.length > 0) {
        const mappings = entities.map(e => ({
          entity_id: e.id,
          beneficial_group_id: group.id,
        }));

        await supabase.from('entity_beneficial_mapping').insert(mappings);
      }

      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficial_groups'] });
    },
  });
}
