import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useOrganization } from '@/hooks/useOrganization';

type EntityShareholderRow = Pick<
  Database['public']['Tables']['entity_shareholders']['Row'],
  'id' | 'entity_id' | 'shareholder_name' | 'shareholder_entity_id' | 'shares_held' | 'percentage' | 'shareholder_type'
>;

type EntityShareholdingRow = Pick<
  Database['public']['Tables']['entity_shareholdings']['Row'],
  'parent_entity_id' | 'shareholder_entity_id' | 'shareholder_percent'
>;

export interface FlowchartPerson {
  id: string;
  name: string;
  companyCount: number;
}

export interface FlowchartCompany {
  id: string;
  companyId: string;
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

export function useOwnershipFlowchartData(asOfDate?: string) {
  const { data: org } = useOrganization();

  return useQuery({
    queryKey: ['ownership-flowchart', org?.id, asOfDate || 'current'],
    queryFn: async (): Promise<FlowchartData> => {
      if (!org?.id) throw new Error('No org');

      // Fetch V2 data
      const [
        { data: entities },
        { data: properties },
      ] = await Promise.all([
        supabaseAny
          .from('legal_entities')
          .select('id, entity_name, entity_type, company_number, org_id')
          .eq('org_id', org.id)
          .order('entity_name'),
        supabaseAny
          .from('properties_v2')
          .select('id, address_line_1, postcode, property_type, current_valuation, total_lettable_rooms, entity_id')
          .eq('org_id', org.id)
          .order('address_line_1'),
      ]);

      if (!entities || !properties) throw new Error('Failed to load ownership data');

      const entityIds = entities.map(e => e.id);

      // Build shareholders query — if asOfDate provided, get historical snapshot;
      // otherwise default to current (effective_to IS NULL).
      const buildShareholdersQuery = () => {
        let q = supabaseAny
          .from('entity_shareholders')
          .select('id, entity_id, shareholder_name, shareholder_entity_id, shares_held, percentage, shareholder_type, effective_date, effective_to')
          .in('entity_id', entityIds);
        if (asOfDate) {
          q = q.lte('effective_date', asOfDate).or(`effective_to.is.null,effective_to.gt.${asOfDate}`);
        } else {
          q = q.is('effective_to', null);
        }
        return q;
      };

      const [
        { data: shareholders },
        { data: entityLinks },
      ] = await Promise.all([
        entityIds.length > 0
          ? buildShareholdersQuery()
          : Promise.resolve({ data: [] as EntityShareholderRow[], error: null }),
        entityIds.length > 0
          ? supabaseAny
              .from('entity_shareholdings')
              .select('parent_entity_id, shareholder_entity_id, shareholder_percent')
              .in('parent_entity_id', entityIds)
          : Promise.resolve({ data: [] as EntityShareholdingRow[], error: null }),
      ]);

      const entityIdSet = new Set(entityIds);

      // Build edges
      const personToCompanyEdges: FlowchartEdge[] = [];
      const companyToCompanyEdges: FlowchartEdge[] = [];
      const companyToPropertyEdges: FlowchartEdge[] = [];
      const individualIds = new Set<string>();

      // Person→Entity edges from entity_shareholders (individuals only)
      for (const sh of shareholders || []) {
        if (sh.shareholder_entity_id && entityIdSet.has(sh.shareholder_entity_id)) continue;
        const individualId = `individual:${sh.entity_id}:${sh.shareholder_name}`;
        individualIds.add(individualId);
        personToCompanyEdges.push({
          from: individualId,
          to: sh.entity_id,
          percent: Number(sh.percentage),
        });
      }

      // Entity→Entity edges from entity_shareholdings
      for (const link of entityLinks || []) {
        companyToCompanyEdges.push({
          from: link.shareholder_entity_id,
          to: link.parent_entity_id,
          percent: Number(link.shareholder_percent),
          label: 'Holding → SPV',
        });
      }

      // Entity→Property edges from properties_v2.entity_id
      for (const prop of properties) {
        if (prop.entity_id) {
          companyToPropertyEdges.push({
            from: prop.entity_id,
            to: prop.id,
            percent: 100,
          });
        }
      }

      // Build people list
      const peopleMap = new Map<string, FlowchartPerson>();
      for (const sh of shareholders || []) {
        if (sh.shareholder_entity_id && entityIdSet.has(sh.shareholder_entity_id)) continue;
        const individualId = `individual:${sh.entity_id}:${sh.shareholder_name}`;
        if (!peopleMap.has(individualId)) {
          // Count reachable companies
          const reachable = new Set<string>();
          const queue = personToCompanyEdges.filter(e => e.from === individualId).map(e => e.to);
          while (queue.length > 0) {
            const cur = queue.pop()!;
            if (reachable.has(cur)) continue;
            reachable.add(cur);
            companyToCompanyEdges.filter(e => e.from === cur).forEach(e => queue.push(e.to));
          }
          peopleMap.set(individualId, {
            id: individualId,
            name: sh.shareholder_name,
            companyCount: reachable.size,
          });
        }
      }

      // Build companies list
      const companiesList: FlowchartCompany[] = entities.map(e => {
        const propCount = companyToPropertyEdges.filter(edge => edge.from === e.id).length;
        const totalVal = properties
          .filter(p => p.entity_id === e.id)
          .reduce((sum, p) => sum + (p.current_valuation || 0), 0);
        return {
          id: e.id,
          companyId: e.id,
          name: e.entity_name,
          companyNumber: e.company_number,
          companyType: e.entity_type === 'spv' ? 'SPV' : e.entity_type?.toUpperCase() || 'OTHER',
          propertyCount: propCount,
          totalValue: totalVal,
        };
      });

      // Build properties list
      const propertiesList: FlowchartProperty[] = properties.map(p => ({
        id: p.id,
        address: p.address_line_1 || 'Unknown',
        postcode: p.postcode,
        type: p.property_type,
        value: p.current_valuation,
        beds: p.total_lettable_rooms,
      }));

      return {
        people: Array.from(peopleMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        companies: companiesList.sort((a, b) => a.name.localeCompare(b.name)),
        properties: propertiesList.sort((a, b) => a.address.localeCompare(b.address)),
        personToCompany: personToCompanyEdges,
        companyToCompany: companyToCompanyEdges,
        companyToProperty: companyToPropertyEdges,
      };
    },
    enabled: !!org?.id,
  });
}
