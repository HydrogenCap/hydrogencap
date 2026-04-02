import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

// ─── Types ───────────────────────────────────────────────────────

export type NodeType = 'person' | 'company' | 'property';
export type CompanySubType = 'HOLDCO' | 'SPV' | 'OPCO' | 'OTHER';
export type PropertySubType = 'HMO' | 'BTL' | 'Development' | 'Standard';
export type ComplianceHealth = 'green' | 'amber' | 'red' | 'unknown';

export interface FlowchartPerson {
  id: string;
  name: string;
  email: string | null;
  companyCount: number;
  effectivePortfolioValue: number;
  effectivePortfolioPercent: number;
}

export interface FlowchartCompany {
  id: string;
  partyId: string;
  name: string;
  companyNumber: string | null;
  type: CompanySubType;
  status: string;
  accountsDue: string | null;
  confirmationStatementDue: string | null;
  incorporationDate: string | null;
  propertyCount: number;
  totalValue: number;
  totalMortgage: number;
}

export interface FlowchartProperty {
  id: string;
  address: string;
  postcode: string | null;
  type: PropertySubType;
  beds: number | null;
  value: number | null;
  mortgageBalance: number | null;
  complianceHealth: ComplianceHealth;
  complianceIssues: number;
  companyId: string | null;
}

export interface FlowchartEdge {
  id: string;
  fromId: string;
  toId: string;
  percent: number;
  label: string;
  type: 'person_to_company' | 'company_to_company' | 'company_to_property';
  ownershipLinkId?: string;
}

export interface EffectiveOwnership {
  personId: string;
  personName: string;
  propertyId: string;
  propertyAddress: string;
  effectivePercent: number;
  path: string;
}

export interface StructuralWarning {
  type: 'missing_shareholders' | 'orphan_property' | 'percent_mismatch' | 'no_properties' | 'overdue_accounts' | 'overdue_cs';
  severity: 'error' | 'warning';
  entityId: string;
  entityName: string;
  message: string;
}

interface FlowchartEntityRow {
  id: string;
  entity_name: string;
  entity_type: string;
  company_number: string | null;
  incorporation_date: string | null;
  status: string | null;
  accounts_due_date: string | null;
  confirmation_statement_due_date: string | null;
}

interface FlowchartShareholderRow {
  id: string;
  entity_id: string;
  shareholder_name: string;
  shareholder_entity_id: string | null;
  percentage: number;
}

interface FlowchartEntityLinkRow {
  parent_entity_id: string;
  shareholder_entity_id: string;
  shareholder_percent: number;
}

function mapEntityTypeToSubType(entityType: string): CompanySubType {
  switch (entityType) {
    case 'spv': return 'SPV';
    case 'holdco': return 'HOLDCO';
    case 'opco': return 'OPCO';
    default: return 'OTHER';
  }
}

function mapPropertyType(propertyType: string | null, lifecycleStage: string | null): PropertySubType {
  if (lifecycleStage === 'development') return 'Development';
  if (propertyType === 'hmo') return 'HMO';
  if (propertyType === 'btl' || propertyType === 'single_let') return 'BTL';
  return 'Standard';
}

// ─── Main data hook ──────────────────────────────────────────────

export function useOwnershipFlowchartData() {
  const { data: org } = useOrganization();

  return useQuery({
    queryKey: ['ownership-flowchart', org?.id],
    queryFn: async () => {
      if (!org?.id) throw new Error('No org');

      // Fetch V2 data in parallel
      const [
        { data: entities },
        { data: properties },
        { data: loans },
        { data: complianceMatrix },
      ] = await Promise.all([
        (supabase as any)
          .from('legal_entities')
          .select('id, entity_name, entity_type, company_number, incorporation_date, status, org_id, accounts_due_date, confirmation_statement_due_date')
          .eq('org_id', org.id)
          .order('entity_name'),
        (supabase as any)
          .from('properties_v2')
          .select('id, address_line_1, postcode, property_type, lifecycle_stage, current_valuation, total_lettable_rooms, entity_id')
          .eq('org_id', org.id)
          .order('address_line_1'),
        (supabase as any)
          .from('loan_facilities')
          .select('property_id, current_balance, status')
          .eq('status', 'active'),
        (supabase as any)
          .from('compliance_matrix_v2')
          .select('property_id, calculated_status')
          .eq('org_id', org.id),
      ]);

      if (!entities || !properties) throw new Error('Failed to load ownership data');

      const typedEntities = entities as FlowchartEntityRow[];
      const entityIds = typedEntities.map((entity) => entity.id);
      const emptyShareholders: FlowchartShareholderRow[] = [];
      const emptyEntityLinks: FlowchartEntityLinkRow[] = [];

      const [
        { data: shareholders },
        { data: entityLinks },
      ] = await Promise.all([
        entityIds.length > 0
          ? (supabase as any)
              .from('entity_shareholders')
              .select('id, entity_id, shareholder_name, shareholder_entity_id, shares_held, percentage, shareholder_type')
              .in('entity_id', entityIds)
              .is('effective_to', null)
          : Promise.resolve({ data: emptyShareholders, error: null }),
        entityIds.length > 0
          ? (supabase as any)
              .from('entity_shareholdings')
              .select('parent_entity_id, shareholder_entity_id, shareholder_percent')
              .in('parent_entity_id', entityIds)
          : Promise.resolve({ data: emptyEntityLinks, error: null }),
      ]);

      const entityIdSet = new Set(entityIds);

      // Loans by property
      const loansByProperty = new Map<string, number>();
      (loans || []).forEach(l => {
        const current = loansByProperty.get(l.property_id) || 0;
        loansByProperty.set(l.property_id, current + Number(l.current_balance || 0));
      });

      // Compliance health per property
      const now = new Date();
      const complianceByProperty = new Map<string, { health: ComplianceHealth; issues: number }>();
      const complianceGrouped = new Map<string, Array<{ calculated_status: string }>>();
      (complianceMatrix || []).forEach(c => {
        const arr = complianceGrouped.get(c.property_id) || [];
        arr.push(c);
        complianceGrouped.set(c.property_id, arr);
      });

      complianceGrouped.forEach((items, propId) => {
        let issues = 0;
        let hasExpired = false;
        let hasExpiring = false;
        items.forEach(c => {
          if (c.calculated_status === 'expired' || c.calculated_status === 'missing') { hasExpired = true; issues++; }
          else if (c.calculated_status === 'expiring_soon' || c.calculated_status === 'critical') { hasExpiring = true; issues++; }
        });
        complianceByProperty.set(propId, { health: hasExpired ? 'red' : hasExpiring ? 'amber' : 'green', issues });
      });

      // ── Build nodes ──────────────────────────────────────

      const propertyNodes: FlowchartProperty[] = properties.map(p => {
        const ch = complianceByProperty.get(p.id) || { health: 'unknown' as ComplianceHealth, issues: 0 };
        return {
          id: p.id,
          address: p.address_line_1 || 'Unknown',
          postcode: p.postcode,
          type: mapPropertyType(p.property_type, p.lifecycle_stage),
          beds: p.total_lettable_rooms,
          value: p.current_valuation ? Number(p.current_valuation) : null,
          mortgageBalance: loansByProperty.get(p.id) || null,
          complianceHealth: ch.health,
          complianceIssues: ch.issues,
          companyId: p.entity_id,
        };
      });

      const companyNodes: FlowchartCompany[] = typedEntities.map((e) => {
        const companyProperties = propertyNodes.filter(p => p.companyId === e.id);
        const totalValue = companyProperties.reduce((s, p) => s + (p.value || 0), 0);
        const totalMortgage = companyProperties.reduce((s, p) => s + (p.mortgageBalance || 0), 0);
        return {
          id: e.id,
          partyId: e.id,
          name: e.entity_name,
          companyNumber: e.company_number,
          type: mapEntityTypeToSubType(e.entity_type),
          status: e.status || 'active',
          accountsDue: e.accounts_due_date,
          confirmationStatementDue: e.confirmation_statement_due_date,
          incorporationDate: e.incorporation_date,
          propertyCount: companyProperties.length,
          totalValue,
          totalMortgage,
        };
      });

      // Build individual shareholders
      const personMap = new Map<string, FlowchartPerson>();
      for (const sh of shareholders || []) {
        if (sh.shareholder_entity_id && entityIdSet.has(sh.shareholder_entity_id)) continue;
        const key = `${sh.entity_id}:${sh.shareholder_name}`;
        if (!personMap.has(key)) {
          personMap.set(key, {
            id: key,
            name: sh.shareholder_name,
            email: null,
            companyCount: 0,
            effectivePortfolioValue: 0,
            effectivePortfolioPercent: 0,
          });
        }
      }

      const personNodes = Array.from(personMap.values());

      // ── Build edges ──────────────────────────────────────

      const edges: FlowchartEdge[] = [];

      // Person → Entity
      for (const sh of shareholders || []) {
        if (sh.shareholder_entity_id && entityIdSet.has(sh.shareholder_entity_id)) continue;
        const personId = `${sh.entity_id}:${sh.shareholder_name}`;
        edges.push({
          id: `p2c-${sh.id}`,
          fromId: personId,
          toId: sh.entity_id,
          percent: Number(sh.percentage),
          label: `${Number(sh.percentage).toFixed(1)}%`,
          type: 'person_to_company',
        });
      }

      // Entity → Entity
      for (const link of entityLinks || []) {
        edges.push({
          id: `c2c-${link.shareholder_entity_id}-${link.parent_entity_id}`,
          fromId: link.shareholder_entity_id,
          toId: link.parent_entity_id,
          percent: Number(link.shareholder_percent),
          label: `${Number(link.shareholder_percent).toFixed(1)}%`,
          type: 'company_to_company',
        });
      }

      // Entity → Property
      for (const prop of propertyNodes) {
        if (prop.companyId) {
          edges.push({
            id: `c2p-${prop.companyId}-${prop.id}`,
            fromId: prop.companyId,
            toId: prop.id,
            percent: 100,
            label: '',
            type: 'company_to_property',
          });
        }
      }

      // ── Calculate effective ownership ────────────────────

      const effectiveOwnership: EffectiveOwnership[] = [];

      function walkChain(
        entityId: string,
        upstreamPercent: number,
        pathParts: string[],
        visited: Set<string>
      ): Array<{ personId: string; personName: string; effectivePercent: number; path: string }> {
        if (visited.has(entityId)) return [];
        visited.add(entityId);
        const results: Array<{ personId: string; personName: string; effectivePercent: number; path: string }> = [];

        // Find individual shareholders of this entity
        const entityShareholders = (shareholders || []).filter(sh =>
          sh.entity_id === entityId && !(sh.shareholder_entity_id && entityIdSet.has(sh.shareholder_entity_id))
        );

        for (const sh of entityShareholders) {
          const pct = (upstreamPercent * Number(sh.percentage)) / 100;
          const personId = `${sh.entity_id}:${sh.shareholder_name}`;
          results.push({
            personId,
            personName: sh.shareholder_name,
            effectivePercent: pct,
            path: [...pathParts, `${Number(sh.percentage).toFixed(1)}% ${sh.shareholder_name}`].join(' → '),
          });
        }

        // Find entity shareholders (holding companies)
        const entityOwners = (entityLinks || []).filter(el => el.parent_entity_id === entityId);
        for (const owner of entityOwners) {
          const pct = (upstreamPercent * Number(owner.shareholder_percent)) / 100;
          const ownerEntity = entities.find(e => e.id === owner.shareholder_entity_id);
          const upResults = walkChain(
            owner.shareholder_entity_id,
            pct,
            [...pathParts, `${Number(owner.shareholder_percent).toFixed(1)}% ${ownerEntity?.entity_name || 'Unknown'}`],
            new Set(visited)
          );
          results.push(...upResults);
        }

        return results;
      }

      for (const prop of propertyNodes) {
        if (!prop.companyId) continue;
        const chains = walkChain(prop.companyId, 100, [], new Set());
        for (const chain of chains) {
          effectiveOwnership.push({
            personId: chain.personId,
            personName: chain.personName,
            propertyId: prop.id,
            propertyAddress: prop.address,
            effectivePercent: chain.effectivePercent,
            path: chain.path + ` → ${prop.address}`,
          });
        }
      }

      // Update person portfolio values
      for (const person of personNodes) {
        const personEffective = effectiveOwnership.filter(eo => eo.personId === person.id);
        person.effectivePortfolioValue = personEffective.reduce((s, eo) => {
          const prop = propertyNodes.find(p => p.id === eo.propertyId);
          return s + ((prop?.value || 0) * eo.effectivePercent / 100);
        }, 0);
        person.companyCount = new Set(
          edges.filter(e => e.type === 'person_to_company' && e.fromId === person.id).map(e => e.toId)
        ).size;
      }

      // ── Structural warnings ──────────────────────────────

      const warnings: StructuralWarning[] = [];

      for (const company of companyNodes) {
        const hasOwners = edges.some(
          e => (e.type === 'person_to_company' || e.type === 'company_to_company') && e.toId === company.id
        );
        if (!hasOwners) {
          warnings.push({
            type: 'missing_shareholders',
            severity: 'error',
            entityId: company.id,
            entityName: company.name,
            message: `${company.name} has no shareholders recorded`,
          });
        }
      }

      for (const company of companyNodes) {
        const totalPercent = edges
          .filter(e => (e.type === 'person_to_company' || e.type === 'company_to_company') && e.toId === company.id)
          .reduce((s, e) => s + e.percent, 0);
        if (totalPercent > 0 && Math.abs(totalPercent - 100) > 1) {
          warnings.push({
            type: 'percent_mismatch',
            severity: 'warning',
            entityId: company.id,
            entityName: company.name,
            message: `${company.name} shareholdings total ${totalPercent.toFixed(1)}% (expected 100%)`,
          });
        }
      }

      for (const company of companyNodes) {
        if (company.propertyCount === 0) {
          const ownsCompanies = edges.some(e => e.type === 'company_to_company' && e.fromId === company.id);
          if (!ownsCompanies) {
            warnings.push({
              type: 'no_properties',
              severity: 'warning',
              entityId: company.id,
              entityName: company.name,
              message: `${company.name} has no properties or subsidiary companies`,
            });
          }
        }
      }

      for (const prop of propertyNodes) {
        if (!prop.companyId) {
          warnings.push({
            type: 'orphan_property',
            severity: 'warning',
            entityId: prop.id,
            entityName: prop.address,
            message: `${prop.address} is not linked to any entity`,
          });
        }
      }

      for (const company of companyNodes) {
        if (company.accountsDue && new Date(company.accountsDue) < now) {
          warnings.push({
            type: 'overdue_accounts',
            severity: 'error',
            entityId: company.id,
            entityName: company.name,
            message: `${company.name} — accounts overdue`,
          });
        }
        if (company.confirmationStatementDue && new Date(company.confirmationStatementDue) < now) {
          warnings.push({
            type: 'overdue_cs',
            severity: 'error',
            entityId: company.id,
            entityName: company.name,
            message: `${company.name} — confirmation statement overdue`,
          });
        }
      }

      return {
        persons: personNodes,
        companies: companyNodes,
        properties: propertyNodes,
        edges,
        effectiveOwnership,
        warnings,
      };
    },
    enabled: !!org?.id,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Layout computation ────────────────────────────────────────

export interface NodePosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutResult {
  positions: Map<string, NodePosition>;
  totalWidth: number;
  totalHeight: number;
  filteredPersons: FlowchartPerson[];
  filteredCompanies: FlowchartCompany[];
  filteredProperties: FlowchartProperty[];
  filteredEdges: FlowchartEdge[];
}

const CARD_W = 192;
const CARD_H_PERSON = 68;
const CARD_H_COMPANY = 88;
const CARD_H_PROPERTY = 84;
const GAP_X = 28;
const GAP_Y = 108;
const PADDING = 40;
const MIN_WIDTH = 900;

export function computeFlowchartLayout(
  data: {
    persons: FlowchartPerson[];
    companies: FlowchartCompany[];
    properties: FlowchartProperty[];
    edges: FlowchartEdge[];
  },
  selectedPersonId: string | null,
  selectedCompanyId: string | null,
): LayoutResult {
  let persons = data.persons;
  let companies = data.companies;
  let properties = data.properties;
  let edges = data.edges;

  if (selectedPersonId) {
    persons = persons.filter(p => p.id === selectedPersonId);
    const ownedCompanyIds = new Set(
      edges.filter(e => e.type === 'person_to_company' && e.fromId === selectedPersonId).map(e => e.toId)
    );
    edges.filter(e => e.type === 'company_to_company' && ownedCompanyIds.has(e.fromId))
      .forEach(e => ownedCompanyIds.add(e.toId));

    companies = data.companies.filter(c => ownedCompanyIds.has(c.id));
    edges = data.edges.filter(e => {
      if (e.type === 'person_to_company') return e.fromId === selectedPersonId;
      if (e.type === 'company_to_company') return ownedCompanyIds.has(e.fromId) || ownedCompanyIds.has(e.toId);
      if (e.type === 'company_to_property') return ownedCompanyIds.has(e.fromId);
      return false;
    });
    const propIds = new Set(edges.filter(e => e.type === 'company_to_property').map(e => e.toId));
    properties = data.properties.filter(p => propIds.has(p.id));
  }

  if (selectedCompanyId) {
    const relatedCompanyIds = new Set([selectedCompanyId]);
    edges.filter(e => e.type === 'company_to_company' && e.fromId === selectedCompanyId)
      .forEach(e => relatedCompanyIds.add(e.toId));
    edges.filter(e => e.type === 'company_to_company' && e.toId === selectedCompanyId)
      .forEach(e => relatedCompanyIds.add(e.fromId));

    companies = data.companies.filter(c => relatedCompanyIds.has(c.id));
    const ownerPersonIds = new Set(
      data.edges.filter(e => e.type === 'person_to_company' && relatedCompanyIds.has(e.toId)).map(e => e.fromId)
    );
    persons = data.persons.filter(p => ownerPersonIds.has(p.id));
    edges = data.edges.filter(e => {
      if (e.type === 'person_to_company') return relatedCompanyIds.has(e.toId);
      if (e.type === 'company_to_company') return relatedCompanyIds.has(e.fromId) || relatedCompanyIds.has(e.toId);
      if (e.type === 'company_to_property') return relatedCompanyIds.has(e.fromId);
      return false;
    });
    const propIds = new Set(edges.filter(e => e.type === 'company_to_property').map(e => e.toId));
    properties = data.properties.filter(p => propIds.has(p.id));
  }

  const row1W = persons.length * CARD_W + Math.max(0, persons.length - 1) * GAP_X;
  const row2W = companies.length * CARD_W + Math.max(0, companies.length - 1) * GAP_X;
  const row3W = properties.length * CARD_W + Math.max(0, properties.length - 1) * GAP_X;
  const totalWidth = Math.max(MIN_WIDTH, Math.max(row1W, row2W, row3W) + PADDING * 2);

  const positions = new Map<string, NodePosition>();

  const r1Start = (totalWidth - row1W) / 2;
  persons.forEach((p, i) => {
    positions.set(p.id, {
      x: r1Start + i * (CARD_W + GAP_X),
      y: PADDING,
      w: CARD_W,
      h: CARD_H_PERSON,
    });
  });

  const row2Y = PADDING + CARD_H_PERSON + GAP_Y;
  const r2Start = (totalWidth - row2W) / 2;
  companies.forEach((c, i) => {
    positions.set(c.id, {
      x: r2Start + i * (CARD_W + GAP_X),
      y: row2Y,
      w: CARD_W,
      h: CARD_H_COMPANY,
    });
  });

  const row3Y = row2Y + CARD_H_COMPANY + GAP_Y;
  const r3Start = (totalWidth - row3W) / 2;
  properties.forEach((p, i) => {
    positions.set(p.id, {
      x: r3Start + i * (CARD_W + GAP_X),
      y: row3Y,
      w: CARD_W,
      h: CARD_H_PROPERTY,
    });
  });

  const totalHeight = row3Y + CARD_H_PROPERTY + PADDING;

  return {
    positions,
    totalWidth,
    totalHeight,
    filteredPersons: persons,
    filteredCompanies: companies,
    filteredProperties: properties,
    filteredEdges: edges,
  };
}
