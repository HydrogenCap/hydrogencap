/**
 * V2 Ownership Engine — Pure Calculation Functions
 *
 * Architecture:
 *   properties_v2.entity_id → legal_entities
 *     → share_classes_v2 (issued_shares per class)
 *       → entity_shareholders (shares_held per holder, with date ranges)
 *         → if shareholder_entity_id is set → recurse into that entity
 *
 * All functions are date-parameterised: ownership is calculated AT a given date.
 * A shareholding is "active" at date D if:
 *   effective_date <= D AND (effective_to IS NULL OR effective_to > D)
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface ShareClassData {
  id: string;
  entity_id: string;
  class_name: string;
  issued_shares: number;
}

export interface ShareholderData {
  id: string;
  entity_id: string;
  shareholder_name: string;
  shareholder_entity_id: string | null;
  shareholder_type: string;
  share_class_id: string | null;
  shares_held: number;
  percentage: number;
  effective_date: string;
  effective_to: string | null;
}

export interface EntityData {
  id: string;
  entity_name: string;
  is_group_parent: boolean;
}

export interface OwnershipResult {
  shareholderId: string | null;
  shareholderName: string;
  shareholderEntityId: string | null;
  shareholderType: string;
  ownershipPercent: number;
  sharesHeld: number;
  issuedShares: number;
  shareClassName: string;
}

export interface EffectiveOwnership {
  ultimateOwnerName: string;
  ultimateOwnerEntityId: string | null;
  ultimateOwnerType: string;
  effectivePercent: number;
  path: string[];
}

// ─── Core Functions ──────────────────────────────────────────────────────

/**
 * Filter shareholders active at a given date
 */
export function getActiveShareholdersAtDate(
  shareholders: ShareholderData[],
  entityId: string,
  atDate: Date
): ShareholderData[] {
  const dateStr = atDate.toISOString().split('T')[0];
  return shareholders.filter(sh =>
    sh.entity_id === entityId &&
    sh.effective_date <= dateStr &&
    (sh.effective_to === null || sh.effective_to > dateStr)
  );
}

/**
 * Get direct ownership breakdown for a single entity at a date.
 */
export function getDirectOwnership(
  entityId: string,
  shareClasses: ShareClassData[],
  shareholders: ShareholderData[],
  atDate: Date
): OwnershipResult[] {
  const entityClasses = shareClasses.filter(sc => sc.entity_id === entityId);
  const activeShareholders = getActiveShareholdersAtDate(shareholders, entityId, atDate);

  return activeShareholders.map(sh => {
    const shareClass = sh.share_class_id
      ? entityClasses.find(sc => sc.id === sh.share_class_id)
      : null;

    let ownershipPercent: number;
    let issuedShares: number;
    let shareClassName: string;

    if (shareClass && shareClass.issued_shares > 0) {
      ownershipPercent = (sh.shares_held / shareClass.issued_shares) * 100;
      issuedShares = shareClass.issued_shares;
      shareClassName = shareClass.class_name;
    } else {
      ownershipPercent = sh.percentage;
      issuedShares = 0;
      shareClassName = 'Unknown';
    }

    return {
      shareholderId: sh.id,
      shareholderName: sh.shareholder_name,
      shareholderEntityId: sh.shareholder_entity_id,
      shareholderType: sh.shareholder_type,
      ownershipPercent,
      sharesHeld: sh.shares_held,
      issuedShares,
      shareClassName,
    };
  });
}

/**
 * Get a specific shareholder's ownership of a specific entity at a date.
 */
export function getOwnership(
  entityId: string,
  shareholderEntityId: string,
  shareClasses: ShareClassData[],
  shareholders: ShareholderData[],
  atDate: Date
): number {
  const direct = getDirectOwnership(entityId, shareClasses, shareholders, atDate);
  return direct
    .filter(o => o.shareholderEntityId === shareholderEntityId)
    .reduce((sum, o) => sum + o.ownershipPercent, 0);
}

/**
 * Recursive look-through: resolve to ultimate beneficial owners.
 */
export function resolveEffectiveOwnership(
  entityId: string,
  parentPercent: number,
  parentPath: string[],
  entities: EntityData[],
  shareClasses: ShareClassData[],
  shareholders: ShareholderData[],
  atDate: Date,
  visited: Set<string> = new Set(),
  maxDepth: number = 10
): EffectiveOwnership[] {
  if (visited.has(entityId) || visited.size >= maxDepth) {
    const entity = entities.find(e => e.id === entityId);
    return [{
      ultimateOwnerName: entity?.entity_name || 'Unknown (circular)',
      ultimateOwnerEntityId: entityId,
      ultimateOwnerType: 'entity',
      effectivePercent: parentPercent,
      path: [...parentPath, `[circular: ${entity?.entity_name || entityId}]`],
    }];
  }

  visited.add(entityId);
  const directOwners = getDirectOwnership(entityId, shareClasses, shareholders, atDate);

  if (directOwners.length === 0) {
    const entity = entities.find(e => e.id === entityId);
    return [{
      ultimateOwnerName: entity?.entity_name || 'Unknown Entity',
      ultimateOwnerEntityId: entityId,
      ultimateOwnerType: 'entity',
      effectivePercent: parentPercent,
      path: parentPath,
    }];
  }

  const results: EffectiveOwnership[] = [];

  for (const owner of directOwners) {
    const effectivePercent = (parentPercent / 100) * (owner.ownershipPercent / 100) * 100;
    const stepDesc = `${owner.ownershipPercent.toFixed(1)}% of ${entities.find(e => e.id === entityId)?.entity_name || 'entity'}`;
    const newPath = [...parentPath, stepDesc];

    if (owner.shareholderType === 'individual' || !owner.shareholderEntityId) {
      results.push({
        ultimateOwnerName: owner.shareholderName,
        ultimateOwnerEntityId: owner.shareholderEntityId,
        ultimateOwnerType: owner.shareholderType,
        effectivePercent,
        path: newPath,
      });
    } else {
      const subResults = resolveEffectiveOwnership(
        owner.shareholderEntityId,
        effectivePercent,
        newPath,
        entities,
        shareClasses,
        shareholders,
        atDate,
        new Set(visited),
        maxDepth
      );
      results.push(...subResults);
    }
  }

  return results;
}

/**
 * Get group parent's direct ownership of the given entity.
 */
export function getGroupParentOwnership(
  entityId: string,
  entities: EntityData[],
  shareClasses: ShareClassData[],
  shareholders: ShareholderData[],
  atDate: Date
): { groupEntityId: string | null; groupEntityName: string; ownershipPercent: number } {
  const groupParent = entities.find(e => e.is_group_parent);
  if (!groupParent) {
    return { groupEntityId: null, groupEntityName: 'No group parent set', ownershipPercent: 0 };
  }

  const percent = getOwnership(entityId, groupParent.id, shareClasses, shareholders, atDate);

  return {
    groupEntityId: groupParent.id,
    groupEntityName: groupParent.entity_name,
    ownershipPercent: percent,
  };
}

/**
 * Merge multiple EffectiveOwnership entries for the same ultimate owner.
 */
export function mergeEffectiveOwnership(owners: EffectiveOwnership[]): EffectiveOwnership[] {
  const merged = new Map<string, EffectiveOwnership>();

  for (const owner of owners) {
    const key = owner.ultimateOwnerEntityId || owner.ultimateOwnerName;
    const existing = merged.get(key);
    if (existing) {
      existing.effectivePercent += owner.effectivePercent;
      existing.path = [...existing.path, '+', ...owner.path];
    } else {
      merged.set(key, { ...owner });
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.effectivePercent - a.effectivePercent);
}
