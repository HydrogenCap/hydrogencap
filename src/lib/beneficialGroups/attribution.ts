/**
 * Beneficial groups — pure attribution calculations (no React, no DB).
 */
import { supabaseAny } from '@/integrations/supabase/client';
import type { PropertyWithFinancials } from '@/hooks/useProperties';
import type {
  EffectiveOwnershipWithBenefit,
  PropertyAttributableOwnership,
  PropertyLegalOwnerRow,
  EntityShareholdingRow,
  PortfolioAttributableMetrics,
} from './types';

interface GroupWithMappingIds {
  id: string;
  name: string;
  entity_beneficial_mapping: { entity_id: string }[] | null;
}

/**
 * Compute attributable ownership for a single property from pre-fetched inputs.
 */
export function computePropertyAttributable(args: {
  propertyId: string;
  beneficialOverridePercent: number | string | null;
  legalOwners: PropertyLegalOwnerRow[];
  allShareholdings: EntityShareholdingRow[];
  groups: GroupWithMappingIds[];
}): PropertyAttributableOwnership {
  const { propertyId, beneficialOverridePercent, legalOwners, allShareholdings, groups } = args;

  const entityToGroup = new Map<string, { groupId: string; groupName: string }>();
  groups.forEach(group => {
    group.entity_beneficial_mapping?.forEach(mapping => {
      entityToGroup.set(mapping.entity_id, { groupId: group.id, groupName: group.name });
    });
  });

  const primaryGroup = groups[0];
  const effectiveOwnership = new Map<string, EffectiveOwnershipWithBenefit>();
  const warnings: string[] = [];

  for (const legalOwner of legalOwners) {
    const entity = legalOwner.ownership_entities;
    const legalPercent = Number(legalOwner.owner_percent);

    const isCompanyType = entity.entity_type === 'SPV' || entity.entity_type === 'Company';
    const entityShareholdings = allShareholdings.filter(s => s.parent_entity_id === entity.id);

    if (isCompanyType && entityShareholdings.length > 0) {
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
      warnings.push(`Shareholders missing for SPV owner "${entity.name}" — attribution may be incomplete`);

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

  const effectiveOwnershipArray = Array.from(effectiveOwnership.values())
    .sort((a, b) => b.effectivePercent - a.effectivePercent);

  const attributablePercent = effectiveOwnershipArray
    .filter(o => o.isAttributableToMe)
    .reduce((sum, o) => sum + o.effectivePercent, 0);

  const hasOverride = beneficialOverridePercent !== null;
  const overridePercent = beneficialOverridePercent ? Number(beneficialOverridePercent) : null;

  return {
    propertyId,
    grossPercent: 100,
    attributablePercent,
    hasOverride,
    overridePercent,
    effectiveAttributablePercent: hasOverride ? (overridePercent || 0) : attributablePercent,
    effectiveOwnership: effectiveOwnershipArray,
    warnings,
  };
}

/**
 * Portfolio-level attributable metrics. Pulls reference data from supabase then
 * walks each property to compute gross + attributable rollups.
 */
export async function calculatePortfolioAttributableMetrics(
  properties: PropertyWithFinancials[]
): Promise<PortfolioAttributableMetrics> {
  const { data: groups } = await supabaseAny
    .from('beneficial_groups')
    .select(`*, entity_beneficial_mapping(entity_id)`);

  const { data: allLegalOwnership } = await supabaseAny
    .from('property_legal_ownership')
    .select(`*, ownership_entities(*)`);

  const { data: allShareholdings } = await supabaseAny
    .from('entity_shareholdings')
    .select(`*, shareholder_entity:ownership_entities!entity_shareholdings_shareholder_entity_id_fkey(*)`);

  const entityToGroup = new Map<string, string>();
  const primaryGroup = groups?.[0];
  groups?.forEach(group => {
    group.entity_beneficial_mapping?.forEach((mapping: { entity_id: string }) => {
      entityToGroup.set(mapping.entity_id, group.id);
    });
  });

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

    const totalCosts = [
      costs?.management_gbp_manual,
      costs?.repairs_gbp_manual,
      costs?.insurance_gbp_manual,
      costs?.bills_gbp_manual,
      costs?.compliance_gbp_manual,
      costs?.other_gbp_manual,
    ].reduce((sum, c) => sum + (c ? Number(c) : 0), 0);

    const noi = rent - totalCosts;

    let monthlyPayment = 0;
    if (loan?.payment_override_gbp) {
      monthlyPayment = Number(loan.payment_override_gbp);
    } else if (mortgage && loan?.interest_rate_percent) {
      const rate = Number(loan.interest_rate_percent) / 100 / 12;
      monthlyPayment = mortgage * rate;
    }
    const annualDebt = monthlyPayment * 12;
    const cashflow = noi - annualDebt;

    grossValue += value;
    grossMortgage += mortgage;
    grossNOI += noi;
    grossCashflow += cashflow;

    let attributablePercent = 0;

    const overridePercent = property.beneficial_override_percent
      ? Number(property.beneficial_override_percent)
      : null;

    if (overridePercent !== null) {
      attributablePercent = overridePercent;
    } else {
      const legalOwners = propertyOwnership.get(property.id) || [];

      for (const legalOwner of legalOwners) {
        const entity = legalOwner.ownership_entities;
        const legalPercent = Number(legalOwner.owner_percent);
        const isCompanyType = entity.entity_type === 'SPV' || entity.entity_type === 'Company';

        const entityShareholdings = typedShareholdings.filter(s => s.parent_entity_id === entity.id);

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
