import { useMemo } from 'react';
import { useOwnershipData } from './useOwnershipData';
import {
  getDirectOwnership,
  getGroupParentOwnership,
  resolveEffectiveOwnership,
  mergeEffectiveOwnership,
  type EffectiveOwnership,
} from '@/lib/ownershipEngine';

// ─── Types ───────────────────────────────────────────────────────────────

export interface PropertyAttributionV2 {
  propertyId: string;
  propertyAddress: string;
  entityId: string;
  entityName: string;
  groupOwnershipPercent: number;
  effectiveOwners: EffectiveOwnership[];
}

export interface PortfolioOwnerV2 {
  ownerName: string;
  ownerEntityId: string | null;
  ownerType: string;
  properties: {
    propertyId: string;
    propertyAddress: string;
    effectivePercent: number;
  }[];
  totalEffectiveProperties: number;
}

// ─── Hooks ───────────────────────────────────────────────────────────────

/**
 * Get ownership attribution for a single entity at a given date.
 */
export function usePropertyOwnershipV2(
  entityId: string | undefined,
  atDate?: Date
) {
  const { data: ownershipData, isLoading } = useOwnershipData();
  const effectiveDate = useMemo(() => atDate || new Date(), [atDate]);

  const result = useMemo(() => {
    if (!ownershipData || !entityId) return null;

    const { entities, shareClasses, shareholders } = ownershipData;

    const directOwners = getDirectOwnership(entityId, shareClasses, shareholders, effectiveDate);

    const effectiveOwners = mergeEffectiveOwnership(
      resolveEffectiveOwnership(
        entityId, 100, [],
        entities, shareClasses, shareholders,
        effectiveDate
      )
    );

    const groupOwnership = getGroupParentOwnership(
      entityId, entities, shareClasses, shareholders, effectiveDate
    );

    return {
      directOwners,
      effectiveOwners,
      groupOwnership,
    };
  }, [ownershipData, entityId, effectiveDate]);

  return { data: result, isLoading };
}

/**
 * Get portfolio-wide ownership attribution at a given date.
 */
export function usePortfolioOwnershipV2(
  properties: Array<{
    id: string;
    address_line_1: string;
    city: string;
    entity_id: string;
  }> | undefined,
  atDate?: Date
) {
  const { data: ownershipData, isLoading } = useOwnershipData();
  const effectiveDate = useMemo(() => atDate || new Date(), [atDate]);

  const result = useMemo(() => {
    if (!ownershipData || !properties?.length) return null;

    const { entities, shareClasses, shareholders } = ownershipData;

    const propertyAttributions: PropertyAttributionV2[] = properties.map(prop => {
      const entity = entities.find(e => e.id === prop.entity_id);
      const groupOwnership = getGroupParentOwnership(
        prop.entity_id, entities, shareClasses, shareholders, effectiveDate
      );
      const effectiveOwners = mergeEffectiveOwnership(
        resolveEffectiveOwnership(
          prop.entity_id, 100, [],
          entities, shareClasses, shareholders,
          effectiveDate
        )
      );

      return {
        propertyId: prop.id,
        propertyAddress: `${prop.address_line_1}, ${prop.city}`,
        entityId: prop.entity_id,
        entityName: entity?.entity_name || 'Unknown',
        groupOwnershipPercent: groupOwnership.ownershipPercent,
        effectiveOwners,
      };
    });

    const ownerMap = new Map<string, PortfolioOwnerV2>();

    for (const pa of propertyAttributions) {
      for (const eo of pa.effectiveOwners) {
        const key = eo.ultimateOwnerEntityId || eo.ultimateOwnerName;
        const existing = ownerMap.get(key);
        if (existing) {
          existing.properties.push({
            propertyId: pa.propertyId,
            propertyAddress: pa.propertyAddress,
            effectivePercent: eo.effectivePercent,
          });
          existing.totalEffectiveProperties = existing.properties.length;
        } else {
          ownerMap.set(key, {
            ownerName: eo.ultimateOwnerName,
            ownerEntityId: eo.ultimateOwnerEntityId,
            ownerType: eo.ultimateOwnerType,
            properties: [{
              propertyId: pa.propertyId,
              propertyAddress: pa.propertyAddress,
              effectivePercent: eo.effectivePercent,
            }],
            totalEffectiveProperties: 1,
          });
        }
      }
    }

    const groupParent = entities.find(e => e.is_group_parent);

    return {
      propertyAttributions,
      portfolioOwners: Array.from(ownerMap.values())
        .sort((a, b) => b.properties.length - a.properties.length),
      groupParent: groupParent ? {
        entityId: groupParent.id,
        entityName: groupParent.entity_name,
      } : null,
    };
  }, [ownershipData, properties, effectiveDate]);

  return { data: result, isLoading };
}
