import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

// ─── Main data hook ──────────────────────────────────────────────

export function useOwnershipFlowchartData() {
  return useQuery({
    queryKey: ['ownership-flowchart'],
    queryFn: async () => {
      const [
        { data: companies },
        { data: parties },
        { data: ownershipLinks },
        { data: properties },
        { data: loans },
        { data: complianceItems },
      ] = await Promise.all([
        supabase
          .from('companies')
          .select('id, party_id, legal_name, company_number, company_type, status, accounts_due_date, confirmation_statement_due_date, ch_incorporation_date')
          .order('legal_name'),
        supabase
          .from('parties')
          .select('id, display_name, party_type, email, company_number')
          .order('display_name'),
        supabase
          .from('ownership_links')
          .select('id, subject_type, subject_id, owner_party_id, percent, ownership_type, shares, notes')
          .is('effective_to', null)
          .order('percent', { ascending: false }),
        supabase
          .from('properties')
          .select('id, address_line, postcode, property_type, beds, current_value_gbp, legal_owner_company_id')
          .order('address_line'),
        supabase
          .from('loans')
          .select('property_id, current_mortgage_balance_gbp'),
        supabase
          .from('compliance_items')
          .select('id, property_id, compliance_type, expiry_date, is_required, is_manually_excluded'),
      ]);

      if (!companies || !parties || !ownershipLinks || !properties) {
        throw new Error('Failed to load ownership data');
      }

      // ── Build lookup maps ────────────────────────────────

      const companyByPartyId = new Map(companies.map(c => [c.party_id, c]));
      const companyById = new Map(companies.map(c => [c.id, c]));
      const partyById = new Map(parties.map(p => [p.id, p]));

      // Aggregate loans per property
      const loansByProperty = new Map<string, number>();
      (loans || []).forEach(l => {
        const current = loansByProperty.get(l.property_id) || 0;
        loansByProperty.set(l.property_id, current + Number(l.current_mortgage_balance_gbp || 0));
      });

      // Compliance health per property
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const complianceByProperty = new Map<string, { health: ComplianceHealth; issues: number }>();

      const activeCompliance = (complianceItems || []).filter(
        ci => ci.is_required !== false && !ci.is_manually_excluded
      );

      const complianceGrouped = new Map<string, typeof activeCompliance>();
      activeCompliance.forEach(ci => {
        const arr = complianceGrouped.get(ci.property_id) || [];
        arr.push(ci);
        complianceGrouped.set(ci.property_id, arr);
      });

      complianceGrouped.forEach((items, propId) => {
        let issues = 0;
        let hasExpired = false;
        let hasExpiring = false;

        items.forEach(ci => {
          if (!ci.expiry_date) return;
          const exp = new Date(ci.expiry_date);
          if (exp < now) { hasExpired = true; issues++; }
          else if (exp < thirtyDays) { hasExpiring = true; issues++; }
        });

        const health: ComplianceHealth = hasExpired ? 'red' : hasExpiring ? 'amber' : 'green';
        complianceByProperty.set(propId, { health, issues });
      });

      // ── Build nodes ──────────────────────────────────────

      const personPartyIds = new Set<string>();
      ownershipLinks
        .filter(l => l.subject_type === 'COMPANY')
        .forEach(l => {
          const party = partyById.get(l.owner_party_id);
          if (party && party.party_type === 'INDIVIDUAL') {
            personPartyIds.add(party.id);
          }
        });

      const propertyNodes: FlowchartProperty[] = properties.map(p => {
        const ch = complianceByProperty.get(p.id) || { health: 'unknown' as ComplianceHealth, issues: 0 };
        const propType = (p.property_type || 'Standard') as PropertySubType;
        return {
          id: p.id,
          address: p.address_line,
          postcode: p.postcode,
          type: ['HMO', 'BTL', 'Development'].includes(propType) ? propType : 'Standard' as PropertySubType,
          beds: p.beds,
          value: p.current_value_gbp ? Number(p.current_value_gbp) : null,
          mortgageBalance: loansByProperty.get(p.id) || null,
          complianceHealth: ch.health,
          complianceIssues: ch.issues,
          companyId: p.legal_owner_company_id,
        };
      });

      const companyNodes: FlowchartCompany[] = companies.map(c => {
        const companyProperties = propertyNodes.filter(p => p.companyId === c.id);
        const totalValue = companyProperties.reduce((s, p) => s + (p.value || 0), 0);
        const totalMortgage = companyProperties.reduce((s, p) => s + (p.mortgageBalance || 0), 0);
        return {
          id: c.id,
          partyId: c.party_id,
          name: c.legal_name,
          companyNumber: c.company_number,
          type: (c.company_type || 'SPV') as CompanySubType,
          status: c.status || 'ACTIVE',
          accountsDue: c.accounts_due_date,
          confirmationStatementDue: c.confirmation_statement_due_date,
          incorporationDate: c.ch_incorporation_date,
          propertyCount: companyProperties.length,
          totalValue,
          totalMortgage,
        };
      });

      const personNodes: FlowchartPerson[] = [...personPartyIds].map(partyId => {
        const party = partyById.get(partyId)!;
        const ownedCompanyLinks = ownershipLinks.filter(
          l => l.subject_type === 'COMPANY' && l.owner_party_id === partyId
        );
        return {
          id: partyId,
          name: party.display_name,
          email: party.email,
          companyCount: ownedCompanyLinks.length,
          effectivePortfolioValue: 0,
          effectivePortfolioPercent: 0,
        };
      });

      // ── Build edges ──────────────────────────────────────

      const edges: FlowchartEdge[] = [];

      ownershipLinks
        .filter(l => l.subject_type === 'COMPANY' && personPartyIds.has(l.owner_party_id))
        .forEach(l => {
          const company = companies.find(c => c.id === l.subject_id);
          if (!company) return;
          edges.push({
            id: `p2c-${l.id}`,
            fromId: l.owner_party_id,
            toId: company.id,
            percent: Number(l.percent),
            label: `${Number(l.percent)}%`,
            type: 'person_to_company',
            ownershipLinkId: l.id,
          });
        });

      ownershipLinks
        .filter(l => l.subject_type === 'COMPANY' && !personPartyIds.has(l.owner_party_id))
        .forEach(l => {
          const ownerParty = partyById.get(l.owner_party_id);
          if (!ownerParty || ownerParty.party_type !== 'COMPANY') return;
          const ownerCompany = companyByPartyId.get(l.owner_party_id);
          const subjectCompany = companyById.get(l.subject_id);
          if (!ownerCompany || !subjectCompany) return;
          edges.push({
            id: `c2c-${l.id}`,
            fromId: ownerCompany.id,
            toId: subjectCompany.id,
            percent: Number(l.percent),
            label: `${Number(l.percent)}%`,
            type: 'company_to_company',
            ownershipLinkId: l.id,
          });
        });

      propertyNodes
        .filter(p => p.companyId)
        .forEach(p => {
          edges.push({
            id: `c2p-${p.companyId}-${p.id}`,
            fromId: p.companyId!,
            toId: p.id,
            percent: 100,
            label: '',
            type: 'company_to_property',
          });
        });

      // ── Calculate effective ownership ────────────────────

      const effectiveOwnership: EffectiveOwnership[] = [];

      function walkOwnershipChain(
        companyId: string,
        upstreamPercent: number,
        path: string[],
        visited: Set<string>
      ): Array<{ personId: string; personName: string; effectivePercent: number; path: string }> {
        if (visited.has(companyId)) return [];
        visited.add(companyId);

        const results: Array<{ personId: string; personName: string; effectivePercent: number; path: string }> = [];

        const companyOwners = ownershipLinks.filter(
          l => l.subject_type === 'COMPANY' && l.subject_id === companyId
        );

        for (const owner of companyOwners) {
          const party = partyById.get(owner.owner_party_id);
          if (!party) continue;

          const thisPercent = (upstreamPercent * Number(owner.percent)) / 100;
          const thisPath = [...path, `${Number(owner.percent)}% ${party.display_name}`];

          if (party.party_type === 'INDIVIDUAL') {
            results.push({
              personId: party.id,
              personName: party.display_name,
              effectivePercent: thisPercent,
              path: thisPath.join(' → '),
            });
          } else if (party.party_type === 'COMPANY') {
            const parentCompany = companyByPartyId.get(party.id);
            if (parentCompany) {
              const upstreamResults = walkOwnershipChain(
                parentCompany.id,
                thisPercent,
                thisPath,
                new Set(visited)
              );
              results.push(...upstreamResults);
            }
          }
        }

        return results;
      }

      for (const property of propertyNodes) {
        if (!property.companyId) continue;

        const chains = walkOwnershipChain(property.companyId, 100, [], new Set());

        for (const chain of chains) {
          effectiveOwnership.push({
            personId: chain.personId,
            personName: chain.personName,
            propertyId: property.id,
            propertyAddress: property.address,
            effectivePercent: chain.effectivePercent,
            path: chain.path + ` → ${property.address}`,
          });
        }
      }

      for (const person of personNodes) {
        const personEffective = effectiveOwnership.filter(eo => eo.personId === person.id);
        person.effectivePortfolioValue = personEffective.reduce((s, eo) => {
          const prop = propertyNodes.find(p => p.id === eo.propertyId);
          return s + ((prop?.value || 0) * eo.effectivePercent / 100);
        }, 0);
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

      for (const property of propertyNodes) {
        if (!property.companyId) {
          warnings.push({
            type: 'orphan_property',
            severity: 'warning',
            entityId: property.id,
            entityName: property.address,
            message: `${property.address} is not linked to any company`,
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
