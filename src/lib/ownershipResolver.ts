/**
 * V2 Ownership Graph Resolver
 *
 * Pure calculation module with no React dependencies.
 * Takes V2 entity data and resolves ownership chains through:
 *   Individual → Entity (via entity_shareholders)
 *   Entity → Entity (via entity_shareholdings)
 *   Entity → Property (via properties_v2.entity_id)
 */

export interface OwnershipNode {
  id: string;
  name: string;
  type: 'individual' | 'entity' | 'property';
  entityType?: string;
  companyNumber?: string;
}

export interface OwnershipEdge {
  fromId: string;
  toId: string;
  percent: number;
  sharesHeld?: number;
  shareClassName?: string;
  type: 'shareholding' | 'entity_ownership' | 'property_ownership';
}

export interface OwnershipChain {
  ultimateOwner: OwnershipNode;
  path: Array<{ node: OwnershipNode; percent: number }>;
  effectivePercent: number;
}

export interface ResolvedOwnership {
  nodes: OwnershipNode[];
  edges: OwnershipEdge[];
  chains: OwnershipChain[];
}

/**
 * Build the full ownership graph from V2 tables.
 */
export function resolveOwnershipGraph(
  entities: Array<{ id: string; entity_name: string; entity_type: string; company_number: string | null }>,
  shareholders: Array<{ id: string; entity_id: string; shareholder_name: string; shareholder_entity_id: string | null; shares_held: number; percentage: number; share_class_id: string | null }>,
  entityLinks: Array<{ parent_entity_id: string; shareholder_entity_id: string; shareholder_percent: number }>,
  properties: Array<{ id: string; address_line_1: string; entity_id: string | null }>
): ResolvedOwnership {
  const nodes: OwnershipNode[] = [];
  const edges: OwnershipEdge[] = [];
  const nodeMap = new Map<string, OwnershipNode>();

  // 1. Add entity nodes
  for (const entity of entities) {
    const node: OwnershipNode = {
      id: entity.id,
      name: entity.entity_name,
      type: 'entity',
      entityType: entity.entity_type,
      companyNumber: entity.company_number || undefined,
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // 2. Add property nodes + entity→property edges
  for (const prop of properties) {
    const node: OwnershipNode = {
      id: prop.id,
      name: prop.address_line_1,
      type: 'property',
    };
    nodes.push(node);
    nodeMap.set(node.id, node);

    if (prop.entity_id) {
      edges.push({
        fromId: prop.entity_id,
        toId: prop.id,
        percent: 100,
        type: 'property_ownership',
      });
    }
  }

  // 3. Add individual shareholder nodes + edges
  const entityIdSet = new Set(entities.map(e => e.id));
  for (const sh of shareholders) {
    // If shareholder_entity_id links to another entity, skip — entity_shareholdings handles that
    if (sh.shareholder_entity_id && entityIdSet.has(sh.shareholder_entity_id)) continue;

    const individualId = `individual:${sh.entity_id}:${sh.shareholder_name}`;
    if (!nodeMap.has(individualId)) {
      const node: OwnershipNode = {
        id: individualId,
        name: sh.shareholder_name,
        type: 'individual',
      };
      nodes.push(node);
      nodeMap.set(individualId, node);
    }
    edges.push({
      fromId: individualId,
      toId: sh.entity_id,
      percent: sh.percentage,
      sharesHeld: sh.shares_held,
      type: 'shareholding',
    });
  }

  // 4. Entity-to-entity ownership edges
  for (const link of entityLinks) {
    edges.push({
      fromId: link.shareholder_entity_id,
      toId: link.parent_entity_id,
      percent: link.shareholder_percent,
      type: 'entity_ownership',
    });
  }

  // 5. Resolve ownership chains (DFS from each property back to ultimate owners)
  const chains = resolveChains(nodes, edges, properties.map(p => p.id));

  return { nodes, edges, chains };
}

/**
 * Walk backward from each property to find all ultimate beneficial owners.
 */
function resolveChains(
  nodes: OwnershipNode[],
  edges: OwnershipEdge[],
  propertyIds: string[]
): OwnershipChain[] {
  const chains: OwnershipChain[] = [];

  // Build reverse adjacency: toId → [{ fromId, percent }]
  const reverseAdj = new Map<string, Array<{ fromId: string; percent: number }>>();
  for (const edge of edges) {
    const arr = reverseAdj.get(edge.toId) || [];
    arr.push({ fromId: edge.fromId, percent: edge.percent });
    reverseAdj.set(edge.toId, arr);
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (const propId of propertyIds) {
    const stack: Array<{
      nodeId: string;
      path: Array<{ node: OwnershipNode; percent: number }>;
      cumPercent: number;
    }> = [];

    const directOwners = reverseAdj.get(propId) || [];
    for (const owner of directOwners) {
      const ownerNode = nodeMap.get(owner.fromId);
      if (!ownerNode) continue;
      stack.push({
        nodeId: owner.fromId,
        path: [{ node: ownerNode, percent: owner.percent }],
        cumPercent: owner.percent / 100,
      });
    }

    while (stack.length > 0) {
      const { nodeId, path, cumPercent } = stack.pop()!;
      const upstreamOwners = reverseAdj.get(nodeId) || [];

      if (upstreamOwners.length === 0) {
        // Terminal node = ultimate owner
        const ultimateOwner = nodeMap.get(nodeId)!;
        chains.push({
          ultimateOwner,
          path,
          effectivePercent: cumPercent * 100,
        });
      } else {
        for (const upstream of upstreamOwners) {
          const upNode = nodeMap.get(upstream.fromId);
          if (!upNode) continue;
          // Prevent cycles
          if (path.some(p => p.node.id === upstream.fromId)) continue;
          stack.push({
            nodeId: upstream.fromId,
            path: [...path, { node: upNode, percent: upstream.percent }],
            cumPercent: cumPercent * (upstream.percent / 100),
          });
        }
      }
    }
  }

  return chains;
}
