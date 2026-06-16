/**
 * Beneficial groups — shared types.
 */
import type { Database } from '@/integrations/supabase/types';

type BeneficialGroup = Database['public']['Tables']['beneficial_groups']['Row'];
type EntityBeneficialMapping = Database['public']['Tables']['entity_beneficial_mapping']['Row'];

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
  grossPercent: number;
  attributablePercent: number;
  hasOverride: boolean;
  overridePercent: number | null;
  effectiveAttributablePercent: number;
  effectiveOwnership: EffectiveOwnershipWithBenefit[];
  warnings: string[];
}

export interface OwnershipEntitySummary {
  id: string;
  name: string;
  entity_type: string;
}

export interface PropertyLegalOwnerRow {
  property_id: string;
  owner_percent: number | string;
  ownership_entities: OwnershipEntitySummary;
}

export interface EntityShareholdingRow {
  parent_entity_id: string;
  shareholder_percent: number | string;
  shareholder_entity: OwnershipEntitySummary;
}

export interface PortfolioAttributableMetrics {
  gross: {
    totalValue: number;
    totalMortgage: number;
    totalEquity: number;
    totalNOI: number;
    totalCashflowAfterDebt: number;
  };
  attributable: {
    totalValue: number;
    totalMortgage: number;
    totalEquity: number;
    totalNOI: number;
    totalCashflowAfterDebt: number;
    weightedOwnershipPercent: number;
  };
}
