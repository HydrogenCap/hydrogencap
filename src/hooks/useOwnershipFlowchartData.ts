import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FlowchartPerson {
  id: string; // party_id
  name: string;
  companyCount: number;
}

export interface FlowchartCompany {
  id: string; // party_id (used as key in ownership_links)
  companyId: string; // companies table id
  name: string;
  companyNumber: string | null;
  companyType: string;
  propertyCount: number;
  totalValue: number;
}

export interface FlowchartProperty {
  id: string;
  address: string;
  postcode: string | null;
  type: string | null;
  value: number | null;
  beds: number | null;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  percent: number;
  label?: string;
}

export interface FlowchartData {
  people: FlowchartPerson[];
  companies: FlowchartCompany[];
  properties: FlowchartProperty[];
  personToCompany: FlowchartEdge[];
  companyToCompany: FlowchartEdge[];
  companyToProperty: FlowchartEdge[];
}

export function useOwnershipFlowchartData() {
  return useQuery({
    queryKey: ['ownership-flowchart'],
    queryFn: async (): Promise<FlowchartData> => {
      // Fetch all active ownership links
      const { data: links, error: linksErr } = await supabase
        .from('ownership_links')
        .select(`
          subject_type, subject_id, owner_party_id, percent,
          owner_party:parties!ownership_links_owner_party_id_fkey(id, display_name, party_type)
        `)
        .is('effective_to', null);
      if (linksErr) throw linksErr;

      // Fetch companies (need party_id to map)
      const { data: companies, error: compErr } = await supabase
        .from('companies')
        .select('id, legal_name, company_number, company_type, party_id');
      if (compErr) throw compErr;

      // Fetch properties
      const { data: properties, error: propErr } = await supabase
        .from('properties')
        .select('id, address_line, postcode, property_type, current_value_gbp, beds');
      if (propErr) throw propErr;

      // Build party_id → company lookup
      const partyToCompany = new Map<string, typeof companies[0]>();
      const companyIdToPartyId = new Map<string, string>();
      companies?.forEach(c => {
        partyToCompany.set(c.party_id, c);
        companyIdToPartyId.set(c.id, c.party_id);
      });

      // Build property lookup
      const propertyMap = new Map<string, typeof properties[0]>();
      properties?.forEach(p => propertyMap.set(p.id, p));

      // Classify links
      const personToCompanyEdges: FlowchartEdge[] = [];
      const companyToCompanyEdges: FlowchartEdge[] = [];
      const companyToPropertyEdges: FlowchartEdge[] = [];
      const individualPartyIds = new Set<string>();
      const companyPartyIds = new Set<string>(); // companies that appear as subjects
      const propertyIds = new Set<string>();

      for (const link of links || []) {
        const ownerParty = link.owner_party as any;
        if (!ownerParty) continue;

        if (link.subject_type === 'COMPANY') {
          // Find the company's party_id from its company table id
          const targetCompany = companies?.find(c => c.id === link.subject_id);
          if (!targetCompany) continue;

          companyPartyIds.add(targetCompany.party_id);

          if (ownerParty.party_type === 'INDIVIDUAL') {
            individualPartyIds.add(ownerParty.id);
            personToCompanyEdges.push({
              from: ownerParty.id,
              to: targetCompany.party_id,
              percent: Number(link.percent),
            });
          } else if (ownerParty.party_type === 'COMPANY') {
            companyPartyIds.add(ownerParty.id);
            companyToCompanyEdges.push({
              from: ownerParty.id,
              to: targetCompany.party_id,
              percent: Number(link.percent),
              label: 'Holding → SPV',
            });
          }
        } else if (link.subject_type === 'PROPERTY') {
          propertyIds.add(link.subject_id);
          if (ownerParty.party_type === 'COMPANY') {
            companyPartyIds.add(ownerParty.id);
            companyToPropertyEdges.push({
              from: ownerParty.id,
              to: link.subject_id,
              percent: Number(link.percent),
            });
          }
        }
      }

      // If no direct company→property links, infer from legal ownership on properties table
      if (companyToPropertyEdges.length === 0) {
        // Infer: each company owns properties where the property's legal owner (from ownership_links LEGAL) or
        // we check if the company's party_id matches any beneficial owner
        // For now, let's try to link via the property_passport or existing data
        // Actually let's check properties table for owner references
        const { data: propLinks } = await supabase
          .from('ownership_links')
          .select('subject_id, owner_party_id, percent')
          .eq('subject_type', 'PROPERTY')
          .is('effective_to', null);
        
        propLinks?.forEach(pl => {
          propertyIds.add(pl.subject_id);
          companyPartyIds.add(pl.owner_party_id);
          companyToPropertyEdges.push({
            from: pl.owner_party_id,
            to: pl.subject_id,
            percent: Number(pl.percent),
          });
        });
      }

      // Build people list
      const peopleList: FlowchartPerson[] = [];
      for (const partyId of individualPartyIds) {
        const link = (links || []).find(l => {
          const op = l.owner_party as any;
          return op?.id === partyId;
        });
        const name = (link?.owner_party as any)?.display_name || 'Unknown';
        const count = personToCompanyEdges.filter(e => e.from === partyId).length;
        peopleList.push({ id: partyId, name, companyCount: count });
      }

      // Build companies list
      const companiesList: FlowchartCompany[] = [];
      for (const partyId of companyPartyIds) {
        const comp = partyToCompany.get(partyId);
        if (!comp) continue;
        const propCount = companyToPropertyEdges.filter(e => e.from === partyId).length;
        const totalVal = companyToPropertyEdges
          .filter(e => e.from === partyId)
          .reduce((sum, e) => {
            const prop = propertyMap.get(e.to);
            return sum + (prop?.current_value_gbp || 0);
          }, 0);
        companiesList.push({
          id: partyId,
          companyId: comp.id,
          name: comp.legal_name,
          companyNumber: comp.company_number,
          companyType: comp.company_type || 'SPV',
          propertyCount: propCount,
          totalValue: totalVal,
        });
      }

      // Build properties list
      const propertiesList: FlowchartProperty[] = [];
      for (const propId of propertyIds) {
        const prop = propertyMap.get(propId);
        if (!prop) continue;
        propertiesList.push({
          id: propId,
          address: prop.address_line || 'Unknown',
          postcode: prop.postcode,
          type: prop.property_type,
          value: prop.current_value_gbp,
          beds: prop.beds,
        });
      }

      return {
        people: peopleList.sort((a, b) => a.name.localeCompare(b.name)),
        companies: companiesList.sort((a, b) => a.name.localeCompare(b.name)),
        properties: propertiesList.sort((a, b) => a.address.localeCompare(b.address)),
        personToCompany: personToCompanyEdges,
        companyToCompany: companyToCompanyEdges,
        companyToProperty: companyToPropertyEdges,
      };
    },
  });
}
