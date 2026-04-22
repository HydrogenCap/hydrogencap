import { describe, it, expect } from 'vitest';
import { resolveOwnershipGraph } from './ownershipResolver';

type Entity = Parameters<typeof resolveOwnershipGraph>[0][number];
type Shareholder = Parameters<typeof resolveOwnershipGraph>[1][number];
type EntityLink = Parameters<typeof resolveOwnershipGraph>[2][number];
type Property = Parameters<typeof resolveOwnershipGraph>[3][number];

function entity(id: string, name: string, overrides: Partial<Entity> = {}): Entity {
  return {
    id,
    entity_name: name,
    entity_type: 'spv',
    company_number: null,
    ...overrides,
  };
}

function shareholder(id: string, entity_id: string, name: string, percentage: number, overrides: Partial<Shareholder> = {}): Shareholder {
  return {
    id,
    entity_id,
    shareholder_name: name,
    shareholder_entity_id: null,
    shares_held: 100,
    percentage,
    share_class_id: null,
    ...overrides,
  };
}

function link(parent_entity_id: string, shareholder_entity_id: string, shareholder_percent: number): EntityLink {
  return { parent_entity_id, shareholder_entity_id, shareholder_percent };
}

function property(id: string, address: string, entity_id: string | null): Property {
  return { id, address_line_1: address, entity_id };
}

describe('resolveOwnershipGraph', () => {
  it('returns empty results for empty inputs', () => {
    const { nodes, edges, chains } = resolveOwnershipGraph([], [], [], []);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
    expect(chains).toEqual([]);
  });

  it('adds entity and property nodes with the expected type tags', () => {
    const { nodes } = resolveOwnershipGraph(
      [entity('ent-1', 'Acme Ltd', { entity_type: 'spv', company_number: '12345678' })],
      [],
      [],
      [property('prop-1', '10 High St', 'ent-1')],
    );
    expect(nodes).toHaveLength(2);
    const ent = nodes.find((n) => n.id === 'ent-1')!;
    expect(ent.type).toBe('entity');
    expect(ent.name).toBe('Acme Ltd');
    expect(ent.entityType).toBe('spv');
    expect(ent.companyNumber).toBe('12345678');
    const prop = nodes.find((n) => n.id === 'prop-1')!;
    expect(prop.type).toBe('property');
    expect(prop.name).toBe('10 High St');
  });

  it('creates a property_ownership edge from entity to property', () => {
    const { edges } = resolveOwnershipGraph(
      [entity('ent-1', 'Acme')],
      [],
      [],
      [property('prop-1', '10 High St', 'ent-1')],
    );
    const propEdge = edges.find((e) => e.type === 'property_ownership');
    expect(propEdge).toBeDefined();
    expect(propEdge?.fromId).toBe('ent-1');
    expect(propEdge?.toId).toBe('prop-1');
    expect(propEdge?.percent).toBe(100);
  });

  it('does not create a property edge when property.entity_id is null', () => {
    const { edges } = resolveOwnershipGraph(
      [entity('ent-1', 'Acme')],
      [],
      [],
      [property('prop-1', 'x', null)],
    );
    expect(edges.some((e) => e.type === 'property_ownership')).toBe(false);
  });

  it('adds individual shareholder nodes and shareholding edges', () => {
    const { nodes, edges } = resolveOwnershipGraph(
      [entity('ent-1', 'Acme')],
      [shareholder('sh-1', 'ent-1', 'Alice', 60), shareholder('sh-2', 'ent-1', 'Bob', 40)],
      [],
      [],
    );
    const individuals = nodes.filter((n) => n.type === 'individual');
    expect(individuals).toHaveLength(2);
    expect(individuals.map((i) => i.name).sort()).toEqual(['Alice', 'Bob']);
    const shareEdges = edges.filter((e) => e.type === 'shareholding');
    expect(shareEdges).toHaveLength(2);
    expect(shareEdges.every((e) => e.toId === 'ent-1')).toBe(true);
  });

  it('deduplicates individual shareholders with the same name inside one entity', () => {
    const { nodes } = resolveOwnershipGraph(
      [entity('ent-1', 'Acme')],
      [
        shareholder('sh-1', 'ent-1', 'Alice', 40, { share_class_id: 'ordinary' }),
        shareholder('sh-2', 'ent-1', 'Alice', 20, { share_class_id: 'preference' }),
      ],
      [],
      [],
    );
    // Both shareholdings should still get an edge (not tested here) but the
    // individual node should only appear once.
    const aliceNodes = nodes.filter((n) => n.name === 'Alice');
    expect(aliceNodes).toHaveLength(1);
  });

  it('treats an individual with the same name in a different entity as a separate node', () => {
    const { nodes } = resolveOwnershipGraph(
      [entity('ent-1', 'Acme'), entity('ent-2', 'Beta')],
      [shareholder('sh-1', 'ent-1', 'Alice', 50), shareholder('sh-2', 'ent-2', 'Alice', 50)],
      [],
      [],
    );
    const aliceNodes = nodes.filter((n) => n.name === 'Alice');
    expect(aliceNodes).toHaveLength(2);
  });

  it('skips shareholder rows whose shareholder_entity_id points to a known entity (handled by entityLinks)', () => {
    const { nodes, edges } = resolveOwnershipGraph(
      [entity('holdco', 'HoldCo'), entity('sub', 'SubCo')],
      [shareholder('sh-1', 'sub', 'HoldCo', 100, { shareholder_entity_id: 'holdco' })],
      [],
      [],
    );
    expect(nodes.filter((n) => n.type === 'individual')).toHaveLength(0);
    expect(edges.filter((e) => e.type === 'shareholding')).toHaveLength(0);
  });

  it('adds entity_ownership edges from entity links', () => {
    const { edges } = resolveOwnershipGraph(
      [entity('holdco', 'HoldCo'), entity('sub', 'SubCo')],
      [],
      [link('sub', 'holdco', 100)],
      [],
    );
    const entityEdge = edges.find((e) => e.type === 'entity_ownership');
    expect(entityEdge).toBeDefined();
    expect(entityEdge?.fromId).toBe('holdco');
    expect(entityEdge?.toId).toBe('sub');
    expect(entityEdge?.percent).toBe(100);
  });

  describe('chains', () => {
    it('resolves a single-hop chain: individual → entity → property', () => {
      const { chains } = resolveOwnershipGraph(
        [entity('ent-1', 'Acme')],
        [shareholder('sh-1', 'ent-1', 'Alice', 100)],
        [],
        [property('prop-1', '10 High St', 'ent-1')],
      );
      expect(chains).toHaveLength(1);
      expect(chains[0].ultimateOwner.name).toBe('Alice');
      expect(chains[0].effectivePercent).toBe(100);
      expect(chains[0].path).toHaveLength(2); // entity + individual
    });

    it('multiplies percentages along a multi-hop chain', () => {
      // Alice owns 50% of HoldCo, HoldCo owns 60% of SubCo, SubCo owns the property.
      // Effective ownership = 50% * 60% = 30%.
      const { chains } = resolveOwnershipGraph(
        [entity('holdco', 'HoldCo'), entity('sub', 'SubCo')],
        [shareholder('sh-1', 'holdco', 'Alice', 50)],
        [link('sub', 'holdco', 60)],
        [property('prop-1', 'x', 'sub')],
      );
      // Alice chain should show 30%.
      const aliceChain = chains.find((c) => c.ultimateOwner.name === 'Alice');
      expect(aliceChain).toBeDefined();
      expect(aliceChain!.effectivePercent).toBeCloseTo(30, 5);
    });

    it('splits distinct owners into separate chains', () => {
      const { chains } = resolveOwnershipGraph(
        [entity('ent-1', 'Acme')],
        [shareholder('sh-1', 'ent-1', 'Alice', 70), shareholder('sh-2', 'ent-1', 'Bob', 30)],
        [],
        [property('prop-1', 'x', 'ent-1')],
      );
      expect(chains).toHaveLength(2);
      const alice = chains.find((c) => c.ultimateOwner.name === 'Alice');
      const bob = chains.find((c) => c.ultimateOwner.name === 'Bob');
      expect(alice?.effectivePercent).toBeCloseTo(70, 5);
      expect(bob?.effectivePercent).toBeCloseTo(30, 5);
    });

    it('returns no chains when the property has no entity_id', () => {
      const { chains } = resolveOwnershipGraph(
        [entity('ent-1', 'Acme')],
        [shareholder('sh-1', 'ent-1', 'Alice', 100)],
        [],
        [property('prop-1', 'x', null)],
      );
      expect(chains).toEqual([]);
    });

    it('handles an entity with no upstream owners (entity IS the ultimate owner)', () => {
      const { chains } = resolveOwnershipGraph(
        [entity('ent-1', 'Acme')],
        [],
        [],
        [property('prop-1', 'x', 'ent-1')],
      );
      expect(chains).toHaveLength(1);
      expect(chains[0].ultimateOwner.type).toBe('entity');
      expect(chains[0].ultimateOwner.name).toBe('Acme');
      expect(chains[0].effectivePercent).toBe(100);
    });

    it('prevents infinite loops when entity_links form a cycle', () => {
      // holdco owns sub, sub owns holdco (pathological data)
      const { chains } = resolveOwnershipGraph(
        [entity('holdco', 'HoldCo'), entity('sub', 'SubCo')],
        [],
        [link('sub', 'holdco', 60), link('holdco', 'sub', 40)],
        [property('prop-1', 'x', 'sub')],
      );
      // Does not hang. Whatever chains come back, they should be finite.
      expect(Array.isArray(chains)).toBe(true);
      // Both entities present as terminal owners of SOME path since the cycle
      // guard kicks in — but the function must return.
      expect(chains.length).toBeLessThan(10);
    });
  });
});
