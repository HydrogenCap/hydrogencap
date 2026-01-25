import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Types from the database
type OwnershipEntity = Database['public']['Tables']['ownership_entities']['Row'];
type OwnershipEntityInsert = Database['public']['Tables']['ownership_entities']['Insert'];
type PropertyLegalOwnership = Database['public']['Tables']['property_legal_ownership']['Row'];
type PropertyLegalOwnershipInsert = Database['public']['Tables']['property_legal_ownership']['Insert'];
type EntityShareholding = Database['public']['Tables']['entity_shareholdings']['Row'];
type EntityShareholdingInsert = Database['public']['Tables']['entity_shareholdings']['Insert'];

// Extended types with related data
export interface LegalOwnershipWithEntity extends PropertyLegalOwnership {
  ownership_entities: OwnershipEntity;
}

export interface ShareholdingWithEntity extends EntityShareholding {
  shareholder_entity: OwnershipEntity;
}

export interface EffectiveOwnership {
  entityId: string;
  entityName: string;
  entityType: string;
  effectivePercent: number;
}

// Get user's org ID
async function getUserOrgId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  
  if (error || !data) return null;
  return data.org_id;
}

// ============================================
// ENTITY HOOKS
// ============================================

export function useOwnershipEntities() {
  return useQuery({
    queryKey: ['ownership_entities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ownership_entities')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as OwnershipEntity[];
    },
  });
}

export function useCreateEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entity: Omit<OwnershipEntityInsert, 'org_id'>) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('ownership_entities')
        .insert({ ...entity, org_id: orgId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership_entities'] });
    },
  });
}

export function useUpdateEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...entity }: Partial<OwnershipEntity> & { id: string }) => {
      const { data, error } = await supabase
        .from('ownership_entities')
        .update(entity)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership_entities'] });
    },
  });
}

export function useDeleteEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ownership_entities')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership_entities'] });
    },
  });
}

// ============================================
// LEGAL OWNERSHIP HOOKS (Property → Entity)
// ============================================

export function useLegalOwnership(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['legal_ownership', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabase
        .from('property_legal_ownership')
        .select(`
          *,
          ownership_entities(*)
        `)
        .eq('property_id', propertyId)
        .order('owner_percent', { ascending: false });

      if (error) throw error;
      return data as LegalOwnershipWithEntity[];
    },
    enabled: !!propertyId,
  });
}

export function useAddLegalOwnership() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ownership: PropertyLegalOwnershipInsert) => {
      const { data, error } = await supabase
        .from('property_legal_ownership')
        .insert(ownership)
        .select(`
          *,
          ownership_entities(*)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['legal_ownership', data.property_id] });
      queryClient.invalidateQueries({ queryKey: ['effective_ownership', data.property_id] });
    },
  });
}

export function useUpdateLegalOwnership() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, propertyId, ...ownership }: Partial<PropertyLegalOwnership> & { id: string; propertyId: string }) => {
      const { data, error } = await supabase
        .from('property_legal_ownership')
        .update(ownership)
        .eq('id', id)
        .select(`
          *,
          ownership_entities(*)
        `)
        .single();

      if (error) throw error;
      return { ...data, propertyId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['legal_ownership', data.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['effective_ownership', data.propertyId] });
    },
  });
}

export function useDeleteLegalOwnership() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabase
        .from('property_legal_ownership')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { propertyId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['legal_ownership', data.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['effective_ownership', data.propertyId] });
    },
  });
}

// ============================================
// SHAREHOLDING HOOKS (Entity → Entity)
// ============================================

export function useEntityShareholdings(entityId: string | undefined) {
  return useQuery({
    queryKey: ['entity_shareholdings', entityId],
    queryFn: async () => {
      if (!entityId) return [];
      
      const { data, error } = await supabase
        .from('entity_shareholdings')
        .select(`
          *,
          shareholder_entity:ownership_entities!entity_shareholdings_shareholder_entity_id_fkey(*)
        `)
        .eq('parent_entity_id', entityId)
        .order('shareholder_percent', { ascending: false });

      if (error) throw error;
      return data as ShareholdingWithEntity[];
    },
    enabled: !!entityId,
  });
}

export function useAddShareholding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (shareholding: EntityShareholdingInsert) => {
      const { data, error } = await supabase
        .from('entity_shareholdings')
        .insert(shareholding)
        .select(`
          *,
          shareholder_entity:ownership_entities!entity_shareholdings_shareholder_entity_id_fkey(*)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entity_shareholdings', data.parent_entity_id] });
      // Invalidate effective ownership for all properties (shareholders may affect multiple)
      queryClient.invalidateQueries({ queryKey: ['effective_ownership'] });
    },
  });
}

export function useUpdateShareholding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, parentEntityId, ...shareholding }: Partial<EntityShareholding> & { id: string; parentEntityId: string }) => {
      const { data, error } = await supabase
        .from('entity_shareholdings')
        .update(shareholding)
        .eq('id', id)
        .select(`
          *,
          shareholder_entity:ownership_entities!entity_shareholdings_shareholder_entity_id_fkey(*)
        `)
        .single();

      if (error) throw error;
      return { ...data, parentEntityId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entity_shareholdings', data.parentEntityId] });
      queryClient.invalidateQueries({ queryKey: ['effective_ownership'] });
    },
  });
}

export function useDeleteShareholding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, parentEntityId }: { id: string; parentEntityId: string }) => {
      const { error } = await supabase
        .from('entity_shareholdings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { parentEntityId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entity_shareholdings', data.parentEntityId] });
      queryClient.invalidateQueries({ queryKey: ['effective_ownership'] });
    },
  });
}

// ============================================
// EFFECTIVE OWNERSHIP CALCULATION
// ============================================

/**
 * Calculate effective (look-through) ownership for a property
 * This computes the ultimate beneficial ownership by looking through SPVs
 */
export function useEffectiveOwnership(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['effective_ownership', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      // 1. Get legal owners of the property
      const { data: legalOwners, error: legalError } = await supabase
        .from('property_legal_ownership')
        .select(`
          *,
          ownership_entities(*)
        `)
        .eq('property_id', propertyId);

      if (legalError) throw legalError;
      if (!legalOwners?.length) return [];

      // 2. Get all shareholdings (we'll need these for look-through)
      const { data: allShareholdings, error: shareholdingError } = await supabase
        .from('entity_shareholdings')
        .select(`
          *,
          shareholder_entity:ownership_entities!entity_shareholdings_shareholder_entity_id_fkey(*)
        `);

      if (shareholdingError) throw shareholdingError;

      // 3. Calculate effective ownership
      const effectiveOwnership: Map<string, EffectiveOwnership> = new Map();

      for (const legalOwner of legalOwners as LegalOwnershipWithEntity[]) {
        const entity = legalOwner.ownership_entities;
        const legalPercent = Number(legalOwner.owner_percent);

        // Check if this entity is an SPV/Company that has shareholders
        const isCompanyType = entity.entity_type === 'SPV' || entity.entity_type === 'Company';
        const entityShareholdings = (allShareholdings as ShareholdingWithEntity[])?.filter(
          s => s.parent_entity_id === entity.id
        ) || [];

        if (isCompanyType && entityShareholdings.length > 0) {
          // Look through the SPV to its shareholders
          for (const shareholding of entityShareholdings) {
            const shareholderPercent = Number(shareholding.shareholder_percent);
            const effectivePercent = (legalPercent / 100) * (shareholderPercent / 100) * 100;
            
            const shareholder = shareholding.shareholder_entity;
            const existingEntry = effectiveOwnership.get(shareholder.id);
            
            if (existingEntry) {
              existingEntry.effectivePercent += effectivePercent;
            } else {
              effectiveOwnership.set(shareholder.id, {
                entityId: shareholder.id,
                entityName: shareholder.name,
                entityType: shareholder.entity_type,
                effectivePercent,
              });
            }
          }
        } else {
          // Direct owner (Person or company without recorded shareholders)
          const existingEntry = effectiveOwnership.get(entity.id);
          
          if (existingEntry) {
            existingEntry.effectivePercent += legalPercent;
          } else {
            effectiveOwnership.set(entity.id, {
              entityId: entity.id,
              entityName: entity.name,
              entityType: entity.entity_type,
              effectivePercent: legalPercent,
            });
          }
        }
      }

      // Sort by effective percent descending
      return Array.from(effectiveOwnership.values())
        .sort((a, b) => b.effectivePercent - a.effectivePercent);
    },
    enabled: !!propertyId,
  });
}

/**
 * Calculate total ownership percentage sum for validation
 */
export function calculateOwnershipSum(items: Array<{ owner_percent?: number | null; shareholder_percent?: number | null }>): number {
  return items.reduce((sum, item) => {
    const percent = item.owner_percent ?? item.shareholder_percent ?? 0;
    return sum + Number(percent);
  }, 0);
}

/**
 * Check if ownership sums to 100% (with tolerance)
 */
export function validateOwnershipSum(sum: number, tolerance: number = 0.01): boolean {
  return Math.abs(sum - 100) <= tolerance;
}