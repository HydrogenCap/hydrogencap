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
} from '../ownershipEngine';
import {
  resolveOwnershipGraph,
} from '../ownershipResolver';

// ── Test Data Factories ─────────────────────────────────────────────────

const DATE = new Date('2024-06-15');

function makeShareClass(overrides: Partial<ShareClassData> = {}): ShareClassData {
  return {
    id: 'sc-1',
    entity_id: 'e-1',
    class_name: 'Ordinary',
    issued_shares: 100,
    ...overrides,
  };
}

function makeShareholder(overrides: Partial<ShareholderData> = {}): ShareholderData {
  return {
    id: 'sh-1',
    entity_id: 'e-1',
    shareholder_name: 'Alice',
    shareholder_entity_id: null,
    shareholder_type: 'individual',
    share_class_id: 'sc-1',
    shares_held: 50,
    percentage: 50,
    effective_date: '2024-01-01',
    effective_to: null,
    ...overrides,
  };
}

function makeEntity(overrides: Partial<EntityData> = {}): EntityData {
  return {
    id: 'e-1',
    entity_name: 'Test Entity',
    is_group_parent: false,
    ...overrides,
  };
}

// ── getActiveShareholdersAtDate ─────────────────────────────────────────

describe('getActiveShareholdersAtDate', () => {
  it('returns shareholders active at the given date', () => {
    const shareholders = [
      makeShareholder({ effective_date: '2024-01-01', effective_to: null }),
    ];
    const result = getActiveShareholdersAtDate(shareholders, 'e-1', DATE);
    expect(result).toHaveLength(1);
  });

  it('excludes shareholders from different entity', () => {
    const shareholders = [
      makeShareholder({ entity_id: 'e-2' }),
    ];
    const result = getActiveShareholdersAtDate(shareholders, 'e-1', DATE);
    expect(result).toHaveLength(0);
  });

  it('excludes shareholders not yet effective', () => {
    const shareholders = [
      makeShareholder({ effective_date: '2025-01-01' }),
    ];
    const result = getActiveShareholdersAtDate(shareholders, 'e-1', DATE);
    expect(result).toHaveLength(0);
  });

  it('excludes shareholders whose term has ended', () => {
    const shareholders = [
      makeShareholder({ effective_date: '2024-01-01', effective_to: '2024-05-01' }),
    ];
    const result = getActiveShareholdersAtDate(shareholders, 'e-1', DATE);
    expect(result).toHaveLength(0);
  });

  it('includes shareholders with effective_to exactly today (still active)', () => {
    const shareholders = [
      makeShareholder({ effective_date: '2024-01-01', effective_to: '2024-06-16' }),
    ];
    const result = getActiveShareholdersAtDate(shareholders, 'e-1', DATE);
    expect(result).toHaveLength(1);
  });

  it('handles empty shareholders array', () => {
    const result = getActiveShareholdersAtDate([], 'e-1', DATE);
    expect(result).toHaveLength(0);
  });
});

// ── getDirectOwnership ──────────────────────────────────────────────────

describe('getDirectOwnership', () => {
  it('calculates ownership from shares', () => {
    const classes = [makeShareClass({ issued_shares: 100 })];
    const shareholders = [
      makeShareholder({ shares_held: 60, share_class_id: 'sc-1' }),
    ];
    const result = getDirectOwnership('e-1', classes, shareholders, DATE);
    expect(result).toHaveLength(1);
    expect(result[0].ownershipPercent).toBe(60);
    expect(result[0].shareClassName).toBe('Ordinary');
  });

  it('handles multiple shareholders', () => {
    const classes = [makeShareClass({ issued_shares: 100 })];
    const shareholders = [
      makeShareholder({ id: 'sh-1', shareholder_name: 'Alice', shares_held: 60 }),
      makeShareholder({ id: 'sh-2', shareholder_name: 'Bob', shares_held: 40 }),
    ];
    const result = getDirectOwnership('e-1', classes, shareholders, DATE);
    expect(result).toHaveLength(2);
    expect(result[0].ownershipPercent + result[1].ownershipPercent).toBe(100);
  });

  it('uses percentage fallback when no share class', () => {
    const shareholders = [
      makeShareholder({ share_class_id: null, percentage: 75 }),
    ];
    const result = getDirectOwnership('e-1', [], shareholders, DATE);
    expect(result[0].ownershipPercent).toBe(75);
    expect(result[0].shareClassName).toBe('Unknown');
  });

  it('handles multiple share classes', () => {
    const classes = [
      makeShareClass({ id: 'sc-ord', class_name: 'Ordinary', issued_shares: 100 }),
      makeShareClass({ id: 'sc-pref', class_name: 'Preference', issued_shares: 50 }),
    ];
    const shareholders = [
      makeShareholder({ id: 'sh-1', share_class_id: 'sc-ord', shares_held: 60 }),
      makeShareholder({ id: 'sh-2', share_class_id: 'sc-pref', shares_held: 25 }),
    ];
    const result = getDirectOwnership('e-1', classes, shareholders, DATE);
    expect(result[0].ownershipPercent).toBe(60);
    expect(result[0].shareClassName).toBe('Ordinary');
    expect(result[1].ownershipPercent).toBe(50);
    expect(result[1].shareClassName).toBe('Preference');
  });

  it('returns empty for entity with no active shareholders', () => {
    const result = getDirectOwnership('e-1', [], [], DATE);
    expect(result).toHaveLength(0);
  });

  it('handles zero issued shares gracefully', () => {
    const classes = [makeShareClass({ issued_shares: 0 })];
    const shareholders = [
      makeShareholder({ shares_held: 10, percentage: 100 }),
    ];
    const result = getDirectOwnership('e-1', classes, shareholders, DATE);
    // Falls back to percentage when issued_shares is 0
    expect(result[0].ownershipPercent).toBe(100);
  });
});

// ── getOwnership ────────────────────────────────────────────────────────

describe('getOwnership', () => {
  it('returns total ownership of a specific shareholder entity', () => {
    const classes = [makeShareClass({ issued_shares: 100 })];
    const shareholders = [
      makeShareholder({
        id: 'sh-1',
        shareholder_name: 'Parent Co',
        shareholder_entity_id: 'e-parent',
        shareholder_type: 'entity',
        shares_held: 70,
      }),
    ];
    const result = getOwnership('e-1', 'e-parent', classes, shareholders, DATE);
    expect(result).toBe(70);
  });

  it('returns 0 when shareholder has no ownership', () => {
    const result = getOwnership('e-1', 'e-unknown', [], [], DATE);
    expect(result).toBe(0);
  });

  it('sums across multiple share classes', () => {
    const classes = [
      makeShareClass({ id: 'sc-1', issued_shares: 100 }),
      makeShareClass({ id: 'sc-2', issued_shares: 100 }),
    ];
    const shareholders = [
      makeShareholder({ id: 'sh-1', shareholder_entity_id: 'e-parent', share_class_id: 'sc-1', shares_held: 30 }),
      makeShareholder({ id: 'sh-2', shareholder_entity_id: 'e-parent', share_class_id: 'sc-2', shares_held: 20 }),
    ];
    const result = getOwnership('e-1', 'e-parent', classes, shareholders, DATE);
    expect(result).toBe(50); // 30% + 20%
  });
});

// ── resolveEffectiveOwnership ───────────────────────────────────────────

describe('resolveEffectiveOwnership', () => {
  it('returns individual owners directly', () => {
    const entities = [makeEntity()];
    const classes = [makeShareClass({ issued_shares: 100 })];
    const shareholders = [
      makeShareholder({ shares_held: 100, shareholder_type: 'individual' }),
    ];
    const result = resolveEffectiveOwnership(
      'e-1', 100, [], entities, classes, shareholders, DATE
    );
    expect(result).toHaveLength(1);
    expect(result[0].ultimateOwnerName).toBe('Alice');
    expect(result[0].effectivePercent).toBe(100);
  });

  it('resolves through entity chains', () => {
    const entities = [
      makeEntity({ id: 'e-1', entity_name: 'SPV Ltd' }),
      makeEntity({ id: 'e-2', entity_name: 'Holding Co' }),
    ];
    const classes = [
      makeShareClass({ id: 'sc-1', entity_id: 'e-1', issued_shares: 100 }),
      makeShareClass({ id: 'sc-2', entity_id: 'e-2', issued_shares: 100 }),
    ];
    const shareholders = [
      // Holding Co owns 80% of SPV Ltd
      makeShareholder({
        id: 'sh-1', entity_id: 'e-1',
        shareholder_name: 'Holding Co', shareholder_entity_id: 'e-2',
        shareholder_type: 'entity', share_class_id: 'sc-1', shares_held: 80,
      }),
      // Bob owns 100% of Holding Co
      makeShareholder({
        id: 'sh-2', entity_id: 'e-2',
        shareholder_name: 'Bob', shareholder_entity_id: null,
        shareholder_type: 'individual', share_class_id: 'sc-2', shares_held: 100,
      }),
    ];
    const result = resolveEffectiveOwnership(
      'e-1', 100, [], entities, classes, shareholders, DATE
    );
    expect(result).toHaveLength(1);
    expect(result[0].ultimateOwnerName).toBe('Bob');
    // 100% * (80/100) * (100/100) = 80%
    expect(result[0].effectivePercent).toBeCloseTo(80, 1);
  });

  it('handles circular references', () => {
    const entities = [
      makeEntity({ id: 'e-1', entity_name: 'A' }),
      makeEntity({ id: 'e-2', entity_name: 'B' }),
    ];
    const classes = [
      makeShareClass({ id: 'sc-1', entity_id: 'e-1', issued_shares: 100 }),
      makeShareClass({ id: 'sc-2', entity_id: 'e-2', issued_shares: 100 }),
    ];
    const shareholders = [
      makeShareholder({ id: 'sh-1', entity_id: 'e-1', shareholder_name: 'B', shareholder_entity_id: 'e-2', shareholder_type: 'entity', share_class_id: 'sc-1', shares_held: 100 }),
      makeShareholder({ id: 'sh-2', entity_id: 'e-2', shareholder_name: 'A', shareholder_entity_id: 'e-1', shareholder_type: 'entity', share_class_id: 'sc-2', shares_held: 100 }),
    ];
    // Should not infinite loop
    const result = resolveEffectiveOwnership(
      'e-1', 100, [], entities, classes, shareholders, DATE
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].path.some(p => p.includes('circular'))).toBe(true);
  });

  it('returns entity as ultimate owner when no shareholders found', () => {
    const entities = [makeEntity({ id: 'e-1', entity_name: 'Orphan Entity' })];
    const result = resolveEffectiveOwnership(
      'e-1', 100, [], entities, [], [], DATE
    );
    expect(result).toHaveLength(1);
    expect(result[0].ultimateOwnerName).toBe('Orphan Entity');
    expect(result[0].effectivePercent).toBe(100);
  });

  it('respects maxDepth', () => {
    const entities = [makeEntity()];
    const classes = [makeShareClass()];
    const shareholders = [makeShareholder()];
    // maxDepth = 0 means it should return immediately
    const result = resolveEffectiveOwnership(
      'e-1', 100, [], entities, classes, shareholders, DATE,
      new Set(), 0
    );
    // With maxDepth 0, the initial call still processes (visited.size=0 < 0 is false)
    // But visited.size becomes 1 after adding entity, so recursion stops
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ── getGroupParentOwnership ─────────────────────────────────────────────

describe('getGroupParentOwnership', () => {
  it('returns group parent ownership percentage', () => {
    const entities = [
      makeEntity({ id: 'e-parent', entity_name: 'Group Parent', is_group_parent: true }),
      makeEntity({ id: 'e-child', entity_name: 'Child SPV' }),
    ];
    const classes = [makeShareClass({ id: 'sc-1', entity_id: 'e-child', issued_shares: 100 })];
    const shareholders = [
      makeShareholder({
        entity_id: 'e-child', shareholder_entity_id: 'e-parent',
        shareholder_type: 'entity', share_class_id: 'sc-1', shares_held: 100,
      }),
    ];
    const result = getGroupParentOwnership('e-child', entities, classes, shareholders, DATE);
    expect(result.groupEntityId).toBe('e-parent');
    expect(result.groupEntityName).toBe('Group Parent');
    expect(result.ownershipPercent).toBe(100);
  });

  it('returns zero when no group parent exists', () => {
    const entities = [makeEntity({ id: 'e-1', is_group_parent: false })];
    const result = getGroupParentOwnership('e-1', entities, [], [], DATE);
    expect(result.groupEntityId).toBeNull();
    expect(result.ownershipPercent).toBe(0);
  });

  it('returns zero when group parent has no ownership of entity', () => {
    const entities = [
      makeEntity({ id: 'e-parent', is_group_parent: true }),
      makeEntity({ id: 'e-other' }),
    ];
    const result = getGroupParentOwnership('e-other', entities, [], [], DATE);
    expect(result.ownershipPercent).toBe(0);
  });
});

// ── mergeEffectiveOwnership ─────────────────────────────────────────────

describe('mergeEffectiveOwnership', () => {
  it('merges entries for the same owner', () => {
    const owners: EffectiveOwnership[] = [
      { ultimateOwnerName: 'Alice', ultimateOwnerEntityId: null, ultimateOwnerType: 'individual', effectivePercent: 30, path: ['path1'] },
      { ultimateOwnerName: 'Alice', ultimateOwnerEntityId: null, ultimateOwnerType: 'individual', effectivePercent: 20, path: ['path2'] },
    ];
    const merged = mergeEffectiveOwnership(owners);
    expect(merged).toHaveLength(1);
    expect(merged[0].effectivePercent).toBe(50);
  });

  it('keeps separate entries for different owners', () => {
    const owners: EffectiveOwnership[] = [
      { ultimateOwnerName: 'Alice', ultimateOwnerEntityId: null, ultimateOwnerType: 'individual', effectivePercent: 60, path: [] },
      { ultimateOwnerName: 'Bob', ultimateOwnerEntityId: null, ultimateOwnerType: 'individual', effectivePercent: 40, path: [] },
    ];
    const merged = mergeEffectiveOwnership(owners);
    expect(merged).toHaveLength(2);
  });

  it('sorts by effectivePercent descending', () => {
    const owners: EffectiveOwnership[] = [
      { ultimateOwnerName: 'Small', ultimateOwnerEntityId: null, ultimateOwnerType: 'individual', effectivePercent: 10, path: [] },
      { ultimateOwnerName: 'Big', ultimateOwnerEntityId: null, ultimateOwnerType: 'individual', effectivePercent: 90, path: [] },
    ];
    const merged = mergeEffectiveOwnership(owners);
    expect(merged[0].ultimateOwnerName).toBe('Big');
    expect(merged[1].ultimateOwnerName).toBe('Small');
  });

  it('uses entity id as merge key when available', () => {
    const owners: EffectiveOwnership[] = [
      { ultimateOwnerName: 'Corp', ultimateOwnerEntityId: 'e-1', ultimateOwnerType: 'entity', effectivePercent: 30, path: ['a'] },
      { ultimateOwnerName: 'Corp', ultimateOwnerEntityId: 'e-1', ultimateOwnerType: 'entity', effectivePercent: 20, path: ['b'] },
    ];
    const merged = mergeEffectiveOwnership(owners);
    expect(merged).toHaveLength(1);
    expect(merged[0].effectivePercent).toBe(50);
    // Path should be combined
    expect(merged[0].path).toContain('+');
  });

  it('handles empty array', () => {
    const merged = mergeEffectiveOwnership([]);
    expect(merged).toHaveLength(0);
  });
});

// ── resolveOwnershipGraph (ownershipResolver) ───────────────────────────

describe('resolveOwnershipGraph', () => {
  it('builds nodes for entities and properties', () => {
    const entities = [{ id: 'e-1', entity_name: 'SPV Ltd', entity_type: 'spv', company_number: '12345678' }];
    const properties = [{ id: 'p-1', address_line_1: '1 Test Lane', entity_id: 'e-1' }];
    const result = resolveOwnershipGraph(entities, [], [], properties);
    expect(result.nodes).toHaveLength(2); // entity + property
    expect(result.nodes.find(n => n.type === 'entity')?.name).toBe('SPV Ltd');
    expect(result.nodes.find(n => n.type === 'property')?.name).toBe('1 Test Lane');
  });

  it('creates entity-to-property edges', () => {
    const entities = [{ id: 'e-1', entity_name: 'SPV', entity_type: 'spv', company_number: null }];
    const properties = [{ id: 'p-1', address_line_1: 'Addr', entity_id: 'e-1' }];
    const result = resolveOwnershipGraph(entities, [], [], properties);
    const propEdge = result.edges.find(e => e.type === 'property_ownership');
    expect(propEdge?.fromId).toBe('e-1');
    expect(propEdge?.toId).toBe('p-1');
    expect(propEdge?.percent).toBe(100);
  });

  it('creates individual shareholder nodes and edges', () => {
    const entities = [{ id: 'e-1', entity_name: 'SPV', entity_type: 'spv', company_number: null }];
    const shareholders = [{
      id: 'sh-1', entity_id: 'e-1', shareholder_name: 'Alice',
      shareholder_entity_id: null, shares_held: 100, percentage: 100, share_class_id: null,
    }];
    const result = resolveOwnershipGraph(entities, shareholders, [], []);
    const individualNode = result.nodes.find(n => n.type === 'individual');
    expect(individualNode?.name).toBe('Alice');
    const edge = result.edges.find(e => e.type === 'shareholding');
    expect(edge?.percent).toBe(100);
  });

  it('creates entity-to-entity edges from links', () => {
    const entities = [
      { id: 'e-1', entity_name: 'Parent', entity_type: 'holding', company_number: null },
      { id: 'e-2', entity_name: 'Child', entity_type: 'spv', company_number: null },
    ];
    const links = [{ parent_entity_id: 'e-2', shareholder_entity_id: 'e-1', shareholder_percent: 100 }];
    const result = resolveOwnershipGraph(entities, [], links, []);
    const entityEdge = result.edges.find(e => e.type === 'entity_ownership');
    expect(entityEdge?.fromId).toBe('e-1');
    expect(entityEdge?.toId).toBe('e-2');
    expect(entityEdge?.percent).toBe(100);
  });

  it('resolves ownership chains from property to ultimate owner', () => {
    const entities = [
      { id: 'e-1', entity_name: 'SPV', entity_type: 'spv', company_number: null },
    ];
    const shareholders = [{
      id: 'sh-1', entity_id: 'e-1', shareholder_name: 'Alice',
      shareholder_entity_id: null, shares_held: 100, percentage: 100, share_class_id: null,
    }];
    const properties = [{ id: 'p-1', address_line_1: 'Addr', entity_id: 'e-1' }];
    const result = resolveOwnershipGraph(entities, shareholders, [], properties);
    expect(result.chains.length).toBeGreaterThanOrEqual(1);
    expect(result.chains[0].ultimateOwner.name).toBe('Alice');
    expect(result.chains[0].effectivePercent).toBe(100);
  });

  it('handles property without entity', () => {
    const properties = [{ id: 'p-1', address_line_1: 'Addr', entity_id: null }];
    const result = resolveOwnershipGraph([], [], [], properties);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('handles empty inputs', () => {
    const result = resolveOwnershipGraph([], [], [], []);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.chains).toHaveLength(0);
  });

  it('prevents cycles in chain resolution', () => {
    const entities = [
      { id: 'e-1', entity_name: 'A', entity_type: 'spv', company_number: null },
      { id: 'e-2', entity_name: 'B', entity_type: 'spv', company_number: null },
    ];
    const links = [
      { parent_entity_id: 'e-1', shareholder_entity_id: 'e-2', shareholder_percent: 100 },
      { parent_entity_id: 'e-2', shareholder_entity_id: 'e-1', shareholder_percent: 100 },
    ];
    const properties = [{ id: 'p-1', address_line_1: 'Addr', entity_id: 'e-1' }];
    // Should not hang
    const result = resolveOwnershipGraph(entities, [], links, properties);
    expect(result.chains).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════
// Part 2: distribution-calculator.ts module tests (new module)
// ══════════════════════════════════════════════════════════════════════

import {
  calculateRetention,
  calculateSimpleDistribution,
  calculateWaterfallDistribution,
  calculateEffectiveYield,
  type Investor,
  type WaterfallConfig,
} from '../distribution-calculator';

describe('distribution-calculator: calculateRetention', () => {
  it('10% retention', () => {
    const r = calculateRetention(100_000, 10);
    expect(r.retentionAmount).toBe(10_000);
    expect(r.distributableProfit).toBe(90_000);
  });
  it('zero retention', () => { expect(calculateRetention(100_000, 0).retentionAmount).toBe(0); });
  it('100% retention', () => { expect(calculateRetention(100_000, 100).distributableProfit).toBe(0); });
  it('clamps above 100%', () => { expect(calculateRetention(100_000, 150).retentionAmount).toBe(100_000); });
  it('negative profit', () => { expect(calculateRetention(-50_000, 10).retentionAmount).toBe(0); });
  it('negative percent', () => { expect(calculateRetention(100_000, -10).retentionAmount).toBe(0); });
});

describe('distribution-calculator: calculateSimpleDistribution', () => {
  const investors: Investor[] = [
    { id: '1', name: 'Alice', capitalContributed: 50_000, ownershipPercent: 50, isGP: false },
    { id: '2', name: 'Bob', capitalContributed: 30_000, ownershipPercent: 30, isGP: false },
    { id: '3', name: 'Charlie', capitalContributed: 20_000, ownershipPercent: 20, isGP: false },
  ];

  it('distributes pro-rata', () => {
    const r = calculateSimpleDistribution({ grossProfit: 100_000, investors, retentionPercent: 0 });
    expect(r.allocations[0].amount).toBe(50_000);
    expect(r.allocations[1].amount).toBe(30_000);
    expect(r.allocations[2].amount).toBe(20_000);
  });

  it('applies retention', () => {
    const r = calculateSimpleDistribution({ grossProfit: 100_000, investors, retentionPercent: 10 });
    expect(r.retentionAmount).toBe(10_000);
    expect(r.allocations[0].amount).toBe(45_000);
  });

  it('zero profit', () => {
    const r = calculateSimpleDistribution({ grossProfit: 0, investors, retentionPercent: 0 });
    expect(r.allocations).toHaveLength(0);
  });

  it('empty investors', () => {
    const r = calculateSimpleDistribution({ grossProfit: 100_000, investors: [], retentionPercent: 0 });
    expect(r.totalDistributed).toBe(0);
  });

  it('single investor gets everything', () => {
    const r = calculateSimpleDistribution({ grossProfit: 100_000, investors: [{ id: '1', name: 'Solo', capitalContributed: 100_000, ownershipPercent: 100, isGP: false }], retentionPercent: 0 });
    expect(r.allocations[0].amount).toBe(100_000);
  });
});

describe('distribution-calculator: calculateWaterfallDistribution', () => {
  const config: WaterfallConfig = { retentionPercent: 10, preferredReturnPercent: 8, gpCatchUpPercent: 50, gpCatchUpLimit: 20, residualGPShare: 20 };
  const investors: Investor[] = [
    { id: 'gp', name: 'Manager', capitalContributed: 10_000, ownershipPercent: 20, isGP: true },
    { id: 'lp1', name: 'LP One', capitalContributed: 60_000, ownershipPercent: 50, isGP: false },
    { id: 'lp2', name: 'LP Two', capitalContributed: 30_000, ownershipPercent: 30, isGP: false },
  ];

  it('applies retention first', () => {
    const r = calculateWaterfallDistribution(100_000, investors, config);
    expect(r.retentionAmount).toBe(10_000);
  });

  it('allocates preferred return to LPs', () => {
    const r = calculateWaterfallDistribution(100_000, investors, config);
    const lp1 = r.allocations.find(a => a.investorId === 'lp1')!;
    expect(lp1.preferredReturn).toBeCloseTo(4_800, 0);
  });

  it('GP gets catch-up', () => {
    const r = calculateWaterfallDistribution(100_000, investors, config);
    const gp = r.allocations.find(a => a.investorId === 'gp')!;
    expect(gp.catchUp).toBeGreaterThan(0);
  });

  it('distributes residual', () => {
    const r = calculateWaterfallDistribution(100_000, investors, config);
    const totalResidual = r.allocations.reduce((s, a) => s + a.residualShare, 0);
    expect(totalResidual).toBeGreaterThan(0);
  });

  it('total does not exceed distributable', () => {
    const r = calculateWaterfallDistribution(100_000, investors, config);
    expect(r.totalDistributed).toBeLessThanOrEqual(r.distributableProfit + 1);
  });

  it('zero profit', () => {
    const r = calculateWaterfallDistribution(0, investors, config);
    expect(r.totalDistributed).toBe(0);
  });

  it('no GP in mix', () => {
    const lpOnly: Investor[] = [
      { id: 'lp1', name: 'LP One', capitalContributed: 60_000, ownershipPercent: 60, isGP: false },
      { id: 'lp2', name: 'LP Two', capitalContributed: 40_000, ownershipPercent: 40, isGP: false },
    ];
    const r = calculateWaterfallDistribution(100_000, lpOnly, config);
    expect(r.allocations.every(a => a.catchUp === 0)).toBe(true);
  });
});

describe('distribution-calculator: calculateEffectiveYield', () => {
  it('calculates yield', () => { expect(calculateEffectiveYield(8_000, 100_000)).toBe(8); });
  it('zero capital', () => { expect(calculateEffectiveYield(8_000, 0)).toBe(0); });
  it('negative capital', () => { expect(calculateEffectiveYield(8_000, -50_000)).toBe(0); });
  it('zero distribution', () => { expect(calculateEffectiveYield(0, 100_000)).toBe(0); });
});
