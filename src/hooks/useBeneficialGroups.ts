import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
import type { Database } from '@/integrations/supabase/types';
import type { PropertyWithFinancials } from './useProperties';

// Types from database
type BeneficialGroup = Database['public']['Tables']['beneficial_groups']['Row'];
type EntityBeneficialMapping = Database['public']['Tables']['entity_beneficial_mapping']['Row'];
type EntityBeneficialMappingInsert = Database['public']['Tables']['entity_beneficial_mapping']['Insert'];

export interface MappingWithEntity extends EntityBeneficialMapping {
  ownership_entities: {
    id: string;
    name: string;
    entity_type: string;
  };
}

export interface BeneficialGroupWithMappings extends BeneficialGroup {
  entity_beneficial_mapping: MappingWithEntity[];
}

export interface EffectiveOwnershipWithBenefit {
  entityId: string;
  entityName: string;
  entityType: string;
  effectivePercent: number;
  beneficialGroupId: string | null;
  beneficialGroupName: string | null;
  isAttributableToMe: boolean;
}

export interface PropertyAttributableOwnership {
  propertyId: string;
  grossPercent: number; // Always 100
  attributablePercent: number; // Sum of effective % for entities in primary beneficial group
  hasOverride: boolean;
  overridePercent: number | null;
  effectiveAttributablePercent: number; // Use override if set, else calculated
  effectiveOwnership: EffectiveOwnershipWithBenefit[];
  warnings: string[];
}

interface OwnershipEntitySummary {
  id: string;
  name: string;
  entity_type: string;
}

interface PropertyLegalOwnerRow {
  property_id: string;
  owner_percent: number | string;
  ownership_entities: OwnershipEntitySummary;
}

interface EntityShareholdingRow {
  parent_entity_id: string;
  shareholder_percent: number | string;
  shareholder_entity: OwnershipEntitySummary;
}

// getUserOrgId replaced by shared fetchUserOrgId

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

/**
 * Calculate attributable ownership for a single property
 */
export function usePropertyAttributableOwnership(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['attributable_ownership', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;

      // 1. Fetch property with override
      const { data: property, error: propError } = await supabaseAny
        .from('properties_v2')
        .select('id, beneficial_override_percent, beneficial_override_notes')
        .eq('id', propertyId)
        .single();

      if (propError) throw propError;

      // 2. Get legal owners
      const { data: legalOwners, error: legalError } = await supabaseAny
        .from('property_legal_ownership')
        .select(`*, ownership_entities(*)`)
        .eq('property_id', propertyId);

      if (legalError) throw legalError;

      // 3. Get all shareholdings
      const { data: allShareholdings, error: shError } = await supabaseAny
        .from('entity_shareholdings')
        .select(`*, shareholder_entity:ownership_entities!entity_shareholdings_shareholder_entity_id_fkey(*)`);

      if (shError) throw shError;

      // 4. Get beneficial groups with mappings
      const { data: groups, error: groupError } = await supabaseAny
        .from('beneficial_groups')
        .select(`*, entity_beneficial_mapping(entity_id)`);

      if (groupError) throw groupError;

      // Create entity-to-group mapping
      const entityToGroup = new Map<string, { groupId: string; groupName: string }>();
      groups?.forEach(group => {
        group.entity_beneficial_mapping?.forEach((mapping: { entity_id: string }) => {
          entityToGroup.set(mapping.entity_id, {
            groupId: group.id,
            groupName: group.name,
          });
        });
      });

      // Primary beneficial group (first one)
      const primaryGroup = groups?.[0];

      // 5. Calculate effective ownership
      const effectiveOwnership: Map<string, EffectiveOwnershipWithBenefit> = new Map();
      const warnings: string[] = [];
      const typedLegalOwners = (legalOwners || []) as PropertyLegalOwnerRow[];
      const typedShareholdings = (allShareholdings || []) as EntityShareholdingRow[];

      for (const legalOwner of typedLegalOwners) {
        const entity = legalOwner.ownership_entities;
        const legalPercent = Number(legalOwner.owner_percent);

        const isCompanyType = entity.entity_type === 'SPV' || entity.entity_type === 'Company';
        const entityShareholdings = typedShareholdings.filter(
          (shareholding) => shareholding.parent_entity_id === entity.id
        );

        if (isCompanyType && entityShareholdings.length > 0) {
          // Look through SPV
          for (const shareholding of entityShareholdings) {
            const shareholderPercent = Number(shareholding.shareholder_percent);
            const effectivePercent = (legalPercent / 100) * (shareholderPercent / 100) * 100;

            const shareholder = shareholding.shareholder_entity;
            const groupInfo = entityToGroup.get(shareholder.id);
            
            const existing = effectiveOwnership.get(shareholder.id);
            if (existing) {
              existing.effectivePercent += effectivePercent;
            } else {
              effectiveOwnership.set(shareholder.id, {
                entityId: shareholder.id,
                entityName: shareholder.name,
                entityType: shareholder.entity_type,
                effectivePercent,
                beneficialGroupId: groupInfo?.groupId || null,
                beneficialGroupName: groupInfo?.groupName || null,
                isAttributableToMe: groupInfo?.groupId === primaryGroup?.id,
              });
            }
          }
        } else if (isCompanyType && entityShareholdings.length === 0) {
          // SPV without shareholders - warning
          warnings.push(`Shareholders missing for SPV owner "${entity.name}" — attribution may be incomplete`);
          
          // Attribute directly to the SPV for now
          const groupInfo = entityToGroup.get(entity.id);
          const existing = effectiveOwnership.get(entity.id);
          if (existing) {
            existing.effectivePercent += legalPercent;
          } else {
            effectiveOwnership.set(entity.id, {
              entityId: entity.id,
              entityName: entity.name,
              entityType: entity.entity_type,
              effectivePercent: legalPercent,
              beneficialGroupId: groupInfo?.groupId || null,
              beneficialGroupName: groupInfo?.groupName || null,
              isAttributableToMe: groupInfo?.groupId === primaryGroup?.id,
            });
          }
        } else {
          // Direct owner (Person)
          const groupInfo = entityToGroup.get(entity.id);
          const existing = effectiveOwnership.get(entity.id);
          if (existing) {
            existing.effectivePercent += legalPercent;
          } else {
            effectiveOwnership.set(entity.id, {
              entityId: entity.id,
              entityName: entity.name,
              entityType: entity.entity_type,
              effectivePercent: legalPercent,
              beneficialGroupId: groupInfo?.groupId || null,
              beneficialGroupName: groupInfo?.groupName || null,
              isAttributableToMe: groupInfo?.groupId === primaryGroup?.id,
            });
          }
        }
      }

      // Calculate attributable percent
      const effectiveOwnershipArray = Array.from(effectiveOwnership.values())
        .sort((a, b) => b.effectivePercent - a.effectivePercent);

      const attributablePercent = effectiveOwnershipArray
        .filter(o => o.isAttributableToMe)
        .reduce((sum, o) => sum + o.effectivePercent, 0);

      const hasOverride = property.beneficial_override_percent !== null;
      const overridePercent = property.beneficial_override_percent 
        ? Number(property.beneficial_override_percent) 
        : null;

      return {
        propertyId,
        grossPercent: 100,
        attributablePercent,
        hasOverride,
        overridePercent,
        effectiveAttributablePercent: hasOverride ? (overridePercent || 0) : attributablePercent,
        effectiveOwnership: effectiveOwnershipArray,
        warnings,
      } as PropertyAttributableOwnership;
    },
    enabled: !!propertyId,
  });
}

// ============================================
// PORTFOLIO-LEVEL ATTRIBUTABLE CALCULATIONS
// ============================================

export interface PortfolioAttributableMetrics {
  // Gross (100%)
  gross: {
    totalValue: number;
    totalMortgage: number;
    totalEquity: number;
    totalNOI: number;
    totalCashflowAfterDebt: number;
  };
  // Attributable to primary beneficial group
  attributable: {
    totalValue: number;
    totalMortgage: number;
    totalEquity: number;
    totalNOI: number;
    totalCashflowAfterDebt: number;
    weightedOwnershipPercent: number; // Weighted by property value
  };
}

export async function calculatePortfolioAttributableMetrics(
  properties: PropertyWithFinancials[]
): Promise<PortfolioAttributableMetrics> {
  // Fetch all beneficial groups and mappings
  const { data: groups } = await supabaseAny
    .from('beneficial_groups')
    .select(`*, entity_beneficial_mapping(entity_id)`);

  // Fetch all legal ownership
  const { data: allLegalOwnership } = await supabaseAny
    .from('property_legal_ownership')
    .select(`*, ownership_entities(*)`);

  // Fetch all shareholdings
  const { data: allShareholdings } = await supabaseAny
    .from('entity_shareholdings')
    .select(`*, shareholder_entity:ownership_entities!entity_shareholdings_shareholder_entity_id_fkey(*)`);

  // Create entity-to-group mapping
  const entityToGroup = new Map<string, string>();
  const primaryGroup = groups?.[0];
  groups?.forEach(group => {
    group.entity_beneficial_mapping?.forEach((mapping: { entity_id: string }) => {
      entityToGroup.set(mapping.entity_id, group.id);
    });
  });

  // Build property ownership lookup
  const propertyOwnership = new Map<string, typeof allLegalOwnership>();
  allLegalOwnership?.forEach(lo => {
    const existing = propertyOwnership.get(lo.property_id) || [];
    existing.push(lo);
    propertyOwnership.set(lo.property_id, existing);
  });

  const currentYear = new Date().getFullYear();

  let grossValue = 0;
  let grossMortgage = 0;
  let grossNOI = 0;
  let grossCashflow = 0;

  let attrValue = 0;
  let attrMortgage = 0;
  let attrNOI = 0;
  let attrCashflow = 0;
  let weightedAttrSum = 0;
  const typedShareholdings = (allShareholdings || []) as EntityShareholdingRow[];

  for (const property of properties) {
    const value = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
    const loan = property.loans?.[0];
    const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
    const income = property.income?.find(i => i.year === currentYear);
    const costs = property.costs?.find(c => c.year === currentYear);
    const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : 0;
    
    // Simple cost calculation
    const totalCosts = [
      costs?.management_gbp_manual,
      costs?.repairs_gbp_manual,
      costs?.insurance_gbp_manual,
      costs?.bills_gbp_manual,
      costs?.compliance_gbp_manual,
      costs?.other_gbp_manual,
    ].reduce((sum, c) => sum + (c ? Number(c) : 0), 0);
    
    const noi = rent - totalCosts;
    
    // Monthly mortgage payment calculation (simplified)
    let monthlyPayment = 0;
    if (loan?.payment_override_gbp) {
      monthlyPayment = Number(loan.payment_override_gbp);
    } else if (mortgage && loan?.interest_rate_percent) {
      const rate = Number(loan.interest_rate_percent) / 100 / 12;
      monthlyPayment = mortgage * rate;
    }
    const annualDebt = monthlyPayment * 12;
    const cashflow = noi - annualDebt;

    // Add to gross
    grossValue += value;
    grossMortgage += mortgage;
    grossNOI += noi;
    grossCashflow += cashflow;

    // Calculate attributable percent for this property
    let attributablePercent = 0;

    // Check for override
    const overridePercent = property.beneficial_override_percent 
      ? Number(property.beneficial_override_percent) 
      : null;

    if (overridePercent !== null) {
      attributablePercent = overridePercent;
    } else {
      // Calculate from ownership structure
      const legalOwners = propertyOwnership.get(property.id) || [];

      for (const legalOwner of legalOwners) {
        const entity = legalOwner.ownership_entities;
        const legalPercent = Number(legalOwner.owner_percent);
        const isCompanyType = entity.entity_type === 'SPV' || entity.entity_type === 'Company';
        
        const entityShareholdings = typedShareholdings.filter(
          (shareholding) => shareholding.parent_entity_id === entity.id
        );

        if (isCompanyType && entityShareholdings.length > 0) {
          for (const sh of entityShareholdings) {
            const shareholder = sh.shareholder_entity;
            const shareholderPercent = Number(sh.shareholder_percent);
            const effectivePercent = (legalPercent / 100) * (shareholderPercent / 100) * 100;
            
            if (entityToGroup.get(shareholder.id) === primaryGroup?.id) {
              attributablePercent += effectivePercent;
            }
          }
        } else {
          if (entityToGroup.get(entity.id) === primaryGroup?.id) {
            attributablePercent += legalPercent;
          }
        }
      }
    }

    const attrFactor = attributablePercent / 100;
    attrValue += value * attrFactor;
    attrMortgage += mortgage * attrFactor;
    attrNOI += noi * attrFactor;
    attrCashflow += cashflow * attrFactor;
    weightedAttrSum += value * attributablePercent;
  }

  const weightedOwnershipPercent = grossValue > 0 
    ? weightedAttrSum / grossValue 
    : 0;

  return {
    gross: {
      totalValue: grossValue,
      totalMortgage: grossMortgage,
      totalEquity: grossValue - grossMortgage,
      totalNOI: grossNOI,
      totalCashflowAfterDebt: grossCashflow,
    },
    attributable: {
      totalValue: attrValue,
      totalMortgage: attrMortgage,
      totalEquity: attrValue - attrMortgage,
      totalNOI: attrNOI,
      totalCashflowAfterDebt: attrCashflow,
      weightedOwnershipPercent,
    },
  };
}

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

      // Check if ANY group already exists for this org (not just by name)
      const { data: existing } = await supabaseAny
        .from('beneficial_groups')
        .select('id')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Already have a group, don't create duplicates
        return existing;
      }

      // Create the default group
      const { data: group, error } = await supabaseAny
        .from('beneficial_groups')
        .insert({ name: 'Default Group', org_id: orgId })
        .select()
        .single();

      if (error) throw error;

      // Find "David O'Neill" and "Tenure IQ Ltd" entities
      const { data: entities } = await supabaseAny
        .from('ownership_entities')
        .select('id, name')
        .in('name', ['David O\'Neill', 'Tenure IQ Ltd']);

      // Map them to the group
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
