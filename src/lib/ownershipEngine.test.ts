import { describe, it, expect } from 'vitest';
import {
  getActiveShareholdersAtDate,
  getDirectOwnership,
  getOwnership,
  resolveEffectiveOwnership,
  getGroupParentOwnership,
  mergeEffectiveOwnership,
  type ShareClassData,
  type ShareholderData,
  type EntityData,
  type EffectiveOwnership,
} from './ownershipEngine';

function entity(id: string, name: string, overrides: Partial<EntityData> = {}): EntityData {
  return { id, entity_name: name, is_group_parent: false, ...overrides };
}

function shareClass(id: string, entity_id: string, overrides: Partial<ShareClassData> = {}): ShareClassData {
  return { id, entity_id, class_name: 'Ordinary', issued_shares: 1000, ...overrides };
}

function shareholder(
  id: string,
  entity_id: string,
  overrides: Partial<ShareholderData> = {},
): ShareholderData {
  return {
    id,
    entity_id,
    shareholder_name: 'Alice',
    shareholder_entity_id: null,
    shareholder_type: 'individual',
    share_class_id: null,
    shares_held: 100,
    percentage: 100,
    effective_date: '2022-01-01',
    effective_to: null,
    ...overrides,
  };
}

describe('getActiveShareholdersAtDate', () => {
  it('includes a shareholder whose effective_date is exactly on the query date', () => {
    const sh = [shareholder('s1', 'e1', { effective_date: '2025-06-15', effective_to: null })];
    const result = getActiveShareholdersAtDate(sh, 'e1', new Date('2025-06-15T12:00:00Z'));
    expect(result).toHaveLength(1);
  });

  it('excludes shareholders whose effective_date is in the future', () => {
    const sh = [shareholder('s1', 'e1', { effective_date: '2025-07-01' })];
    const result = getActiveShareholdersAtDate(sh, 'e1', new Date('2025-06-15T12:00:00Z'));
    expect(result).toEqual([]);
  });

  it('excludes shareholders whose effective_to has passed', () => {
    const sh = [shareholder('s1', 'e1', { effective_date: '2025-01-01', effective_to: '2025-06-01' })];
    const result = getActiveShareholdersAtDate(sh, 'e1', new Date('2025-06-15T12:00:00Z'));
    expect(result).toEqual([]);
  });

  it('includes a shareholder whose effective_to is after the query date', () => {
    const sh = [shareholder('s1', 'e1', { effective_date: '2025-01-01', effective_to: '2025-12-31' })];
    const result = getActiveShareholdersAtDate(sh, 'e1', new Date('2025-06-15T12:00:00Z'));
    expect(result).toHaveLength(1);
  });

  it('treats null effective_to as open-ended', () => {
    const sh = [shareholder('s1', 'e1', { effective_date: '2020-01-01', effective_to: null })];
    const result = getActiveShareholdersAtDate(sh, 'e1', new Date('2099-01-01T00:00:00Z'));
    expect(result).toHaveLength(1);
  });

  it('filters by entity_id', () => {
    const sh = [
      shareholder('s1', 'e1'),
      shareholder('s2', 'e2'),
    ];
    const result = getActiveShareholdersAtDate(sh, 'e1', new Date('2025-06-15T12:00:00Z'));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('boundary: effective_to equal to the query date excludes (strictly greater-than)', () => {
    const sh = [shareholder('s1', 'e1', { effective_date: '2025-01-01', effective_to: '2025-06-15' })];
    const result = getActiveShareholdersAtDate(sh, 'e1', new Date('2025-06-15T00:00:00Z'));
    expect(result).toEqual([]);
  });
});

describe('getDirectOwnership', () => {
  const atDate = new Date('2025-06-15T00:00:00Z');

  it('computes percent from share-class issued_shares when share_class_id is set', () => {
    const classes = [shareClass('c1', 'e1', { issued_shares: 1000 })];
    const holders = [
      shareholder('s1', 'e1', { shares_held: 600, percentage: 60, share_class_id: 'c1' }),
    ];
    const result = getDirectOwnership('e1', classes, holders, atDate);
    expect(result).toHaveLength(1);
    expect(result[0].ownershipPercent).toBe(60); // 600 / 1000 * 100
    expect(result[0].issuedShares).toBe(1000);
    expect(result[0].shareClassName).toBe('Ordinary');
  });

  it('falls back to the stored percentage when no share_class_id is set', () => {
    const classes: ShareClassData[] = [];
    const holders = [shareholder('s1', 'e1', { percentage: 42.5, share_class_id: null })];
    const result = getDirectOwnership('e1', classes, holders, atDate);
    expect(result[0].ownershipPercent).toBe(42.5);
    expect(result[0].issuedShares).toBe(0);
    expect(result[0].shareClassName).toBe('Unknown');
  });

  it('falls back to percentage when share_class_id points to a zero-issued class', () => {
    const classes = [shareClass('c1', 'e1', { issued_shares: 0 })];
    const holders = [shareholder('s1', 'e1', { shares_held: 100, percentage: 25, share_class_id: 'c1' })];
    const result = getDirectOwnership('e1', classes, holders, atDate);
    expect(result[0].ownershipPercent).toBe(25);
    expect(result[0].shareClassName).toBe('Unknown');
  });

  it('returns only shareholders for the requested entity', () => {
    const holders = [
      shareholder('s1', 'e1'),
      shareholder('s2', 'e2'),
    ];
    const result = getDirectOwnership('e1', [], holders, atDate);
    expect(result).toHaveLength(1);
    expect(result[0].shareholderId).toBe('s1');
  });

  it('returns an empty array when the entity has no active shareholders', () => {
    const result = getDirectOwnership('e1', [], [], atDate);
    expect(result).toEqual([]);
  });
});

describe('getOwnership', () => {
  const atDate = new Date('2025-06-15T00:00:00Z');

  it('sums percentages across multiple share classes for the same shareholder entity', () => {
    const classes = [
      shareClass('c-ord', 'e1', { class_name: 'Ordinary', issued_shares: 100 }),
      shareClass('c-pref', 'e1', { class_name: 'Preference', issued_shares: 100 }),
    ];
    const holders = [
      shareholder('s1', 'e1', {
        shareholder_entity_id: 'holdco',
        share_class_id: 'c-ord',
        shares_held: 40,
        shareholder_type: 'entity',
      }),
      shareholder('s2', 'e1', {
        shareholder_entity_id: 'holdco',
        share_class_id: 'c-pref',
        shares_held: 20,
        shareholder_type: 'entity',
      }),
    ];
    const percent = getOwnership('e1', 'holdco', classes, holders, atDate);
    expect(percent).toBe(60); // 40% + 20%
  });

  it('returns 0 when the given shareholderEntityId holds nothing', () => {
    const holders = [shareholder('s1', 'e1', { shareholder_entity_id: 'other', percentage: 50 })];
    const percent = getOwnership('e1', 'holdco', [], holders, atDate);
    expect(percent).toBe(0);
  });
});

describe('resolveEffectiveOwnership', () => {
  const atDate = new Date('2025-06-15T00:00:00Z');

  it('terminates on a direct individual shareholder with the full parent percent', () => {
    const entities = [entity('e1', 'Acme')];
    const classes = [shareClass('c1', 'e1', { issued_shares: 100 })];
    const holders = [
      shareholder('s1', 'e1', {
        shareholder_name: 'Alice',
        share_class_id: 'c1',
        shares_held: 100,
        shareholder_type: 'individual',
      }),
    ];
    const result = resolveEffectiveOwnership('e1', 100, [], entities, classes, holders, atDate);
    expect(result).toHaveLength(1);
    expect(result[0].ultimateOwnerName).toBe('Alice');
    expect(result[0].ultimateOwnerType).toBe('individual');
    expect(result[0].effectivePercent).toBe(100); // 100% * 100% = 100%
  });

  it('multiplies ownership percentages along a two-level chain', () => {
    const entities = [entity('sub', 'SubCo'), entity('holdco', 'HoldCo')];
    const classes = [
      shareClass('c-sub', 'sub', { issued_shares: 100 }),
      shareClass('c-hold', 'holdco', { issued_shares: 100 }),
    ];
    const holders = [
      // HoldCo owns 60% of SubCo
      shareholder('sh1', 'sub', {
        shareholder_name: 'HoldCo',
        shareholder_entity_id: 'holdco',
        shareholder_type: 'entity',
        share_class_id: 'c-sub',
        shares_held: 60,
      }),
      // Alice owns 50% of HoldCo
      shareholder('sh2', 'holdco', {
        shareholder_name: 'Alice',
        shareholder_type: 'individual',
        share_class_id: 'c-hold',
        shares_held: 50,
      }),
    ];
    const result = resolveEffectiveOwnership('sub', 100, [], entities, classes, holders, atDate);
    expect(result).toHaveLength(1);
    expect(result[0].ultimateOwnerName).toBe('Alice');
    // 100% parent * 60% * 50% = 30%
    expect(result[0].effectivePercent).toBeCloseTo(30, 5);
  });

  it('returns the entity itself as the ultimate owner when no shareholders exist', () => {
    const entities = [entity('e1', 'Standalone Ltd')];
    const result = resolveEffectiveOwnership('e1', 100, [], entities, [], [], atDate);
    expect(result).toHaveLength(1);
    expect(result[0].ultimateOwnerName).toBe('Standalone Ltd');
    expect(result[0].ultimateOwnerEntityId).toBe('e1');
    expect(result[0].effectivePercent).toBe(100);
  });

  it('marks circular ownership and does not recurse infinitely', () => {
    // HoldCo owns SubCo owns HoldCo (pathological)
    const entities = [entity('holdco', 'HoldCo'), entity('subco', 'SubCo')];
    const classes = [
      shareClass('c-hold', 'holdco', { issued_shares: 100 }),
      shareClass('c-sub', 'subco', { issued_shares: 100 }),
    ];
    const holders = [
      shareholder('sh1', 'holdco', {
        shareholder_name: 'SubCo',
        shareholder_entity_id: 'subco',
        shareholder_type: 'entity',
        share_class_id: 'c-hold',
        shares_held: 100,
      }),
      shareholder('sh2', 'subco', {
        shareholder_name: 'HoldCo',
        shareholder_entity_id: 'holdco',
        shareholder_type: 'entity',
        share_class_id: 'c-sub',
        shares_held: 100,
      }),
    ];
    const result = resolveEffectiveOwnership('holdco', 100, [], entities, classes, holders, atDate);
    expect(result.length).toBeGreaterThan(0);
    // At least one terminal path includes a circular marker.
    const circularMarker = result.some((r) => r.path.some((p) => p.startsWith('[circular:')));
    expect(circularMarker).toBe(true);
  });

  it('treats a shareholder with no entity id as a terminal even if typed as entity', () => {
    const entities = [entity('e1', 'Acme')];
    const classes = [shareClass('c1', 'e1', { issued_shares: 100 })];
    const holders = [
      shareholder('s1', 'e1', {
        shareholder_name: 'Unnamed Entity',
        shareholder_entity_id: null,
        shareholder_type: 'entity', // typed as entity but no id
        share_class_id: 'c1',
        shares_held: 50,
      }),
    ];
    const result = resolveEffectiveOwnership('e1', 100, [], entities, classes, holders, atDate);
    expect(result).toHaveLength(1);
    expect(result[0].ultimateOwnerName).toBe('Unnamed Entity');
  });

  it('respects maxDepth and stops descending', () => {
    const entities = [entity('e1', 'E1'), entity('e2', 'E2')];
    const classes = [shareClass('c1', 'e1', { issued_shares: 100 })];
    const holders = [
      shareholder('s1', 'e1', {
        shareholder_name: 'E2',
        shareholder_entity_id: 'e2',
        shareholder_type: 'entity',
        share_class_id: 'c1',
        shares_held: 100,
      }),
    ];
    // visited size must be >= maxDepth to trigger guard; set maxDepth = 0
    const result = resolveEffectiveOwnership('e1', 100, [], entities, classes, holders, atDate, new Set(), 0);
    // With maxDepth 0, it should return a circular/terminal marker at the first entity
    expect(result).toHaveLength(1);
  });

  it('records the intermediate step description in the path', () => {
    const entities = [entity('e1', 'Acme Ltd')];
    const classes = [shareClass('c1', 'e1', { issued_shares: 100 })];
    const holders = [
      shareholder('s1', 'e1', {
        shareholder_name: 'Alice',
        shareholder_type: 'individual',
        share_class_id: 'c1',
        shares_held: 75,
      }),
    ];
    const result = resolveEffectiveOwnership('e1', 100, [], entities, classes, holders, atDate);
    expect(result[0].path[0]).toMatch(/75.0% of Acme Ltd/);
  });
});

describe('getGroupParentOwnership', () => {
  const atDate = new Date('2025-06-15T00:00:00Z');

  it('returns zero/no-parent when no entity is flagged as group parent', () => {
    const entities = [entity('e1', 'Acme'), entity('e2', 'Sub')];
    const result = getGroupParentOwnership('e1', entities, [], [], atDate);
    expect(result.groupEntityId).toBeNull();
    expect(result.ownershipPercent).toBe(0);
    expect(result.groupEntityName).toMatch(/No group parent/);
  });

  it('computes the group parent\'s direct ownership of the target entity', () => {
    const entities = [
      entity('group', 'Group Plc', { is_group_parent: true }),
      entity('e1', 'Sub'),
    ];
    const classes = [shareClass('c1', 'e1', { issued_shares: 100 })];
    const holders = [
      shareholder('sh1', 'e1', {
        shareholder_name: 'Group Plc',
        shareholder_entity_id: 'group',
        shareholder_type: 'entity',
        share_class_id: 'c1',
        shares_held: 80,
      }),
    ];
    const result = getGroupParentOwnership('e1', entities, classes, holders, atDate);
    expect(result.groupEntityId).toBe('group');
    expect(result.groupEntityName).toBe('Group Plc');
    expect(result.ownershipPercent).toBe(80);
  });
});

describe('mergeEffectiveOwnership', () => {
  const base: EffectiveOwnership = {
    ultimateOwnerName: 'Alice',
    ultimateOwnerEntityId: null,
    ultimateOwnerType: 'individual',
    effectivePercent: 10,
    path: ['step-1'],
  };

  it('sums effectivePercent for the same ultimate owner', () => {
    const owners = [
      { ...base, effectivePercent: 10, path: ['path-a'] },
      { ...base, effectivePercent: 15, path: ['path-b'] },
    ];
    const merged = mergeEffectiveOwnership(owners);
    expect(merged).toHaveLength(1);
    expect(merged[0].effectivePercent).toBe(25);
  });

  it('concatenates paths with a + separator', () => {
    const owners = [
      { ...base, path: ['a1'] },
      { ...base, path: ['b1', 'b2'] },
    ];
    const merged = mergeEffectiveOwnership(owners);
    expect(merged[0].path).toEqual(['a1', '+', 'b1', 'b2']);
  });

  it('keeps distinct owners separate', () => {
    const owners = [
      { ...base, ultimateOwnerName: 'Alice', effectivePercent: 10 },
      { ...base, ultimateOwnerName: 'Bob', effectivePercent: 30 },
    ];
    const merged = mergeEffectiveOwnership(owners);
    expect(merged).toHaveLength(2);
  });

  it('sorts results by effectivePercent descending', () => {
    const owners = [
      { ...base, ultimateOwnerName: 'Small', effectivePercent: 5 },
      { ...base, ultimateOwnerName: 'Big', effectivePercent: 70 },
      { ...base, ultimateOwnerName: 'Mid', effectivePercent: 25 },
    ];
    const merged = mergeEffectiveOwnership(owners);
    expect(merged.map((m) => m.ultimateOwnerName)).toEqual(['Big', 'Mid', 'Small']);
  });

  it('groups by ultimateOwnerEntityId when set, falls back to name otherwise', () => {
    // Two entries with the same entity id but different names (e.g. renamed entity) — should merge.
    const owners = [
      { ...base, ultimateOwnerEntityId: 'ent-1', ultimateOwnerName: 'Old Name', effectivePercent: 10 },
      { ...base, ultimateOwnerEntityId: 'ent-1', ultimateOwnerName: 'New Name', effectivePercent: 20 },
    ];
    const merged = mergeEffectiveOwnership(owners);
    expect(merged).toHaveLength(1);
    expect(merged[0].effectivePercent).toBe(30);
  });

  it('does not mutate input entries', () => {
    const owner1 = { ...base, effectivePercent: 10, path: ['a'] };
    const owner2 = { ...base, effectivePercent: 15, path: ['b'] };
    mergeEffectiveOwnership([owner1, owner2]);
    expect(owner1.effectivePercent).toBe(10);
    expect(owner1.path).toEqual(['a']);
  });
});
